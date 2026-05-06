# AI Insights Architecture Review

> Last updated: 2026-03-21

## 1. Architecture Diagram

```
+-------------------+     +---------------------+     +------------------+
|   InsightsPanel   |     |  Server Actions      |     |    Prisma DB     |
|   (React client)  |     |  insights.ts         |     |   ai_insights    |
+--------+----------+     +----------+----------+     +--------+---------+
         |                           |                          |
         | 1. useEffect              | 4. getPageInsights()     |
         |    loadInsights() ------->|    prisma.aiInsight      |
         |                           |    .findFirst() -------->|
         |<-- insights[] -----------|<-- row ------------------|
         |                           |                          |
         | 2. onClick                |                          |
         |    generateInsights()     |                          |
         |         |                 |                          |
         |         v                 |                          |
+--------+----------+     +----------+----------+     +--------+---------+
|  fetch POST       |     |  API Route           |     |    Ollama        |
|  /api/insights    |---->|  route.ts             |     |  pd-assistant    |
+-------------------+     +----------+----------+     +--------+---------+
                                     |                          |
                                     | 3. fetch ollama          |
                                     |    /api/chat ----------->|
                                     |<-- JSON insights --------|
                                     |                          |
                                     | 4. prisma.aiInsight      |
                                     |    .upsert() ----------->|  ai_insights
                                     |                          |
                                     |<-- Response.json --------|
                                     |    { insights, period }  |
```

## 2. Data Flow

### Read Path (page load)
1. `InsightsPanel` mounts, `useEffect` fires `loadInsights()`
2. Calls server action `getPageInsights(page, periodPreset)`
3. `periodKeyFromPreset()` converts preset ("this_month") to key ("2026-03")
4. Prisma query: exact match `(userId, page, period)`, fallback to latest by date
5. `parseInsightsJson()` normalizes field names (handles legacy key variants)
6. Returns `PageInsights { insights[], generatedAt, model, period }`

### Write Path (generate)
1. User clicks Refresh button in `InsightsPanel`
2. Fire-and-forget `fetch POST /api/insights` (does NOT block navigation)
3. API route authenticates via `auth()` (NextAuth session)
4. Loads context: `getUserContext()` (general) or `getExerciseInsightsContext()` (exercises page)
5. Checks `UserPreference` for custom prompt, falls back to `PAGE_PROMPTS`
6. Sends chat request to Ollama (`pd-assistant` model) via `/api/chat` (non-OpenAI endpoint)
7. Extracts JSON array from response with regex `\[[\s\S]*\]`
8. Upserts to `ai_insights` table with composite key `(userId, page, period)`
9. Returns insights to client, which updates state

