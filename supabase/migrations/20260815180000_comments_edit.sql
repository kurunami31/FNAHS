-- authors and staff (moderator/superadmin) may edit comments, mirroring posts
alter table public.comments enable row level security;

drop policy if exists "authors or staff can update comments" on public.comments;
create policy "authors or staff can update comments"
  on public.comments for update
  using (
    auth.uid() = user_id
    or (select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin')
  );

grant update on public.comments to authenticated;
