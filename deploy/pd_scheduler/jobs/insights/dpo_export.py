"""DPO preference pairs export from insight feedback (weekly, Monday 5:00).

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

from ...db import get_conn
from .prompts import PAGE_INSIGHT_PROMPTS

logger = logging.getLogger("scheduler")


def job_export_dpo_pairs():
    """Export DPO preference pairs from insight feedback for ML training (weekly, Monday 5:00).

    Creates preference pairs from InsightFeedback:
      - 👍 insight → chosen response
      - 👎 insight → rejected response
      - Same page + same prompt → valid DPO pair
    Only pairs generated with the same prompt are matched to ensure valid comparisons.
    """
    logger.info("Running: export_dpo_pairs")
    try:
        import json
        from datetime import datetime
        from pathlib import Path

        MIN_PAIRS = int(os.environ.get("DPO_MIN_PAIRS", "10"))
        output_path = Path("/data/ml-training/preferences.jsonl")

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get all feedback joined with insight data, including prompt_used for matching
                cur.execute("""
                    SELECT f.user_id, f.page, f.period,
                           f.reaction, f.insight_id, f.comment,
                           ai.insights_json, ai.prompt_used, ai.model,
                           ai.variant, f.created_at
                    FROM insight_feedback f
                    JOIN ai_insights ai ON ai.id = f.insight_id
                    WHERE f.reaction IN ('like', 'dislike')
                    ORDER BY f.user_id, f.page, f.period
                """)
                rows = cur.fetchall()

        if not rows:
            logger.info("export_dpo_pairs: no feedback data")
            return

        # Group by (user_id, page, prompt_used) — same prompt is key for valid DPO pairs
        from collections import defaultdict
        groups = defaultdict(lambda: {"liked": [], "disliked": []})

        for (user_id, page, period, reaction, insight_id,
             comment, insights_json, prompt_used, model, variant, created_at) in rows:
            # Normalize prompt key: use actual prompt or fall back to default
            prompt_key = (prompt_used or "").strip() or PAGE_INSIGHT_PROMPTS.get(page, "")
            key = (user_id, page, prompt_key)
            entry = {
                "insight_id": insight_id,
                "insights_json": insights_json,
                "model": model,
                "variant": variant or "default",
                "period": period,
                "comment": comment,
                "created_at": created_at.isoformat() if created_at else None,
            }
            if reaction == "like":
                groups[key]["liked"].append(entry)
            else:
                groups[key]["disliked"].append(entry)

        # Build DPO pairs: each (liked, disliked) combination within same page + same prompt
        pairs = []
        skipped_no_match = 0

        for (user_id, page, prompt_key), group in groups.items():
            if not group["liked"] or not group["disliked"]:
                skipped_no_match += 1
                continue

            system_prompt = f"You are an AI analyst for the {page} page. {prompt_key}"

            for liked in group["liked"]:
                for disliked in group["disliked"]:
                    pairs.append({
                        "prompt": system_prompt,
                        "chosen": liked["insights_json"],
                        "rejected": disliked["insights_json"],
                        "metadata": {
                            "page": page,
                            "chosen_model": liked["model"],
                            "rejected_model": disliked["model"],
                            "chosen_variant": liked["variant"],
                            "rejected_variant": disliked["variant"],
                            "chosen_period": liked["period"],
                            "rejected_period": disliked["period"],
                            "rejection_comment": disliked["comment"],
                        },
                    })

        logger.info(
            "export_dpo_pairs: found %d pairs from %d groups (%d groups without both like+dislike, threshold: %d)",
            len(pairs), len(groups), skipped_no_match, MIN_PAIRS,
        )

        if len(pairs) < MIN_PAIRS:
            logger.info("export_dpo_pairs: below threshold (%d < %d), skipping export", len(pairs), MIN_PAIRS)
            return

        # Write JSONL (atomic: write to temp, then rename)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = output_path.with_suffix(".jsonl.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            for pair in pairs:
                f.write(json.dumps(pair, ensure_ascii=False) + "\n")
        tmp_path.rename(output_path)

        logger.info("export_dpo_pairs: exported %d pairs to %s", len(pairs), output_path)

        # Log to audit_log
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO audit_log (user_email, action, details, created_at)
                    VALUES (%s, 'dpo_export', %s, NOW())
                """, (
                    os.environ.get("OWNER_EMAIL", "admin@example.com"),
                    json.dumps({
                        "pairs_count": len(pairs),
                        "groups_total": len(groups),
                        "groups_skipped": skipped_no_match,
                        "output_file": str(output_path),
                        "exported_at": datetime.utcnow().isoformat() + "Z",
                    }),
                ))

    except Exception as e:
        logger.error("export_dpo_pairs failed: %s", e, exc_info=True)
