-- Sistema MPA Projeto: estrutura no Supabase (rode uma vez em SQL Editor > New query > Run).
create table if not exists registros (
  colecao text not null,
  id text not null,
  empresa_id text,
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (colecao, id)
);
create index if not exists registros_empresa on registros (colecao, empresa_id);

-- Só o servidor do app (chave service_role) acessa. Nenhum acesso público.
alter table registros enable row level security;

-- Pasta privada para plantas e documentos gerados.
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', false) on conflict (id) do nothing;
