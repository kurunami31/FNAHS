-- Allow public (anon) visitors to read aggregate enrollment counts so the
-- population breakdown can render on the public home page. It only returns
-- per-year-level counts — no personal data.
grant execute on function public.population_breakdown() to anon, authenticated;