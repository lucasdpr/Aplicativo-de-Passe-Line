# CSN Pass-Line

PWA para digitalizar as fichas de inspeção de pass-line da CSN (MCC's #2 e #3):

1. Medição e Ajuste de Pass-Line (Desempenadeira) — tolerância ±0,50mm
2. Medição e Ajuste de GAP
3. Medição de Empeno e Desgaste (Desempenadeira) — tolerância ±2,00mm
4. Medição e Ajuste de Pass-Line dos Segmentos — tolerância ±1,00mm

Funciona **offline** (salva localmente no dispositivo via IndexedDB) e sincroniza
com o banco na nuvem assim que a conexão volta. O PDF oficial é gerado no
servidor, a partir dos dados já sincronizados e confirmados no banco.

## Status atual

- [x] Login por PIN (matrícula + PIN, cadastro local)
- [x] Estrutura offline-first (Dexie/IndexedDB) com fila de sincronização
- [x] PWA instalável (manifest + service worker)
- [x] Formulário 1 — Pass-Line (Desempenadeira) completo, com destaque visual
      para valores de ajuste fora da tolerância impressa
- [x] Histórico de medições (filtra por técnico, máquina, veio, data, status de sync)
- [ ] Formulários 2, 3 e 4 (GAP, Empeno/Desgaste, Segmentos) — telas placeholder
- [ ] Geração do PDF oficial (layout replicado das fichas originais)
- [ ] Conexão real com Supabase (falta criar o projeto e configurar `.env.local`)

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## Configurando o banco (Supabase)

1. Crie uma conta/projeto grátis em https://supabase.com
2. No SQL Editor do projeto, rode o conteúdo de `supabase/schema.sql`
3. Copie `.env.example` para `.env.local` e preencha com a URL e a anon key
   do seu projeto (Project Settings → API)
4. Me passe acesso ao projeto Supabase para eu conectar a sincronização

## Stack

- Next.js (App Router) + Tailwind
- PWA via Serwist (service worker + manifest)
- Dexie.js (IndexedDB) para armazenamento e fila offline
- Supabase (Postgres) como banco na nuvem
- pdf-lib para geração do PDF oficial (planejado)
- Deploy gratuito: Vercel

Todo o stack escolhido tem camada gratuita permanente (sem trial que expira).