### Alternative Write Path (server action)
- `generatePageInsightsAction()` in `insights.ts` duplicates the API route logic
- Used for server-side generation (won't cancel on navigation)
- Same Ollama call, same DB upsert, same response format

## 3. DB Schema: AiInsight

```prisma
model AiInsight {
  id           Int       @id @default(autoincrement())
  userId       Int       @map("user_id")
  page         String                              // "finance", "investments", "gym", etc.
  date         String                              // "2026-03-21"
  period       String    @default("")              // "2026-03-21", "2026-W12", "2026-03", "2026"
  insightsJson String    @map("insights_json")     // JSON array of Insight objects
  promptUsed   String?   @map("prompt_used")
  model        String    @default("pd-assistant")
  generationMs Int?      @map("generation_ms")
  createdAt    DateTime? @default(now())

  @@unique([userId, page, period])
  @@index([userId, date(sort: Desc)])
  @@map("ai_insights")
}
```

## 4. Key Components

| File | Role |
|------|------|
| `src/actions/insights.ts` | Server actions: read (getPageInsights), write (generatePageInsightsAction), settings CRUD |
| `src/app/api/insights/route.ts` | API route: GET (read cached), POST (generate via Ollama) |
| `src/components/insights/insights-panel.tsx` | UI: display insights, period selector, prompt editor, generate button |
| `src/lib/ai-insights-prompts.ts` | Default prompts (Ukrainian), periodKeyFromPreset(), resolvePrompt() |

## 5. Strengths

1. **Period-aware caching** -- composite unique key `(userId, page, period)` prevents duplicate generation and enables instant reads for previously generated periods.
2. **Fire-and-forget generation** -- `InsightsPanel` uses detached `fetch().then()` so navigating away does not abort generation.
3. **Custom prompts per page** -- users can override default prompts via `UserPreference` table, with reset-to-default support.
4. **Localization** -- insights generated in user's language (uk/en/es) via cookie-based locale detection.
5. **Graceful fallbacks** -- `parseInsightsJson()` handles multiple key naming conventions for backward compatibility with older Ollama outputs.
6. **Generation time tracking** -- `generationMs` column enables performance monitoring.

## 6. Issues (Prioritized)

### P0 -- Critical

1. **Duplicated generation logic** -- `generatePageInsightsAction()` (server action) and `POST /api/insights` (API route) contain nearly identical code. Any bug fix must be applied twice. The server action imports `getUserContext` lazily; the API route imports it statically.

2. **No error propagation to UI** -- `InsightsPanel.generateInsights()` has `.catch(() => {})` which silently swallows errors. User sees no feedback if Ollama is down, timeout occurs, or JSON parsing fails.

3. **Regex JSON extraction is fragile** -- `content.match(/\[[\s\S]*\]/)` grabs the first `[` to last `]` in the response. If the model outputs explanatory text containing brackets, this can capture garbage. No validation of individual insight objects after parsing.

### P1 -- Important

4. **120s timeout with no user feedback** -- `AbortSignal.timeout(120000)` means the user could wait 2 minutes with only a spinner. No progress indication or intermediate state.

5. **getUserContext() is a black box for insights** -- The same context function is used for chat and insights, but insights need structured data (numbers, comparisons). The context may not always include comparison-period data that the prompt requests.

6. **Period calculation bugs** -- `periodKeyFromPreset()` uses a naive week number calculation (`Math.ceil((dayOfYear + jan1.getDay()) / 7)`) that does not follow ISO 8601 week numbering. Edge cases around year boundaries will produce wrong week numbers.

7. **No rate limiting on generation** -- A user can spam the Refresh button, triggering unlimited concurrent Ollama requests. Each takes up to 120s of GPU time.

### P2 -- Minor

8. **Hardcoded model name "pd-assistant"** -- Not configurable via environment variable; changing the model requires code changes in two files.

9. **No insight versioning** -- Upsert overwrites previous insights for the same (page, period). Historical insights are lost. No way to compare quality over time.

10. **`resolvePrompt()` is unused** -- Defined in `ai-insights-prompts.ts` but never called. The actual prompt construction happens inline in the generation functions, ignoring the `{period}` / `{comparison_period}` placeholders in `DEFAULT_PROMPTS`.

11. **Settings page fetches all rows** -- `getAllInsightsForSettings()` loads all insights for all pages with full `insightsJson` blobs. No pagination.

## 7. Improvement Recommendations

### Short-term (1-2 days)

1. **Extract shared generation logic** into a single function called by both the server action and the API route. Signature:
   ```ts
   async function generateInsights(userId: number, page: string, period: string, locale: string): Promise<PageInsights>
   ```

2. **Use `resolvePrompt()`** -- wire up the existing placeholder system in `DEFAULT_PROMPTS` instead of constructing prompts inline. Delete the duplicate `PAGE_PROMPTS` from `route.ts`.

3. **Add error toasts** -- replace `.catch(() => {})` with a toast notification (e.g., sonner) so users know when generation fails.

4. **Add generation debounce** -- disable the Refresh button for 5s after click, or check if a generation is already in progress for the same (page, period).

### Medium-term (1-2 weeks)

5. **Validate insight objects** after JSON parsing: check that each has required fields (`domain`, `severity`, `title`, `body`), filter out malformed entries.

6. **Fix ISO week calculation** -- use `date-fns/getISOWeek` (already a dependency) instead of manual math.

7. **Make model name configurable** -- `process.env.INSIGHTS_MODEL || "pd-assistant"`.

8. **Add insight history** -- instead of upsert, insert new rows and keep the last N per (page, period). This enables quality comparison for model training.

### Long-term (model improvement)

9. **Structured context per page** -- create page-specific context builders that return data optimized for insights (aggregated numbers, comparison columns) rather than reusing the chat context.

10. **Streaming generation** -- switch to `stream: true` in the Ollama request and stream insights to the UI incrementally via Server-Sent Events.

11. **Automated quality scoring** -- compare Claude-generated reference insights against local model output (see model-training-plan.md).
