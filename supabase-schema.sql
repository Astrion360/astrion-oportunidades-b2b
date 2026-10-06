-- ============================================================================
-- ASTRION | GESTÃO DE OPORTUNIDADES B2B
-- Estrutura, autenticação, histórico e segurança por perfil (RLS)
-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. Perfis de acesso ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Novo usuário',
  email text,
  role text not null default 'submitter' check (role in ('admin', 'collaborator', 'submitter')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfis da plataforma: administrador, gestor comercial ou cadastrador.';

-- O primeiro usuário criado torna-se administrador. Os seguintes entram como
-- cadastradores, podendo apenas registrar e acompanhar suas próprias indicações.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role text;
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    assigned_role := 'admin';
  else
    assigned_role := 'submitter';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'Novo usuário'),
    new.email,
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Função segura usada pelas políticas. A autorização não depende de dados que
-- o próprio usuário possa alterar no token ou na interface.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid()) and active = true;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- 2. Oportunidades ------------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  cnpj text,
  website text,
  segment text,
  channel text not null default 'B2B',
  source text,
  client_base bigint check (client_base is null or client_base >= 0),
  contact_name text,
  contact_role text,
  contact_email text,
  contact_phone text,
  summary text not null,
  particularities text,
  interests text[] not null default '{}',
  potential_revenue numeric(16,2) not null default 0 check (potential_revenue >= 0),
  expected_sales numeric(18,2) not null default 0 check (expected_sales >= 0),
  status text not null default 'Nova' check (status in (
    'Nova', 'Qualificação', 'Diagnóstico', 'Proposta', 'Negociação',
    'Jurídico / Compliance', 'Implantação', 'Ganha', 'Pausada', 'Perdida'
  )),
  priority text not null default 'Média' check (priority in ('Alta', 'Média', 'Baixa')),
  probability smallint not null default 10 check (probability between 0 and 100),
  owner_id uuid references public.profiles(id) on delete set null,
  next_action text,
  next_action_date timestamptz,
  meeting_date timestamptz,
  expected_close_date date,
  document_link text,
  loss_reason text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_status_idx on public.opportunities(status);
create index if not exists opportunities_owner_idx on public.opportunities(owner_id);
create index if not exists opportunities_created_by_idx on public.opportunities(created_by);
create index if not exists opportunities_next_action_idx on public.opportunities(next_action_date);
create index if not exists opportunities_updated_idx on public.opportunities(updated_at desc);

-- 3. Atividades e histórico ---------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  type text not null check (type in ('Nota', 'Ligação', 'E-mail', 'Reunião', 'Tarefa')),
  description text not null,
  activity_date timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists activities_opportunity_idx on public.activities(opportunity_id, activity_date desc);

create table if not exists public.opportunity_history (
  id bigint generated by default as identity primary key,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  event_type text not null,
  description text,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists history_opportunity_idx on public.opportunity_history(opportunity_id, created_at desc);

-- Atualização automática de timestamps.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities
for each row execute procedure public.set_updated_at();

-- Auditoria automática: registra cadastro, mudança de status e demais edições.
create or replace function public.audit_opportunity_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  event_name text;
  event_description text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
    event_description := 'Oportunidade cadastrada';
    insert into public.opportunity_history
      (opportunity_id, event_type, description, old_data, new_data, changed_by)
    values
      (new.id, event_name, event_description, null, to_jsonb(new), (select auth.uid()));
    return new;
  end if;

  if old.status is distinct from new.status then
    event_name := 'status_changed';
    event_description := format('Status alterado de %s para %s', old.status, new.status);
  else
    event_name := 'updated';
    event_description := 'Cadastro atualizado';
  end if;

  insert into public.opportunity_history
    (opportunity_id, event_type, description, old_data, new_data, changed_by)
  values
    (new.id, event_name, event_description, to_jsonb(old), to_jsonb(new), (select auth.uid()));
  return new;
end;
$$;

drop trigger if exists opportunities_audit on public.opportunities;
create trigger opportunities_audit
  after insert or update on public.opportunities
  for each row execute procedure public.audit_opportunity_change();

-- 4. Segurança em nível de linha (RLS) ---------------------------------------
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.opportunity_history enable row level security;

-- Perfis: cada pessoa vê o próprio perfil; gestores veem a equipe; somente o
-- administrador altera níveis e situação.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_role()) in ('admin', 'collaborator')
);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
for update to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

