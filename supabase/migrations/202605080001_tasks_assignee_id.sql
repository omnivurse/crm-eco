-- Tasks widget queries `tasks.assignee_id` and the FK
-- `tasks_assignee_id_fkey` (PostgREST relation hint), but the schema only had
-- `tasks.user_id` referencing auth.users. The widget's full-join query 500'd
-- because the column + FK didn't exist, and even the fallback `user_id` query
-- 500'd whenever the OR condition above had referenced the non-existent
-- `assignee_id` (PostgREST refuses the entire request).
--
-- This migration:
--   1. Adds `tasks.assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL`
--      with the FK constraint named exactly `tasks_assignee_id_fkey` so the
--      `assignee:profiles!tasks_assignee_id_fkey(full_name)` PostgREST hint
--      resolves.
--   2. Backfills `assignee_id` from each task's owning user via profiles.user_id
--      so existing tasks show up correctly under "My open tasks".
--   3. Adds the matching index for the OR-filter the widget uses.
--   4. NOTIFY pgrst so the schema cache picks up the new relation.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid;

-- Backfill before locking the FK so existing rows are valid.
UPDATE public.tasks t
   SET assignee_id = p.id
  FROM public.profiles p
 WHERE t.assignee_id IS NULL
   AND p.user_id = t.user_id;

-- Add the named FK constraint (idempotent — wrap in DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tasks_assignee_id_fkey'
       AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_assignee_id_fkey
      FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee
  ON public.tasks(assignee_id) WHERE assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status
  ON public.tasks(assignee_id, status) WHERE status != 'completed';

NOTIFY pgrst, 'reload schema';
