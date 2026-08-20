-- StageCue: sistema de operação de som para teatro
-- Tabela de espetáculos (shows). Os cues ficam em JSONB para salvar/carregar atomicamente.
create table if not exists public.stagecue_shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{"cues":[],"masterDb":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stagecue_shows_user_idx on public.stagecue_shows(user_id);

alter table public.stagecue_shows enable row level security;

create policy "stagecue_shows_select" on public.stagecue_shows
  for select using (auth.uid() = user_id);
create policy "stagecue_shows_insert" on public.stagecue_shows
  for insert with check (auth.uid() = user_id);
create policy "stagecue_shows_update" on public.stagecue_shows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "stagecue_shows_delete" on public.stagecue_shows
  for delete using (auth.uid() = user_id);

-- Bucket privado de áudio; cada usuário só acessa a própria pasta (uid/...)
insert into storage.buckets (id, name, public)
values ('stagecue-audio', 'stagecue-audio', false)
on conflict (id) do nothing;

create policy "stagecue_audio_select" on storage.objects
  for select using (
    bucket_id = 'stagecue-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "stagecue_audio_insert" on storage.objects
  for insert with check (
    bucket_id = 'stagecue-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "stagecue_audio_update" on storage.objects
  for update using (
    bucket_id = 'stagecue-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "stagecue_audio_delete" on storage.objects
  for delete using (
    bucket_id = 'stagecue-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
