import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("tecnicos")
    // nunca seleciona pin_hash — isso não deve sair do servidor
    .select("id, nome, matricula, funcao, papel, aprovado, criado_em")
    .order("criado_em", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const tecnicos = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    nome: row.nome,
    matricula: row.matricula,
    funcao: row.funcao,
    papel: row.papel,
    aprovado: row.aprovado,
    criadoEm: row.criado_em,
  }));
  return NextResponse.json({ tecnicos });
}
