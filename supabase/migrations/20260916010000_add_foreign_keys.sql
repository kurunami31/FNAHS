-- Add all missing FK constraints for PostgREST nested selects
-- Uses NOT VALID for user_id → profiles FKs (orphaned rows will be fixed by migrate_old_profile)

-- Step 1: Drop any constraints from prior partial runs
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT conname, conrelid::regclass AS tbl FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND contype = 'f'
    AND conname IN (
      'posts_user_id_fkey','comments_post_id_fkey','comments_user_id_fkey','comments_parent_id_fkey',
      'post_likes_post_id_fkey','post_likes_user_id_fkey','events_created_by_fkey',
      'rsvps_event_id_fkey','rsvps_user_id_fkey','attendance_event_id_fkey','attendance_user_id_fkey',
      'fee_payments_member_id_fkey','fee_payments_recorded_by_fkey',
      'event_payments_event_id_fkey','event_payments_member_id_fkey','event_payments_recorded_by_fkey',
      'audit_logs_actor_id_fkey','clearance_forms_member_id_fkey','clearance_forms_created_by_fkey',
      'clearance_rows_form_id_fkey','clearance_rows_recorded_by_fkey','clearance_rows_created_by_fkey','clearance_rows_updated_by_fkey',
      'faculty_subjects_faculty_id_fkey','class_sessions_subject_id_fkey','class_sessions_faculty_id_fkey',
      'class_attendance_session_id_fkey','class_attendance_user_id_fkey',
      'notifications_user_id_fkey','chat_messages_user_id_fkey',
      'announcements_author_id_fkey','app_settings_updated_by_fkey',
      'event_polls_event_id_fkey','poll_options_poll_id_fkey','poll_votes_option_id_fkey','poll_votes_user_id_fkey',
      'report_connectors_updated_by_fkey'
    )
  LOOP
    EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT IF EXISTS ' || r.conname;
  END LOOP;
END $$;

-- Step 2: Null out references to missing profiles (safe columns only)
UPDATE public.events SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.announcements SET author_id = NULL WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM public.profiles);
UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id IS NOT NULL AND actor_id NOT IN (SELECT id FROM public.profiles);
UPDATE public.app_settings SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.clearance_forms SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.clearance_rows SET recorded_by = NULL WHERE recorded_by IS NOT NULL AND recorded_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.clearance_rows SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.clearance_rows SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.fee_payments SET recorded_by = NULL WHERE recorded_by IS NOT NULL AND recorded_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.event_payments SET recorded_by = NULL WHERE recorded_by IS NOT NULL AND recorded_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.report_connectors SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.class_sessions SET faculty_id = NULL WHERE faculty_id IS NOT NULL AND faculty_id NOT IN (SELECT id FROM public.profiles);
UPDATE public.faculty_subjects SET faculty_id = NULL WHERE faculty_id IS NOT NULL AND faculty_id NOT IN (SELECT id FROM public.profiles);

-- Step 3: Add FK constraints
-- Table-to-table FKs (data is clean, add normally)
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.clearance_forms(id) ON DELETE CASCADE;
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.faculty_subjects(id) ON DELETE CASCADE;
ALTER TABLE public.class_attendance ADD CONSTRAINT class_attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.event_polls ADD CONSTRAINT event_polls_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.poll_options ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.event_polls(id) ON DELETE CASCADE;
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.poll_options(id) ON DELETE CASCADE;

-- user_id → profiles FKs: use NOT VALID (orphaned rows exist, will be relinked by migrate_old_profile)
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.class_attendance ADD CONSTRAINT class_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.clearance_forms ADD CONSTRAINT clearance_forms_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.faculty_subjects ADD CONSTRAINT faculty_subjects_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- recorded_by / updated_by → profiles: nullable, use NOT VALID
ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.clearance_forms ADD CONSTRAINT clearance_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.report_connectors ADD CONSTRAINT report_connectors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