-- Oportunidades: gestores operam toda a carteira; cadastradores veem e podem
-- corrigir somente seus próprios registros enquanto ainda estiverem em Nova.
drop policy if exists "opportunities_select" on public.opportunities;
create policy "opportunities_select" on public.opportunities
for select to authenticated
using (
  (select public.current_user_role()) in ('admin', 'collaborator')
  or created_by = (select auth.uid())
);

drop policy if exists "opportunities_insert" on public.opportunities;
create policy "opportunities_insert" on public.opportunities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select public.current_user_role()) is not null
);

drop policy if exists "opportunities_manager_update" on public.opportunities;
create policy "opportunities_manager_update" on public.opportunities
for update to authenticated
using ((select public.current_user_role()) in ('admin', 'collaborator'))
with check ((select public.current_user_role()) in ('admin', 'collaborator'));

drop policy if exists "opportunities_submitter_update" on public.opportunities;
create policy "opportunities_submitter_update" on public.opportunities
for update to authenticated
using (
  created_by = (select auth.uid())
  and status = 'Nova'
  and (select public.current_user_role()) = 'submitter'
)
with check (
  created_by = (select auth.uid())
  and status = 'Nova'
  and owner_id is null
  and (select public.current_user_role()) = 'submitter'
);

drop policy if exists "opportunities_admin_delete" on public.opportunities;
create policy "opportunities_admin_delete" on public.opportunities
for delete to authenticated
using ((select public.current_user_role()) = 'admin');

-- Atividades: gestores registram a condução. O cadastrador pode consultar as
-- movimentações apenas de oportunidades criadas por ele.
drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
for select to authenticated
using (
  (select public.current_user_role()) in ('admin', 'collaborator')
  or exists (
    select 1 from public.opportunities o
    where o.id = activities.opportunity_id and o.created_by = (select auth.uid())
  )
);

drop policy if exists "activities_manager_insert" on public.activities;
create policy "activities_manager_insert" on public.activities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select public.current_user_role()) in ('admin', 'collaborator')
);

drop policy if exists "activities_manager_update" on public.activities;
create policy "activities_manager_update" on public.activities
for update to authenticated
using ((select public.current_user_role()) in ('admin', 'collaborator'))
with check ((select public.current_user_role()) in ('admin', 'collaborator'));

drop policy if exists "activities_admin_delete" on public.activities;
create policy "activities_admin_delete" on public.activities
for delete to authenticated
using ((select public.current_user_role()) = 'admin');

drop policy if exists "history_select" on public.opportunity_history;
create policy "history_select" on public.opportunity_history
for select to authenticated
using (
  (select public.current_user_role()) in ('admin', 'collaborator')
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_history.opportunity_id and o.created_by = (select auth.uid())
  )
);

-- Camada de privilégios da API. As políticas acima continuam sendo a barreira
-- final para cada registro.
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select on public.opportunity_history to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Impede acesso anônimo aos dados mesmo que a chave pública seja conhecida.
revoke all on public.profiles from anon;
revoke all on public.opportunities from anon;
revoke all on public.activities from anon;
revoke all on public.opportunity_history from anon;

-- Opcional: caso usuários tenham sido criados antes da execução deste arquivo,
-- o comando abaixo recria os perfis ausentes. O primeiro torna-se administrador.
insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1), 'Novo usuário'),
  u.email,
  case when not exists (select 1 from public.profiles where role = 'admin')
       and row_number() over (order by u.created_at) = 1 then 'admin'
       else 'submitter' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Verificação rápida esperada: tabelas criadas, RLS ativo e políticas presentes.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'opportunities', 'activities', 'opportunity_history')
order by tablename;

-- 5. Endurecimento e otimização ------------------------------------------------
-- As funções auxiliares ficam em um schema não exposto pela API. Assim, elas
-- continuam disponíveis para triggers e políticas sem criar endpoints RPC.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid()) and active = true;
$$;

revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role text;
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    assigned_role := 'admin';
  else
    assigned_role := 'submitter';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'Novo usuário'),
    new.email,
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create or replace function private.audit_opportunity_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  event_name text;
  event_description text;
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_history
      (opportunity_id, event_type, description, old_data, new_data, changed_by)
    values
      (new.id, 'created', 'Oportunidade cadastrada', null, to_jsonb(new), (select auth.uid()));
    return new;
  end if;

  if old.status is distinct from new.status then
    event_name := 'status_changed';
    event_description := format('Status alterado de %s para %s', old.status, new.status);
  else
    event_name := 'updated';
    event_description := 'Cadastro atualizado';
  end if;

  insert into public.opportunity_history
    (opportunity_id, event_type, description, old_data, new_data, changed_by)
  values
    (new.id, event_name, event_description, to_jsonb(old), to_jsonb(new), (select auth.uid()));
  return new;
