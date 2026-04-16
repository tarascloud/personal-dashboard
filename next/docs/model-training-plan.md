# Model Training Plan: pd-assistant

> Last updated: 2026-03-21

## Overview

Train a local Llama 3.1 8B model (4-bit quantized) via MLX LoRA fine-tuning on Mac M2 Pro to serve as `pd-assistant` in Ollama. The model generates personalized insights in Ukrainian for finance, health, gym, investments, and lifestyle data.

## Current State

- Base model: Llama 3.1 8B (4-bit, via MLX)
- Training data: `pd/ml-training/train.jsonl` (~40 examples), `valid.jsonl` (~5 examples)
- Data sources: `transactions.csv`, `garmin.csv`, `daily_logs.csv`
- Preparation script: `pd/ml-training/prepare_training.py`
- Fused model: `pd/ml-training/fused-model/`
- Ollama model: `pd-assistant` (created via `Modelfile`)

---

## 1. Data Collection -- Save Claude-Generated Insights as Training Examples

### Goal
Use Claude (via Claude Code or Vercel AI SDK) to generate high-quality reference insights, then save them as ground-truth training examples.

### Process

1. **Generate reference insights** for each page and period combination:
   - Pages: finance, investments, gym, exercises, my-day, list (6 pages)
   - Periods: today, this_week, this_month, this_year (4 periods)
   - Total: 24 reference insight sets

2. **Store in DB** -- add a `is_reference` boolean column to `ai_insights` table, or create a separate `ai_insights_reference` table:
   ```sql
   ALTER TABLE ai_insights ADD COLUMN is_reference BOOLEAN DEFAULT FALSE;
   ALTER TABLE ai_insights ADD COLUMN source VARCHAR(50) DEFAULT 'pd-assistant';
   ```

3. **Export pipeline** -- script to extract reference insights from DB to JSONL:
   ```python
   # export_references.py
   # SELECT * FROM ai_insights WHERE is_reference = TRUE
   # Convert to chat JSONL format:
   # {"messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": context}, {"role": "assistant", "content": insight_json}]}
   ```

4. **Manual curation** -- Taras reviews and approves/rejects each reference insight set before it enters training data.

### Data Growth Target
- Current: ~45 training examples
- Month 1: 100+ examples (24 reference + augmented variants)
- Month 3: 300+ examples (rolling 90 days of curated insights)
- Month 6: 500+ examples (full data diversity)

---

## 2. Dataset Preparation -- Chat JSONL Format for MLX LoRA

### Format (already in use)

Each line in `train.jsonl`:
```json
{
  "messages": [
    {"role": "system", "content": "Ти — персональний AI-асистент Тараса..."},
    {"role": "user", "content": "Проаналізуй мої фінанси за 2026-03..."},
    {"role": "assistant", "content": "[{\"domain\":\"finance\",\"severity\":\"info\",...}]"}
  ]
}
```

### Improvements to `prepare_training.py`

1. **Add insight-format examples** -- current script generates Q&A pairs but not JSON insight arrays. Add a new section that converts Claude reference insights into training examples with the exact JSON schema the app expects:
   ```python
   # For each reference insight from DB:
   examples.append({
       "messages": [
           {"role": "system", "content": INSIGHT_SYSTEM_PROMPT},
           {"role": "user", "content": f"Period: {period}\nAnalyze:\n{context}"},
           {"role": "assistant", "content": insights_json_array}
       ]
   })
   ```

2. **Data augmentation** -- create variants:
   - Same data, different period phrasing ("за березень" vs "за 2026-03")
   - Paraphrase user questions
   - Mix severity distributions

3. **Validation split** -- maintain 90/10 train/valid split, ensure each page type appears in validation set.

4. **Data quality checks**:
   - All assistant responses must be valid JSON arrays
   - Each insight must have: domain, severity, title, body
   - All text must be in Ukrainian
   - No empty or placeholder values

---

## 3. Training Schedule -- Mac M2 Pro, Nightly 00:00-09:00

### Hardware
- Mac M2 Pro, 16GB unified memory
- MLX framework (Apple Silicon optimized)
- Llama 3.1 8B 4-bit (~4.5 GB in memory)
- LoRA rank: 8, alpha: 16 (memory-efficient)

