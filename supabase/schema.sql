create extension if not exists "pgcrypto";

create table if not exists public.estagiarias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  faculdade text not null,
  dias_estagio text not null,
  observacoes text,
  data_recebimento date,
  data_limite date,
  data_devolucao date,
  -- Exemplo de registros: [{"day":"2026-04-07","tipo":"falta"}]
  registros jsonb not null default '[]'::jsonb,
  -- Exemplo de formações: [{"nome":"Oficina X","data":"2026-04-10","presente":true}]
  formacoes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_estagiarias_updated_at on public.estagiarias;
create trigger trg_estagiarias_updated_at
before update on public.estagiarias
for each row execute function public.set_updated_at();

alter table public.estagiarias enable row level security;

drop policy if exists "estagiarias_select_own" on public.estagiarias;
create policy "estagiarias_select_own"
on public.estagiarias
for select
using (user_id = auth.uid());

drop policy if exists "estagiarias_insert_own" on public.estagiarias;
create policy "estagiarias_insert_own"
on public.estagiarias
for insert
with check (user_id = auth.uid());

drop policy if exists "estagiarias_update_own" on public.estagiarias;
create policy "estagiarias_update_own"
on public.estagiarias
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "estagiarias_delete_own" on public.estagiarias;
create policy "estagiarias_delete_own"
on public.estagiarias
for delete
using (user_id = auth.uid());

-- Habilita eventos Realtime da tabela no canal postgres_changes.
do $$
begin
  alter publication supabase_realtime add table public.estagiarias;
exception
  when duplicate_object then null;
end;
$$;