end;
$$;

revoke all on function private.audit_opportunity_change() from public, anon, authenticated;

-- Triggers passam a usar somente as funções privadas.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure private.set_updated_at();

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities
for each row execute procedure private.set_updated_at();

drop trigger if exists opportunities_audit on public.opportunities;
create trigger opportunities_audit
  after insert or update on public.opportunities
  for each row execute procedure private.audit_opportunity_change();

-- Recriação das políticas com a função privada e uma única política de UPDATE.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_role()) in ('admin', 'collaborator')
);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
for update to authenticated
using ((select private.current_user_role()) = 'admin')
with check ((select private.current_user_role()) = 'admin');

drop policy if exists "opportunities_select" on public.opportunities;
create policy "opportunities_select" on public.opportunities
for select to authenticated
using (
  (select private.current_user_role()) in ('admin', 'collaborator')
  or created_by = (select auth.uid())
);

drop policy if exists "opportunities_insert" on public.opportunities;
create policy "opportunities_insert" on public.opportunities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.current_user_role()) is not null
);

drop policy if exists "opportunities_manager_update" on public.opportunities;
drop policy if exists "opportunities_submitter_update" on public.opportunities;
drop policy if exists "opportunities_update" on public.opportunities;
create policy "opportunities_update" on public.opportunities
for update to authenticated
using (
  (select private.current_user_role()) in ('admin', 'collaborator')
  or (
    created_by = (select auth.uid())
    and status = 'Nova'
    and (select private.current_user_role()) = 'submitter'
  )
)
with check (
  (select private.current_user_role()) in ('admin', 'collaborator')
  or (
    created_by = (select auth.uid())
    and status = 'Nova'
    and owner_id is null
    and (select private.current_user_role()) = 'submitter'
  )
);

drop policy if exists "opportunities_admin_delete" on public.opportunities;
create policy "opportunities_admin_delete" on public.opportunities
for delete to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
for select to authenticated
using (
  (select private.current_user_role()) in ('admin', 'collaborator')
  or exists (
    select 1 from public.opportunities o
    where o.id = activities.opportunity_id and o.created_by = (select auth.uid())
  )
);

drop policy if exists "activities_manager_insert" on public.activities;
create policy "activities_manager_insert" on public.activities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.current_user_role()) in ('admin', 'collaborator')
);

drop policy if exists "activities_manager_update" on public.activities;
create policy "activities_manager_update" on public.activities
for update to authenticated
using ((select private.current_user_role()) in ('admin', 'collaborator'))
with check ((select private.current_user_role()) in ('admin', 'collaborator'));

drop policy if exists "activities_admin_delete" on public.activities;
create policy "activities_admin_delete" on public.activities
for delete to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "history_select" on public.opportunity_history;
create policy "history_select" on public.opportunity_history
for select to authenticated
using (
  (select private.current_user_role()) in ('admin', 'collaborator')
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_history.opportunity_id and o.created_by = (select auth.uid())
  )
);

-- Índices adicionais para as chaves estrangeiras utilizadas na auditoria.
create index if not exists activities_created_by_idx on public.activities(created_by);
create index if not exists history_changed_by_idx on public.opportunity_history(changed_by);

-- Remove as antigas funções públicas, agora sem dependências.
drop function if exists public.audit_opportunity_change();
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();
drop function if exists public.current_user_role();


-- 6. Revisão CRM 2026-10 -------------------------------------------------------
-- Hardening aplicado ao ambiente de produção: campos econômicos ampliados,
-- CNPJ único, cadastro somente por e-mail autorizado e restrição adicional
-- para usuários cadastradores.

alter table public.opportunities
  alter column potential_revenue type numeric(24,2),
  alter column expected_sales type numeric(24,2),
  alter column potential_revenue drop default,
  alter column expected_sales drop default,
  alter column potential_revenue drop not null,
  alter column expected_sales drop not null;

create unique index if not exists opportunities_cnpj_unique
  on public.opportunities (cnpj)
  where cnpj is not null and btrim(cnpj) <> '';