### Nightly Pipeline (launchd / cron)

```
00:00  Start training pipeline
00:05  Export fresh data from PD database (transactions, garmin, daily_logs)
00:15  Run prepare_training.py (generate train.jsonl + valid.jsonl)
00:20  Start MLX LoRA training
       - Model: mlx-community/Meta-Llama-3.1-8B-Instruct-4bit
       - Epochs: 3-5 (auto-stop on val loss plateau)
       - Batch size: 2 (M2 Pro 16GB constraint)
       - Learning rate: 1e-5
       - LoRA layers: attention (q_proj, v_proj, k_proj, o_proj)
       - Estimated time: 2-4 hours (depending on dataset size)
04:00  Fuse adapter weights into base model
04:30  Run evaluation suite (see section 4)
05:00  If eval passes: create Ollama model from fused weights
05:15  Push to mini Ollama (see section 5)
05:30  Pipeline complete, log results
09:00  Hard deadline -- kill any still-running process
```

### Cron Entry
```bash
# /Users/taras/Documents/taras-code/pd-private/ml-training/train-nightly.sh
0 0 * * * /Users/taras/Documents/taras-code/pd-private/ml-training/train-nightly.sh >> /tmp/pd-training.log 2>&1
```

### MLX Commands
```bash
# LoRA fine-tune
python -m mlx_lm.lora \
  --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit \
  --data /Users/taras/Documents/taras-code/pd-private/ml-training/ \
  --train \
  --batch-size 2 \
  --lora-layers 8 \
  --iters 500 \
  --learning-rate 1e-5 \
  --adapter-path /Users/taras/Documents/taras-code/pd-private/ml-training/adapters

# Fuse
python -m mlx_lm.fuse \
  --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit \
  --adapter-path /Users/taras/Documents/taras-code/pd-private/ml-training/adapters \
  --save-path /Users/taras/Documents/taras-code/pd-private/ml-training/fused-model
```

---

## 4. Evaluation -- Compare Claude vs Local, Automated Scoring

### Evaluation Dimensions

| Dimension | Method | Target |
|-----------|--------|--------|
| JSON validity | Parse response as JSON array | 100% |
| Schema compliance | Each insight has domain, severity, title, body | 100% |
| Language | Detect Ukrainian (no English leaks) | >95% |
| Insight count | 3-5 insights per request | >90% |
| Specificity | Contains numbers/percentages | >80% |
| Relevance | Insights match the page domain | >90% |
| Quality vs Claude | Side-by-side scoring (1-5 scale) | Avg >3.5 |

### Automated Eval Script

```python
# eval_model.py
def evaluate_response(response: str, page: str) -> dict:
    score = {}

    # 1. JSON validity
    try:
        insights = json.loads(response)
        score["json_valid"] = isinstance(insights, list)
    except:
        score["json_valid"] = False
        return score

    # 2. Schema compliance
    required = {"domain", "severity", "title", "body"}
    score["schema_ok"] = all(required <= set(i.keys()) for i in insights)

    # 3. Count
    score["count_ok"] = 3 <= len(insights) <= 5

    # 4. Language (simple heuristic: check for Ukrainian characters)
    all_text = " ".join(i["title"] + i["body"] for i in insights)
    score["ukrainian"] = bool(re.search(r'[іїєґ]', all_text))

    # 5. Specificity (contains numbers)
    score["has_numbers"] = bool(re.search(r'\d+', all_text))

    # 6. Domain relevance
    score["domain_match"] = all(i["domain"] == page for i in insights)

    return score
```

### Claude Comparison Pipeline

1. For each (page, period) in evaluation set:
   - Generate insights with local model
   - Generate insights with Claude (Gemini 2.5 Flash via Vercel AI SDK)
   - Score both automatically
   - Log to `eval_results.jsonl`

2. Weekly report: compare average scores, identify regressions.

---

## 5. Deployment -- Push to Mini Ollama as pd-assistant-v2

