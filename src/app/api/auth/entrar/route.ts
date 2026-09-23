import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PapelTecnico } from "@/types";

export const runtime = "nodejs";

const MATRICULAS_ADMIN = (process.env.NEXT_PUBLIC_ADMIN_MATRICULAS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

export async function POST(req: NextRequest) {
  const { matricula, pin } = await req.json();
  if (!matricula || !pin) {
    return NextResponse.json({ error: "Matrícula e PIN são obrigatórios" }, { status: 400 });
  }

  const matriculaPadronizada = String(matricula).trim().toUpperCase();
  const pinHash = await hashPin(String(pin));

  const admin = supabaseAdmin();
  const { data: linhas, error } = await admin
    .from("tecnicos")
    .select("*")
    .ilike("matricula", matriculaPadronizada);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidatos = (linhas ?? []) as unknown as LinhaTecnico[];
  const tecnico = candidatos.find((t) => t.pin_hash === pinHash);
  if (!tecnico) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  if (!tecnico.aprovado) {
    return NextResponse.json({ error: "pendente" }, { status: 403 });
  }

  const atualizacoes: Partial<LinhaTecnico> = {};
  if (tecnico.matricula !== matriculaPadronizada) atualizacoes.matricula = matriculaPadronizada;
  if (tecnico.nome !== tecnico.nome.toUpperCase()) atualizacoes.nome = tecnico.nome.toUpperCase();
  if (MATRICULAS_ADMIN.includes(matriculaPadronizada) && tecnico.papel !== "ADMIN") {
    atualizacoes.papel = "ADMIN";
  }
  if (Object.keys(atualizacoes).length > 0) {
    Object.assign(tecnico, atualizacoes);
    await admin.from("tecnicos").update(atualizacoes).eq("id", tecnico.id);
  }

  return NextResponse.json({ tecnico: semPin(tecnico) });
}