create table if not exists public.access_allowlist (
  email text primary key,
  full_name text,
  role text not null default 'submitter'
    check (role in ('admin','collaborator','submitter')),
  active boolean not null default true,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_allowlist_email_lower check (email = lower(email))
);

alter table public.access_allowlist enable row level security;

drop policy if exists "access_allowlist_admin_select" on public.access_allowlist;
create policy "access_allowlist_admin_select" on public.access_allowlist
for select to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "access_allowlist_admin_insert" on public.access_allowlist;
create policy "access_allowlist_admin_insert" on public.access_allowlist
for insert to authenticated
with check (
  (select private.current_user_role()) = 'admin'
  and created_by = (select auth.uid())
);

drop policy if exists "access_allowlist_admin_update" on public.access_allowlist;
create policy "access_allowlist_admin_update" on public.access_allowlist
for update to authenticated
using ((select private.current_user_role()) = 'admin')
with check ((select private.current_user_role()) = 'admin');

drop policy if exists "access_allowlist_admin_delete" on public.access_allowlist;
create policy "access_allowlist_admin_delete" on public.access_allowlist
for delete to authenticated
using ((select private.current_user_role()) = 'admin');

grant select, insert, update, delete on public.access_allowlist to authenticated;
revoke all on public.access_allowlist from anon;

drop trigger if exists access_allowlist_set_updated_at on public.access_allowlist;
create trigger access_allowlist_set_updated_at
before update on public.access_allowlist
for each row execute procedure private.set_updated_at();

insert into public.access_allowlist (email, full_name, role, active, used_at)
select lower(email), full_name, role, active, now()
from public.profiles
where email is not null
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = excluded.active,
    used_at = coalesce(public.access_allowlist.used_at, excluded.used_at);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, private
as $$
declare
  invite public.access_allowlist%rowtype;
begin
  select *
    into invite
    from public.access_allowlist
   where email = lower(new.email)
     and active = true;

  if invite.email is null then
    raise exception 'access_not_authorized';
  end if;

  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(
      nullif(invite.full_name, ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      'Novo usuário'
    ),
    new.email,
    invite.role,
    true
  )
  on conflict (id) do nothing;

  update public.access_allowlist
     set used_at = now()
   where email = lower(new.email);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

drop policy if exists "opportunities_insert" on public.opportunities;
create policy "opportunities_insert" on public.opportunities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select private.current_user_role()) in ('admin','collaborator')
    or (
      (select private.current_user_role()) = 'submitter'
      and status = 'Nova'
      and priority = 'Média'
      and probability = 10
      and owner_id is null
      and next_action is null
      and next_action_date is null
      and meeting_date is null
      and expected_close_date is null
      and document_link is null
      and loss_reason is null
    )
  )
);

drop policy if exists "opportunities_update" on public.opportunities;
create policy "opportunities_update" on public.opportunities
for update to authenticated
using (
  (select private.current_user_role()) in ('admin','collaborator')
  or (
    created_by = (select auth.uid())
    and status = 'Nova'
    and (select private.current_user_role()) = 'submitter'
  )
)
with check (
  (select private.current_user_role()) in ('admin','collaborator')
  or (
    created_by = (select auth.uid())
    and status = 'Nova'
    and priority = 'Média'
    and probability = 10
    and owner_id is null
    and next_action is null
    and next_action_date is null
    and meeting_date is null
    and expected_close_date is null
    and document_link is null
    and loss_reason is null
    and (select private.current_user_role()) = 'submitter'
  )
);


-- 7. Modelos econômicos executivos -------------------------------------------
-- Camada nível 1 do CRM: premissas comparáveis e outputs executivos.
-- O BP completo permanece como referência para DRE, runoff, VPL, TIR e sensibilidades.

