"""Default per-page insight generation prompts.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

PAGE_INSIGHT_PROMPTS = {
    "dashboard": "Analyze ALL user data (finances, health, fitness, nutrition). Compare this month vs last month. Give 3-5 actionable insights.",
    "finance": "Analyze financial data (transactions, budgets, account balances). Compare this month vs last month, YTD vs last year. Focus on spending trends, budget adherence, savings rate.",
    "investments": "Analyze investment portfolio (positions, NAV, P&L). Compare this month vs last month. Focus on portfolio performance, diversification, notable movers.",
    "gym": "Analyze gym/workout data (workouts, volume, 1RM, muscle recovery). Compare this month vs last month, this week vs last week. Focus on consistency, strength progress, recovery.",
    "exercises": "Analyze per-exercise progress (1RM, sets, reps history). Compare last 4 weeks vs previous 4 weeks. Focus on specific exercise improvements and stalls.",
    "my-day": "Analyze today's data: daily log, Garmin metrics, food intake, mood. Compare vs 7-day average. Focus on energy, activity, sleep, nutrition.",
}
