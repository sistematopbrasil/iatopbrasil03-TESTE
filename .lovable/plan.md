

## Plan: Fix Multiple UI and Data Issues

### 1. CRM — Scroll to bottom on conversation open
**File:** `src/components/crm/MessageList.tsx`
- The `scrollToBottom('auto')` fires in `useEffect` on `conversationId` change, but messages may not be rendered yet at that point
- Fix: Add a `requestAnimationFrame` + small `setTimeout` to ensure DOM is painted before scrolling

### 2. AI Agent — Buttons overlapping form fields
**File:** `src/pages/AdminAIConfig.tsx`
- The sticky buttons at the bottom (line 613) overlap the last form fields because there's no bottom padding
- Fix: Add `pb-24` to the main content container (line 178) so the sticky buttons don't cover inputs

### 3. Instagram — Yesterday data precision + default filter
**File:** `supabase/functions/insta-update-profiles/index.ts`
- The daily_change logic looks correct (uses São Paulo timezone). The issue may be that the function hasn't been triggered for yesterday, or the data is stale.
- No backend change needed if the scheduled function runs correctly.

**File:** `src/components/instagram/InstagramAnalytics.tsx`
- Change default period from `"7d"` to `"yesterday"` (lines 16-20)

### 4. Instagram Analytics — Match screenshot style
**File:** `src/components/instagram/InstagramAnalytics.tsx`
- The screenshot shows period filter as horizontal button chips (Hoje, Ontem, 7 Dias, 30 Dias, Total, Data) inline with the ranking title, rather than a separate dropdown
- Refactor to use inline button group matching the reference design, integrated into the ranking section header

### 5. Traffic — Auto-update data
**File:** `src/hooks/useTrafficMetrics.ts`
- Add `refetchInterval: 5 * 60 * 1000` (5 minutes) to the query options so data refreshes automatically

### 6. Traffic Accounts — Spend by period filter
**File:** `src/components/traffic/TrafficAccounts.tsx`
- Add a period selector (Hoje, Ontem, 7d, 14d, 30d, Total) at the top of the accounts table
- Pass the selected period to `useTrafficMetrics` so the `byAccount` aggregation respects the date range
- The spend column will then show spend for the selected period

### 7. Admin Dashboard — Temperature chart missing warm leads
**File:** `src/components/super-admin/SuperAdminCharts.tsx`
- All 3 queries filter `.eq('completion_percentage', 100)` which excludes leads from Capture Page and WhatsApp (which may have different completion values)
- Fix: Remove `.eq('completion_percentage', 100)` from the temperature distribution query (line 117) and top consultants query (line 75), matching ConsultantDashboard behavior
- Also remove from leads-per-day query (line 37) for consistency

### Files to edit
1. `src/components/crm/MessageList.tsx` — scroll fix
2. `src/pages/AdminAIConfig.tsx` — bottom padding for sticky buttons
3. `src/components/instagram/InstagramAnalytics.tsx` — default "yesterday" + button-style period filter
4. `src/hooks/useTrafficMetrics.ts` — auto-refresh interval
5. `src/components/traffic/TrafficAccounts.tsx` — period filter for spend
6. `src/components/super-admin/SuperAdminCharts.tsx` — remove completion_percentage filter