create table if not exists public.economic_models (
  model_key text primary key,
  name text not null,
  family text not null,
  description text,
  defaults jsonb not null default '{}'::jsonb,
  source_note text,
  active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.economic_models enable row level security;

drop policy if exists "economic_models_select" on public.economic_models;
create policy "economic_models_select" on public.economic_models
for select to authenticated using (active = true);

grant select on public.economic_models to authenticated;
revoke all on public.economic_models from anon;

drop trigger if exists economic_models_set_updated_at on public.economic_models;
create trigger economic_models_set_updated_at
before update on public.economic_models
for each row execute procedure private.set_updated_at();

insert into public.economic_models (model_key, name, family, description, defaults, source_note, active, sort_order)
values
('astrion_consorcios_padrao','Consórcios | Padrão Astrion','Consórcios','Modelo executivo comparável para oportunidades B2B/B2B2C de consórcios.',jsonb_build_object('conversion_rate',1.5,'average_ticket',95243,'admin_fee_rate',17,'clients_per_fte_month',250,'projection_months',12),'Padrão consolidado dos estudos Astrion; capacidade e cobertura mensal devem ser ajustadas por oportunidade.',true,10),
('pagbank_025','PagBank | 0,25% recorrente','Consórcios','Referência do balcão PagBank com remuneração recorrente Astrion.',jsonb_build_object('conversion_rate',1.75,'average_ticket',95243,'admin_fee_rate',17.5,'clients_per_fte_month',250,'astrion_revenue_rate',0.25,'projection_months',120),'Referência do simulador PagBank GOLD; premissas devem ser revalidadas antes de uso comercial.',true,20),
('pagbank_020_fee','PagBank | 0,20% + fee','Consórcios','Alternativa PagBank com remuneração recorrente menor e fee de originação.',jsonb_build_object('conversion_rate',1.75,'average_ticket',95243,'admin_fee_rate',17.5,'clients_per_fte_month',250,'astrion_revenue_rate',0.20,'upfront_fee',500000,'projection_months',120),'Alternativa discutida no modelo PagBank.',true,30),
('sofisa_bib','Sofisa / BIB | Bottom-up','Consórcios','Modelo bottom-up para bancos com distribuição via gerentes/agências e base PJ.',jsonb_build_object('conversion_rate',1.5,'average_ticket',95243,'admin_fee_rate',17,'projection_months',12),'Referência dos BPs Sofisa/BIB; capacidade comercial deve refletir gerentes, agências e abordagem.',true,40),
('fastshop_omnichannel','Fast Shop | Omnichannel','Consórcios','Modelo de distribuição omnicanal com funil por canal e potencial de acessórios.',jsonb_build_object('conversion_rate',1.5,'average_ticket',95243,'admin_fee_rate',17,'projection_months',12),'Referência do estudo Fast Shop; ajustar cobertura, canais, recorrência e acessórios.',true,50),
('ouribank_white_label','Ouribank | White Label','Consórcios','Referência para operação white label; remuneração do banco e da Astrion devem ser preenchidas conforme negociação.',jsonb_build_object('average_ticket',95243,'admin_fee_rate',17,'projection_months',60),'Estrutura de comparação Ouribank White Label.',true,60),
('ouribank_adm_propria','Ouribank | Administradora própria','Administradora própria','Referência para administradora própria com CAPEX, OPEX e receita econômica da taxa de administração.',jsonb_build_object('average_ticket',95243,'admin_fee_rate',17,'projection_months',60),'Estrutura de comparação Ouribank administradora própria; CAPEX/OPEX devem vir do BP vigente.',true,70),
('parceiros_corretores','Parceiros | Corretores e distribuição','B2B2C','Modelo simplificado para canal de parceiros/corretores.',jsonb_build_object('average_ticket',95243,'admin_fee_rate',17,'astrion_revenue_rate',1,'projection_months',12),'Referência do simulador de parceiros Astrion.',true,80),
('custom','Personalizado','Personalizado','Modelo sem premissas pré-carregadas.','{}'::jsonb,'Preenchimento livre.',true,999)
on conflict (model_key) do update
set name=excluded.name, family=excluded.family, description=excluded.description,
    defaults=excluded.defaults, source_note=excluded.source_note, active=excluded.active,
    sort_order=excluded.sort_order, updated_at=now();

create table if not exists public.opportunity_economics (
  opportunity_id uuid primary key references public.opportunities(id) on delete cascade,
  model_key text not null references public.economic_models(model_key),
  base_clients bigint check (base_clients is null or base_clients >= 0),
  treatment_rate_month numeric(8,4) check (treatment_rate_month is null or (treatment_rate_month >= 0 and treatment_rate_month <= 100)),
  fte_count numeric(10,2) check (fte_count is null or fte_count >= 0),
  clients_per_fte_month integer check (clients_per_fte_month is null or clients_per_fte_month >= 0),
  conversion_rate numeric(8,4) check (conversion_rate is null or (conversion_rate >= 0 and conversion_rate <= 100)),
  average_ticket numeric(24,2) check (average_ticket is null or average_ticket >= 0),
  admin_fee_rate numeric(8,4) check (admin_fee_rate is null or (admin_fee_rate >= 0 and admin_fee_rate <= 100)),
  astrion_revenue_rate numeric(8,4) check (astrion_revenue_rate is null or (astrion_revenue_rate >= 0 and astrion_revenue_rate <= 100)),
  upfront_fee numeric(24,2) check (upfront_fee is null or upfront_fee >= 0),
  projection_months integer check (projection_months is null or projection_months between 1 and 600),
  capex numeric(24,2) check (capex is null or capex >= 0),
  monthly_opex numeric(24,2) check (monthly_opex is null or monthly_opex >= 0),
  accessory_monthly_revenue numeric(24,2) check (accessory_monthly_revenue is null or accessory_monthly_revenue >= 0),
  notes text,
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunity_economics enable row level security;

drop policy if exists "opportunity_economics_select" on public.opportunity_economics;
create policy "opportunity_economics_select" on public.opportunity_economics
for select to authenticated
using ((select private.current_user_role()) in ('admin','collaborator'));

drop policy if exists "opportunity_economics_insert" on public.opportunity_economics;
create policy "opportunity_economics_insert" on public.opportunity_economics
for insert to authenticated
with check ((select private.current_user_role()) in ('admin','collaborator') and updated_by = (select auth.uid()));

drop policy if exists "opportunity_economics_update" on public.opportunity_economics;
create policy "opportunity_economics_update" on public.opportunity_economics
for update to authenticated
using ((select private.current_user_role()) in ('admin','collaborator'))
with check ((select private.current_user_role()) in ('admin','collaborator') and updated_by = (select auth.uid()));

drop policy if exists "opportunity_economics_delete" on public.opportunity_economics;
create policy "opportunity_economics_delete" on public.opportunity_economics
for delete to authenticated
using ((select private.current_user_role()) = 'admin');

grant select, insert, update, delete on public.opportunity_economics to authenticated;
revoke all on public.opportunity_economics from anon;

drop trigger if exists opportunity_economics_set_updated_at on public.opportunity_economics;
create trigger opportunity_economics_set_updated_at
before update on public.opportunity_economics
for each row execute procedure private.set_updated_at();

create index if not exists opportunity_economics_model_key_idx
on public.opportunity_economics(model_key);


create index if not exists access_allowlist_created_by_idx
on public.access_allowlist(created_by);

create index if not exists opportunity_economics_updated_by_idx
on public.opportunity_economics(updated_by);


-- 8. Outputs de BP e rastreabilidade -----------------------------------------
-- Guarda outputs diretos de BPs/modelos específicos sem substituir as
-- premissas parametrizadas. Permite distinguir BP real de estimativa automática.

alter table public.opportunity_economics
  add column if not exists source_type text,
  add column if not exists source_reference text,
  add column if not exists source_date date,
  add column if not exists year1_production numeric(24,2),
  add column if not exists year1_operation_revenue numeric(24,2),
  add column if not exists year1_astrion_revenue numeric(24,2),
  add column if not exists horizon_production numeric(24,2),
  add column if not exists horizon_operation_revenue numeric(24,2),
  add column if not exists horizon_astrion_revenue numeric(24,2),
  add column if not exists bp_kpis jsonb not null default '{}'::jsonb;

alter table public.opportunity_economics
  drop constraint if exists opportunity_economics_source_type_check;

alter table public.opportunity_economics
  add constraint opportunity_economics_source_type_check
  check (source_type is null or source_type in ('BP_REAL','MODELO_ESPECIFICO','ESTIMATIVA_PADRAO'));

update public.economic_models
set defaults = jsonb_build_object(
      'treatment_rate_month', 0.04,
      'conversion_rate', 1.5,
      'average_ticket', 95243,
      'admin_fee_rate', 17,
      'astrion_revenue_rate', 0.25,
      'projection_months', 12
    ),
    description = 'Estimativa padronizada para oportunidades ainda sem BP: escala linear pela base de clientes, sem teto artificial de operadores.',
    source_note = 'Premissas Astrion: 0,04% da base tratada/mês; conversão 1,5%; ticket R$ 95.243; TA 17%; remuneração Astrion 0,25% da produção. Usar apenas até existir BP específico.'
where model_key = 'astrion_consorcios_padrao';
