import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gravarSessao } from "@/lib/sessaoServidor";
import { conferirPin, gerarHashPin } from "@/lib/pinHash";
import type { PapelTecnico } from "@/types";

export const runtime = "nodejs";

const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

interface LinhaTecnico {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  pin_hash: string;
  papel: PapelTecnico;
  aprovado: boolean;
  criado_em: string;
}

function semPin(row: LinhaTecnico) {
  return {
    id: row.id,
    nome: row.nome,
    matricula: row.matricula,
    funcao: row.funcao,
    papel: row.papel,
    aprovado: row.aprovado,
    criadoEm: row.criado_em,
  };
}

/**
 * Limite de tentativas por matrícula: 5 PINs errados seguidos bloqueiam
 * 15 minutos. Com PIN de 4 dígitos (10 mil combinações), sem isso dava pra
 * testar todos em minutos. Fica no banco (tabela login_tentativas) porque
 * o servidor roda em várias instâncias que não compartilham memória. Se a
 * tabela não existir ainda, o login continua funcionando, sem o limite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bloqueadoAte(admin: any, matricula: string): Promise<Date | null> {
  const { data, error } = await admin
    .from("login_tentativas")
    .select("bloqueado_ate")
    .eq("matricula", matricula)
    .maybeSingle();
  if (error || !data?.bloqueado_ate) return null;
  const ate = new Date(data.bloqueado_ate);
  return ate > new Date() ? ate : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function registrarFalha(admin: any, matricula: string) {
  const { data, error } = await admin
    .from("login_tentativas")
    .select("falhas")
    .eq("matricula", matricula)
    .maybeSingle();
  if (error) return;
  const falhas = (data?.falhas ?? 0) + 1;
  const bloquear = falhas >= MAX_FALHAS;
  await admin.from("login_tentativas").upsert({
    matricula,
    falhas: bloquear ? 0 : falhas,
    bloqueado_ate: bloquear ? new Date(Date.now() + BLOQUEIO_MS).toISOString() : null,
    atualizado_em: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const { matricula, pin } = await req.json();
  if (!matricula || !pin) {
    return NextResponse.json({ error: "Matrícula e PIN são obrigatórios" }, { status: 400 });
  }

  const matriculaPadronizada = String(matricula).trim().toUpperCase();
  const admin = supabaseAdmin();

  const bloqueio = await bloqueadoAte(admin, matriculaPadronizada);
  if (bloqueio) {
    const minutos = Math.max(1, Math.ceil((bloqueio.getTime() - Date.now()) / 60000));
    return NextResponse.json(
      {
        error: "bloqueado",
        mensagem: `Muitas tentativas com PIN errado. Tente de novo em ${minutos} minuto${minutos > 1 ? "s" : ""}.`,
      },
      { status: 429 }
    );
  }
  const { data: linhas, error } = await admin
    .from("tecnicos")
    .select("*")
    // Comparação exata (as matrículas são gravadas sempre em maiúsculas).
    // Antes era ILIKE, em que "%" e "*" são curingas: a matrícula "%"
    // casava com todo mundo e bastava acertar o PIN de qualquer técnico.
    .eq("matricula", matriculaPadronizada);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidatos = (linhas ?? []) as unknown as LinhaTecnico[];
  let tecnico: LinhaTecnico | undefined;
  let hashAntigo = false;
  for (const t of candidatos) {
    const r = await conferirPin(String(pin), t.pin_hash);
    if (r.ok) {
      tecnico = t;
      hashAntigo = r.formatoAntigo;
      break;
    }
  }
  if (!tecnico) {
    await registrarFalha(admin, matriculaPadronizada);
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }
  await admin.from("login_tentativas").delete().eq("matricula", matriculaPadronizada);

  if (!tecnico.aprovado) {
    return NextResponse.json({ error: "pendente" }, { status: 403 });
  }

  const atualizacoes: Partial<LinhaTecnico> = {};
  if (tecnico.matricula !== matriculaPadronizada) atualizacoes.matricula = matriculaPadronizada;
  if (tecnico.nome !== tecnico.nome.toUpperCase()) atualizacoes.nome = tecnico.nome.toUpperCase();
  // Hash antigo (SHA-256 sem sal): troca pelo formato novo agora que o PIN
  // foi conferido. (A promoção automática a ADMIN pela matrícula no login
  // saiu: bastava existir alguém com aquela matrícula pra virar admin.)
  if (hashAntigo) atualizacoes.pin_hash = await gerarHashPin(String(pin));
  if (Object.keys(atualizacoes).length > 0) {
    Object.assign(tecnico, atualizacoes);
    await admin.from("tecnicos").update(atualizacoes).eq("id", tecnico.id);
  }

  return gravarSessao(NextResponse.json({ tecnico: semPin(tecnico) }), tecnico.id);
}
