-- CSN Pass-Line: schema Supabase (Postgres)
-- Espelha o banco de produção (conferido em 28/09/2026). Rode no SQL editor
-- do Supabase pra criar um banco novo do zero.
--
-- Acesso: a chave pública (anon) só LÊ as medições. Toda escrita, e tudo de
-- técnicos, push e prazos, passa pelas rotas do servidor (src/app/api/**),
-- que usam a chave de serviço e conferem a sessão de quem pediu.

create or replace function set_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- Técnicos --------------------------------------------------------------

create table if not exists tecnicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text not null unique, -- sempre em maiúsculas
  funcao text not null,
  pin_hash text not null, -- "pbkdf2$<iterações>$<sal>$<hash>" (ver src/lib/pinHash.ts)
  criado_em timestamptz not null default now(),
  papel text not null default 'TECNICO' check (papel in ('TECNICO', 'VISUALIZADOR', 'ADMIN')),
  aprovado boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create unique index if not exists tecnicos_matricula_upper_idx on tecnicos (upper(matricula));
create trigger trg_tecnicos_atualizado_em before update on tecnicos
  for each row execute function set_atualizado_em();

-- Limite de tentativas de login por matrícula (5 erros = 15 min bloqueado).
create table if not exists login_tentativas (
  matricula text primary key,
  falhas int not null default 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

-- Medições --------------------------------------------------------------

create table if not exists sessoes_medicao (
  id uuid primary key,
  tipo_ficha text not null check (tipo_ficha in (
    'PASS_LINE_DESEMPENADEIRA', 'GAP', 'EMPENO_DESGASTE', 'PASS_LINE_SEGMENTOS'
  )),
  maquina text not null check (maquina in ('MCC2', 'MCC3', 'MCC4')),
  veio text not null check (veio in ('C', 'D', 'E', 'F', 'G', 'H')),
  data date not null,
  -- Sem chave estrangeira de propósito: excluir o cadastro de um técnico
  -- não pode apagar nem travar as medições que ele registrou.
  tecnico_id uuid,
  tecnico_nome text not null,
  tecnico_matricula text not null,
  tecnico_funcao text not null,
  observacao text,
  inspecionado_por text,
  liberado_por text,
  criado_em timestamptz not null,
  sincronizado_em timestamptz not null default now(),
  -- Horário (do servidor) da última gravação — é por ele que os aparelhos
  -- sabem se têm a versão mais nova.
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_sessoes_data on sessoes_medicao(data);
create index if not exists idx_sessoes_maquina_veio on sessoes_medicao(maquina, veio);
create index if not exists idx_sessoes_tecnico on sessoes_medicao(tecnico_id);
create trigger trg_sessoes_atualizado_em before update on sessoes_medicao
  for each row execute function set_atualizado_em();

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
  ajuste_acionado text, -- "OK" ou anotação do ajuste, não é número
  ajuste_nao_acionado text,
  segunda_acionado numeric,
  segunda_centro numeric,
  segunda_nao_acionado numeric
);

create table if not exists linhas_empeno_desgaste (
  id bigint generated always as identity primary key,
  sessao_id uuid references sessoes_medicao(id) on delete cascade,
  n_cad int not null,
  empeno_superior text, -- marcação da ficha (ex.: "AC"), não é número
  empeno_inferior text,
  empeno_par text,
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

-- Notificações ----------------------------------------------------------

create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  tecnico_id uuid,
  tecnico_nome text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

create table if not exists prazos_notificados (
  id bigint generated always as identity primary key,
  tipo_ficha text not null,
  maquina text not null,
  veio text not null,
  data_alvo date not null,
  dias_restantes int not null,
  notificado_em timestamptz not null default now(),
  unique (tipo_ficha, maquina, veio, data_alvo, dias_restantes)
);

-- Acesso (RLS) ----------------------------------------------------------
-- RLS ligado em tudo. Sem política = só a chave de serviço (servidor) acessa.

alter table tecnicos enable row level security;
alter table login_tentativas enable row level security;
alter table sessoes_medicao enable row level security;
alter table linhas_pass_line_desempenadeira enable row level security;
alter table linhas_gap enable row level security;
alter table linhas_empeno_desgaste enable row level security;
alter table leituras_segmentos enable row level security;
alter table push_subscriptions enable row level security;
alter table prazos_notificados enable row level security;

-- Os aparelhos leem as medições direto (sincronização, histórico, análise).
create policy "leitura liberada" on sessoes_medicao for select using (true);
create policy "leitura liberada" on linhas_pass_line_desempenadeira for select using (true);
create policy "leitura liberada" on linhas_gap for select using (true);
create policy "leitura liberada" on linhas_empeno_desgaste for select using (true);
create policy "leitura liberada" on leituras_segmentos for select using (true);

-- Tempo real: os aparelhos são avisados quando uma medição muda.
alter publication supabase_realtime add table sessoes_medicao;
