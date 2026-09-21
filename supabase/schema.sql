-- CSN Pass-Line: schema Supabase (Postgres)
-- Rode isso no SQL editor do Supabase depois de criar o projeto.

create table if not exists tecnicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text not null unique,
  funcao text not null,
  pin_hash text not null,
  criado_em timestamptz not null default now()
);

create table if not exists sessoes_medicao (
  id uuid primary key,
  tipo_ficha text not null check (tipo_ficha in (
    'PASS_LINE_DESEMPENADEIRA', 'GAP', 'EMPENO_DESGASTE', 'PASS_LINE_SEGMENTOS'
  )),
  maquina text not null check (maquina in ('MCC2', 'MCC3')),
  veio text not null check (veio in ('C', 'D', 'E', 'F')),
  data date not null,
  tecnico_id uuid references tecnicos(id),
  tecnico_nome text not null,
  tecnico_matricula text not null,
  tecnico_funcao text not null,
  observacao text,
  inspecionado_por text,
  liberado_por text,
  criado_em timestamptz not null,
  sincronizado_em timestamptz not null default now()
);

create table if not exists linhas_pass_line_desempenadeira (
  id bigint generated always as identity primary key,
  sessao_id uuid references sessoes_medicao(id) on delete cascade,
  n_cad int not null,
  oeste_medida numeric,
  oeste_acionado numeric,
  oeste_ajuste numeric,
  leste_medida numeric,
  leste_acionado numeric,
  leste_ajuste numeric
);

create table if not exists linhas_gap (
  id bigint generated always as identity primary key,
  sessao_id uuid references sessoes_medicao(id) on delete cascade,
  n_cad int not null,
  gap_nominal numeric not null,
  tolerancia_mm numeric not null,
  primeira_acionado numeric,
  primeira_centro numeric,
  primeira_nao_acionado numeric,
  ajuste_acionado numeric,
  ajuste_nao_acionado numeric,
  segunda_acionado numeric,
  segunda_centro numeric,
  segunda_nao_acionado numeric
);

create table if not exists linhas_empeno_desgaste (
  id bigint generated always as identity primary key,
  sessao_id uuid references sessoes_medicao(id) on delete cascade,
  n_cad int not null,
  empeno_superior numeric,
  empeno_inferior numeric,
  empeno_par numeric,
  desgaste_superior numeric,
  desgaste_inferior numeric,
  desgaste_par numeric
);

create table if not exists leituras_segmentos (
  id bigint generated always as identity primary key,
  sessao_id uuid references sessoes_medicao(id) on delete cascade,
  segmento text not null,
  lado text not null check (lado in ('ACIONADO', 'NAO_ACIONADO')),
  posicao int not null,
  valor numeric
);

create index if not exists idx_sessoes_data on sessoes_medicao(data);
create index if not exists idx_sessoes_maquina_veio on sessoes_medicao(maquina, veio);
create index if not exists idx_sessoes_tecnico on sessoes_medicao(tecnico_id);
