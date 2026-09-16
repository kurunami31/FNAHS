-- Add all FK constraints for PostgREST nested selects
-- Handles: orphan cleanup, NOT VALID for user_id→profiles, schema reload

-- 0: Drop ALL target constraints first (handles partial prior runs)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    JOIN pg_namespace n ON c.connamespace = n.oid
    WHERE n.nspname = 'public' AND c.contype = 'f'
  LOOP
    EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 1: Clean orphaned rows (parents don't exist)
DELETE FROM public.post_likes WHERE post_id NOT IN (SELECT id FROM public.posts);
DELETE FROM public.comments WHERE post_id NOT IN (SELECT id FROM public.posts);
DELETE FROM public.poll_votes WHERE option_id NOT IN (SELECT id FROM public.poll_options);
DELETE FROM public.poll_options WHERE poll_id NOT IN (SELECT id FROM public.event_polls);
DELETE FROM public.class_attendance WHERE session_id NOT IN (SELECT id FROM public.class_sessions);
DELETE FROM public.class_sessions WHERE subject_id NOT IN (SELECT id FROM public.faculty_subjects);
DELETE FROM public.clearance_rows WHERE form_id NOT IN (SELECT id FROM public.clearance_forms);
DELETE FROM public.event_payments WHERE event_id NOT IN (SELECT id FROM public.events);
DELETE FROM public.event_polls WHERE event_id NOT IN (SELECT id FROM public.events);

-- 2: Null out nullable references to missing profiles
UPDATE public.events SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.announcements SET author_id = NULL WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM public.profiles);
UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id IS NOT NULL AND actor_id NOT IN (SELECT id FROM public.profiles);
UPDATE public.app_settings SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.fee_payments SET recorded_by = NULL WHERE recorded_by IS NOT NULL AND recorded_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.event_payments SET recorded_by = NULL WHERE recorded_by IS NOT NULL AND recorded_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.clearance_rows SET recorded_by = NULL WHERE recorded_by IS NOT NULL AND recorded_by NOT IN (SELECT id FROM public.profiles);
UPDATE public.clearance_rows SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM public.profiles);

-- 3: Add FK constraints (NOT VALID where parent rows are missing and will be relinked)

-- posts → profiles
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- comments → posts, profiles, self
ALTER TABLE public.comments ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;

-- post_likes → posts, profiles
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- events → profiles
ALTER TABLE public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- rsvps → events, profiles
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- attendance → events, profiles
ALTER TABLE public.attendance ADD CONSTRAINT attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- notifications → profiles
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- chat_messages → profiles
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- fee_payments → profiles
ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- event_payments → events, profiles
ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- audit_logs → profiles
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- clearance_forms → profiles
ALTER TABLE public.clearance_forms ADD CONSTRAINT clearance_forms_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.clearance_forms ADD CONSTRAINT clearance_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- clearance_rows → clearance_forms, profiles
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.clearance_forms(id) ON DELETE CASCADE;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- faculty_subjects → profiles
ALTER TABLE public.faculty_subjects ADD CONSTRAINT faculty_subjects_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- class_sessions → faculty_subjects, profiles
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.faculty_subjects(id) ON DELETE CASCADE;
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- class_attendance → class_sessions, profiles
ALTER TABLE public.class_attendance ADD CONSTRAINT class_attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.class_attendance ADD CONSTRAINT class_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- announcements → profiles
ALTER TABLE public.announcements ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- app_settings → profiles
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;

-- event_polls → events
ALTER TABLE public.event_polls ADD CONSTRAINT event_polls_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- poll_options → event_polls
ALTER TABLE public.poll_options ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.event_polls(id) ON DELETE CASCADE;

-- poll_votes → poll_options, profiles
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.poll_options(id) ON DELETE CASCADE;
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
