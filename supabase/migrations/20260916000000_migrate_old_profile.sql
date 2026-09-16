-- Run this in Supabase SQL Editor to add the migration function
CREATE OR REPLACE FUNCTION public.migrate_old_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new UUID := auth.uid();
  v_new_email TEXT;
  v_old_id UUID;
  v_old_rec RECORD;
BEGIN
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT email INTO v_new_email FROM public.profiles WHERE id = v_new;
  IF v_new_email IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  SELECT id INTO v_old_id FROM public.profiles WHERE email = v_new_email AND id <> v_new LIMIT 1;
  IF v_old_id IS NULL THEN
    RAISE NOTICE 'no old profile found for %', v_new_email;
    RETURN;
  END IF;

  RAISE NOTICE 'migrating old profile % -> %', v_old_id, v_new;

  SELECT full_name, program, year_level, role, positions, avatar_url, id_no, section, surname, requested_role, clearance_locked
  INTO v_old_rec FROM public.profiles WHERE id = v_old_id;

  UPDATE public.profiles SET
    full_name = COALESCE(v_old_rec.full_name, ''),
    program = COALESCE(v_old_rec.program, program),
    year_level = COALESCE(v_old_rec.year_level, year_level),
    role = COALESCE(v_old_rec.role, role),
    positions = COALESCE(v_old_rec.positions, positions),
    avatar_url = COALESCE(v_old_rec.avatar_url, avatar_url),
    id_no = COALESCE(v_old_rec.id_no, id_no),
    section = COALESCE(v_old_rec.section, section),
    surname = COALESCE(v_old_rec.surname, surname),
    requested_role = v_old_rec.requested_role,
    clearance_locked = v_old_rec.clearance_locked
  WHERE id = v_new;

  UPDATE public.attendance SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.rsvps SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.post_likes SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.chat_messages SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.notifications SET user_id = v_new WHERE user_id = v_old_id;

  DELETE FROM public.profiles WHERE id = v_old_id;

  RAISE NOTICE 'migration complete for %', v_new_email;
END;
$function$;
