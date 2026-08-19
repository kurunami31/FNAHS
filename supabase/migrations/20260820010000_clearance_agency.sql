-- Clearance form now matches the official FNAHS "Clearance Form.docx":
-- the duty table carries an AGENCY column between HOURS and DATE OF CLEARANCE.
alter table public.clearance_rows add column if not exists agency text;

-- include agency in the json used by get_clearance_forms
create or replace function public.clearance_rows_json(p_form_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(j), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id,
      'form_id', r.form_id,
      'dates', r.dates,
      'concept', r.concept,
      'hours', r.hours,
      'agency', r.agency,
      'cleared_at', r.cleared_at,
      'remark', r.remark,
      'demerit', r.demerit,
      'days_extension', r.days_extension,
      'merit', r.merit,
      'recorded_by', r.recorded_by,
      'recorded_by_name', rec.full_name,
      'created_by', r.created_by,
      'updated_by', r.updated_by,
      'updated_by_name', up.full_name,
      'created_at', r.created_at
    ) j
    from public.clearance_rows r
    left join public.profiles rec on rec.id = r.recorded_by
    left join public.profiles up on up.id = r.updated_by
    where r.form_id = p_form_id
    order by r.created_at, r.id
  ) sub;
$$;