### Current Deployment (pd-assistant v1)
```
Mac (fused-model/) -> Modelfile -> ollama create pd-assistant -> Docker container
```

### New Deployment Flow

1. **Build Ollama model locally** (Mac):
   ```bash
   cd /Users/taras/Documents/taras-code/pd-private/ml-training
   ollama create pd-assistant-v2 -f Modelfile
   ```

2. **Test locally**:
   ```bash
   ollama run pd-assistant-v2 "Які мої фінанси за березень?"
   ```

3. **Export and transfer to NAS**:
   ```bash
   # Ollama models are stored in ~/.ollama/models/
   # For NAS deployment, the Ollama container needs access to the model

   # Option A: Run ollama on NAS directly
   ssh terminal-user@192.168.1.129 "docker exec ollama ollama pull pd-assistant-v2"

   # Option B: Copy model files
   tar czf /tmp/pd-assistant-v2.tar.gz -C ~/.ollama/models .
   cat /tmp/pd-assistant-v2.tar.gz | ssh terminal-user@192.168.1.129 'cat > /tmp/pd-assistant-v2.tar.gz'
   ```

4. **Canary deployment**:
   - Keep `pd-assistant` (v1) as default
   - Add `pd-assistant-v2` alongside
   - Route 10% of insight requests to v2
   - Compare quality scores for 1 week
   - If v2 scores >= v1: promote to default

5. **Rollback**: switch model name back to `pd-assistant` in env var.

### Model Naming Convention
```
pd-assistant       -- current production model
pd-assistant-v2    -- candidate (after nightly training)
pd-assistant-prev  -- previous version (for rollback)
```

---

## 6. Continuous Loop -- Nightly Pipeline

```
+-------------------+
|  00:00 Export DB   |  Fresh transactions, garmin, daily_logs
+---------+---------+
          |
          v
+---------+---------+
|  00:15 Prepare    |  prepare_training.py -> train.jsonl
|  training data    |  Include Claude reference insights
+---------+---------+
          |
          v
+---------+---------+
|  00:20 MLX LoRA   |  Fine-tune Llama 3.1 8B 4-bit
|  training         |  ~2-4 hours on M2 Pro
+---------+---------+
          |
          v
+---------+---------+
|  04:00 Fuse       |  Merge LoRA adapters into base
+---------+---------+
          |
          v
+---------+---------+
|  04:30 Evaluate   |  Automated scoring vs thresholds
+---------+---------+
          |
     pass | fail
          |    \
          v     v
+---------+---------+     +------------------+
|  05:00 Deploy     |     |  Log failure,    |
|  ollama create    |     |  keep current    |
|  pd-assistant-v2  |     |  model           |
+---------+---------+     +------------------+
          |
          v
+---------+---------+
|  05:15 Transfer   |  Push to NAS Ollama
|  to NAS           |
+---------+---------+
          |
          v
+---------+---------+
|  05:30 Notify     |  Telegram: training results
|  Taras            |  + quality delta vs previous
+-------------------+
```

### Monitoring & Alerts

- **Telegram notification** after each nightly run:
  - Training loss (final)
  - Validation loss (final)
  - Eval scores (pass/fail per dimension)
  - Quality delta vs previous model
  - Duration

- **Weekly summary** (Sunday):
  - Training examples count growth
  - Model quality trend (chart)
  - Top failing dimensions
  - Recommendations

### Data Freshness

| Data Source | Sync Frequency | Training Lag |
|-------------|---------------|--------------|
| Transactions (Monobank, bunq) | Every 6h via pd-scheduler | <24h |
| Garmin health | Every 6h via pd-scheduler | <24h |
| Daily logs (mood, energy) | Manual entry | <24h |
| Investment positions | Every 12h via pd-scheduler | <24h |
| Claude reference insights | On-demand | Immediate after curation |

### Exit Criteria for v2 Promotion

1. JSON validity: 100% on eval set
2. Schema compliance: 100%
3. Ukrainian language: >95%
4. Insight count (3-5): >90%
5. Specificity (numbers): >80%
6. Quality vs Claude: avg >3.5/5
7. No regressions vs v1 on any dimension
8. Stable for 3+ consecutive nightly runs
