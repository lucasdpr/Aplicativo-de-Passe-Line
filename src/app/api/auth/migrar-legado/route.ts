import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PapelTecnico } from "@/types";

export const runtime = "nodejs";

const MATRICULAS_ADMIN = (process.env.NEXT_PUBLIC_ADMIN_MATRICULAS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/**
 * Migra pra nuvem um técnico que só existia localmente neste aparelho
 * (cadastro de antes da versão com nuvem). O PIN já chega como hash — o
 * dispositivo só entra aqui depois de já ter conferido esse hash contra
 * o que tinha guardado localmente, então isso não é uma nova verificação
 * de senha, só uma gravação.
 */
export async function POST(req: NextRequest) {
  const { id, nome, matricula, funcao, pinHash, papel, criadoEm } = await req.json();
  if (!id || !nome || !matricula || !pinHash) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const matriculaPadronizada = String(matricula).trim().toUpperCase();
  const papelFinal: PapelTecnico = MATRICULAS_ADMIN.includes(matriculaPadronizada)
    ? "ADMIN"
    : (papel as PapelTecnico) ?? "TECNICO";

  const admin = supabaseAdmin();
  const { error } = await admin.from("tecnicos").upsert({
    id,
    nome: String(nome).toUpperCase(),
    matricula: matriculaPadronizada,
    funcao: funcao ?? "",
    pin_hash: pinHash,
    papel: papelFinal,
    aprovado: true,
    criado_em: criadoEm ?? new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tecnico: {
      id,
      nome: String(nome).toUpperCase(),
      matricula: matriculaPadronizada,
      funcao: funcao ?? "",
      papel: papelFinal,
      aprovado: true,
      criadoEm: criadoEm ?? new Date().toISOString(),
    },
  });
}
