-- Pesquisa Kiro: banco no Supabase.
-- ANTES DE RODAR: troque SUA-CHAVE-DO-DASHBOARD (linha do INSERT) por uma senha com 16+ caracteres.
-- Rode tudo no SQL Editor do Supabase.

create table if not exists public.respostas (
  id          uuid primary key default gen_random_uuid(),
  criado_em   timestamptz not null default now(),
  nome        text not null,
  empresa     text not null,
  email       text not null,
  duracao_seg integer,
  respostas   jsonb not null,
  outros      jsonb not null default '{}'::jsonb
);

create table if not exists public.config (
  chave text primary key,
  valor text not null
);

-- RLS ligado e sem nenhuma policy: ninguém lê nem escreve direto nas tabelas pela API.
-- O acesso acontece apenas pelas duas funções abaixo.
alter table public.respostas enable row level security;
alter table public.config    enable row level security;
revoke all on public.respostas from anon, authenticated;
revoke all on public.config    from anon, authenticated;

insert into public.config (chave, valor)
values ('admin_key', 'SUA-CHAVE-DO-DASHBOARD')
on conflict (chave) do nothing;

-- Qualquer pessoa com o link do formulário pode enviar uma resposta.
create or replace function public.enviar_resposta(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome    text;
  v_empresa text;
  v_email   text;
  v_dur     integer;
begin
  if jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Dados inválidos.';
  end if;
  if length(p::text) > 60000 then
    raise exception 'Resposta muito grande.';
  end if;

  v_nome    := left(regexp_replace(btrim(coalesce(p->>'nome', '')),    '\s+', ' ', 'g'), 120);
  v_empresa := left(regexp_replace(btrim(coalesce(p->>'empresa', '')), '\s+', ' ', 'g'), 120);
  v_email   := lower(left(btrim(coalesce(p->>'email', '')), 160));

  if v_nome = ''    then raise exception 'Informe seu nome.';    end if;
  if v_empresa = '' then raise exception 'Informe sua empresa.'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if jsonb_typeof(p->'respostas') is distinct from 'object' then
    raise exception 'Responda o questionário.';
  end if;
  if p ? 'outros' and jsonb_typeof(p->'outros') is distinct from 'object' then
    raise exception 'Dados inválidos.';
  end if;

  if (p->>'duracaoSeg') ~ '^[0-9]{1,6}$' then
    v_dur := least((p->>'duracaoSeg')::integer, 86400);
  end if;

  insert into public.respostas (nome, empresa, email, duracao_seg, respostas, outros)
  values (v_nome, v_empresa, v_email, v_dur, p->'respostas', coalesce(p->'outros', '{}'::jsonb));
end;
$$;

-- Só quem tem a chave do dashboard consegue listar as respostas.
create or replace function public.listar_respostas(p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select c.valor into v_key from public.config c where c.chave = 'admin_key';

  if v_key is null
     or length(v_key) < 16
     or v_key = 'SUA-CHAVE-DO-DASHBOARD'
     or p_chave is distinct from v_key then
    raise sqlstate 'PT401' using message = 'Não autorizado.';
  end if;

  return coalesce(
    (select jsonb_agg(
              jsonb_build_object(
                'id', r.id,
                'criadoEm', r.criado_em,
                'nome', r.nome,
                'empresa', r.empresa,
                'email', r.email,
                'duracaoSeg', r.duracao_seg,
                'respostas', r.respostas,
                'outros', r.outros)
            order by r.criado_em)
       from public.respostas r),
    '[]'::jsonb);
end;
$$;

revoke all on function public.enviar_resposta(jsonb) from public;
revoke all on function public.listar_respostas(text) from public;
grant execute on function public.enviar_resposta(jsonb) to anon, authenticated;
grant execute on function public.listar_respostas(text) to anon, authenticated;
