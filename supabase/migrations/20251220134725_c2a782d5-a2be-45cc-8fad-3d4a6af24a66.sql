-- ====================================================
-- MIGRATION: Fix temperature update RLS + tracking sessions
-- ====================================================

-- 1. Drop and recreate RLS for quiz_submissions_new to allow temperature updates
DROP POLICY IF EXISTS "Public can update recent submissions" ON quiz_submissions_new;

CREATE POLICY "Public can update recent submissions"
ON quiz_submissions_new
FOR UPDATE
USING (created_at > (now() - '2 hours'::interval))
WITH CHECK (true);

-- 2. Ensure tracking_sessions has proper RLS for inserts
DROP POLICY IF EXISTS "Public can insert tracking sessions" ON tracking_sessions;

CREATE POLICY "Public can insert tracking sessions"
ON tracking_sessions
FOR INSERT
WITH CHECK (true);

-- 3. Drop and recreate tracking sessions update policy
DROP POLICY IF EXISTS "Public can update tracking sessions" ON tracking_sessions;

CREATE POLICY "Public can update tracking sessions"
ON tracking_sessions
FOR UPDATE
USING (started_at > (now() - '2 hours'::interval))
WITH CHECK (true);