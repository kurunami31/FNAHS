-- Add all missing foreign key constraints (PostgREST needs these for nested selects)
-- First clean up orphaned rows, then add constraints.

-- Clean orphans (tables populated but parents missing)
DELETE FROM public.post_likes WHERE post_id NOT IN (SELECT id FROM public.posts);
DELETE FROM public.comments WHERE post_id NOT IN (SELECT id FROM public.posts);
DELETE FROM public.poll_votes WHERE option_id NOT IN (SELECT id FROM public.poll_options);
DELETE FROM public.poll_options WHERE poll_id NOT IN (SELECT id FROM public.event_polls);
DELETE FROM public.class_attendance WHERE session_id NOT IN (SELECT id FROM public.class_sessions);
DELETE FROM public.class_sessions WHERE subject_id NOT IN (SELECT id FROM public.faculty_subjects);
DELETE FROM public.clearance_rows WHERE form_id NOT IN (SELECT id FROM public.clearance_forms);
DELETE FROM public.event_payments WHERE event_id NOT IN (SELECT id FROM public.events);
DELETE FROM public.event_polls WHERE event_id NOT IN (SELECT id FROM public.events);

-- Profiles FK (to auth.users — already created by schema, skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_user_id_fkey') THEN
    ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_post_id_fkey') THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_user_id_fkey') THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_parent_id_fkey') THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_likes_post_id_fkey') THEN
    ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_likes_user_id_fkey') THEN
    ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_created_by_fkey') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rsvps_event_id_fkey') THEN
    ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rsvps_user_id_fkey') THEN
    ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_event_id_fkey') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_user_id_fkey') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_member_id_fkey') THEN
    ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_recorded_by_fkey') THEN
    ALTER TABLE public.fee_payments ADD CONSTRAINT fee_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_payments_event_id_fkey') THEN
    ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_payments_member_id_fkey') THEN
    ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_payments_recorded_by_fkey') THEN
    ALTER TABLE public.event_payments ADD CONSTRAINT event_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_actor_id_fkey') THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clearance_forms_member_id_fkey') THEN
    ALTER TABLE public.clearance_forms ADD CONSTRAINT clearance_forms_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clearance_forms_created_by_fkey') THEN
    ALTER TABLE public.clearance_forms ADD CONSTRAINT clearance_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clearance_rows_form_id_fkey') THEN
    ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.clearance_forms(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clearance_rows_recorded_by_fkey') THEN
    ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clearance_rows_created_by_fkey') THEN
    ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clearance_rows_updated_by_fkey') THEN
    ALTER TABLE public.clearance_rows ADD CONSTRAINT clearance_rows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'faculty_subjects_faculty_id_fkey') THEN
    ALTER TABLE public.faculty_subjects ADD CONSTRAINT faculty_subjects_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sessions_subject_id_fkey') THEN
    ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.faculty_subjects(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sessions_faculty_id_fkey') THEN
    ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_attendance_session_id_fkey') THEN
    ALTER TABLE public.class_attendance ADD CONSTRAINT class_attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_attendance_user_id_fkey') THEN
    ALTER TABLE public.class_attendance ADD CONSTRAINT class_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_user_id_fkey') THEN
    ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_author_id_fkey') THEN
    ALTER TABLE public.announcements ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_updated_by_fkey') THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_polls_event_id_fkey') THEN
    ALTER TABLE public.event_polls ADD CONSTRAINT event_polls_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poll_options_poll_id_fkey') THEN
    ALTER TABLE public.poll_options ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.event_polls(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poll_votes_option_id_fkey') THEN
    ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.poll_options(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poll_votes_user_id_fkey') THEN
    ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_connectors_updated_by_fkey') THEN
    ALTER TABLE public.report_connectors ADD CONSTRAINT report_connectors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Force PostgREST to reload its schema cache
SELECT pg_notify('pgrst', 'reload schema');
