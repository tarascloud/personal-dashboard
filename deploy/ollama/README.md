# Ollama `pd-assistant` nightly refresh

Driven by host cron on Mini:

```
0 1 * * * /opt/docker/scripts/ollama-refresh.sh >> /opt/docker/backups/ollama-refresh.log 2>&1
```

The script gathers a 30-day snapshot from `pd_prod` and rebakes the
`pd-assistant` Ollama model with that snapshot as the SYSTEM context.

## Files

- `ollama-refresh.sh` — wrapper script (Bash). Runs `docker exec pg psql ... < ollama-refresh.sql`,
  builds a `Modelfile`, calls `docker exec ollama ollama create pd-assistant`.
- `ollama-refresh.sql` — the SQL snapshot query.

These files are the source-controlled canonical versions. The runtime copies
live at `/opt/docker/scripts/ollama-refresh.{sh,sql}` on Mini and must be
kept in sync manually:

```
scp deploy/ollama/ollama-refresh.{sh,sql} mini:/opt/docker/scripts/
ssh mini 'chmod +x /opt/docker/scripts/ollama-refresh.sh'
```

## Manual run

```
ssh mini '/opt/docker/scripts/ollama-refresh.sh'
```

## Gotchas

- All `*.date` columns in PD are PostgreSQL native `date`. Never cast a
  date expression to `text` (e.g. `(CURRENT_DATE - INTERVAL '30 days')::date::text`)
  in a comparison against a `date` column — PG raises `operator does not
  exist: date >= text`. Use `::date` or omit the cast entirely.
- `budgets.active` is `boolean` (not `integer`) — use `b.active = true`,
  not `b.active = 1`.
- Regression history: REV-20260512-026 (these two bugs together caused the
  cron to fail with zero output 2026-05-07 through 2026-05-11; fixed
  2026-05-12).
