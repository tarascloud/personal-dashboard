"""AI insights jobs — generation, prompt improvement, weekly report, DPO export."""

from .generate import PAGE_INSIGHT_PROMPTS, job_generate_ai_insights
from .improve_prompts import job_improve_insight_prompts
from .weekly_report import job_weekly_insight_report
from .dpo_export import job_export_dpo_pairs

__all__ = [
    "PAGE_INSIGHT_PROMPTS",
    "job_generate_ai_insights",
    "job_improve_insight_prompts",
    "job_weekly_insight_report",
    "job_export_dpo_pairs",
]
