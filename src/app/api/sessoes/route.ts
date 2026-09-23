import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TipoFicha } from "@/types";

export const runtime = "nodejs";

const TABELA_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "linhas_pass_line_desempenadeira",
  GAP: "linhas_gap",
  EMPENO_DESGASTE: "linhas_empeno_desgaste",
  PASS_LINE_SEGMENTOS: "leituras_segmentos",
};

function toSnakeCase(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snake = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    out[snake] = value;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const { sessao, linhas } = await req.json();
  if (!sessao?.id || !sessao?.tipoFicha) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const tabelaLinhas = TABELA_POR_TIPO[sessao.tipoFicha as TipoFicha];
  if (!tabelaLinhas) {
    return NextResponse.json({ error: "tipoFicha inválido" }, { status: 400 });
  }

  const { error: sessaoError } = await admin.from("sessoes_medicao").upsert({
    id: sessao.id,
    tipo_ficha: sessao.tipoFicha,
    maquina: sessao.maquina,
    veio: sessao.veio,
    data: sessao.data,
    tecnico_id: sessao.tecnicoId,
    tecnico_nome: sessao.tecnicoNome,
    tecnico_matricula: sessao.tecnicoMatricula,
    tecnico_funcao: sessao.tecnicoFuncao,
    observacao: sessao.observacao,
    inspecionado_por: sessao.inspecionadoPor,
    liberado_por: sessao.liberadoPor,
    criado_em: sessao.criadoEm,
  });
  if (sessaoError) {
    return NextResponse.json({ error: sessaoError.message }, { status: 500 });
  }

  // Substitui as linhas antigas — cobre tanto o primeiro envio (não-op)
  // quanto o reenvio de uma sessão editada.
  const { error: deleteError } = await admin
    .from(tabelaLinhas)
    .delete()
    .eq("sessao_id", sessao.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (Array.isArray(linhas) && linhas.length > 0) {
    const linhasRemotas = linhas.map((linha: Record<string, unknown>) => {
      const { id, sessaoId, ...resto } = linha;
      void id;
      return { sessao_id: sessaoId, ...toSnakeCase(resto) };
    });
    const { error: linhasError } = await admin.from(tabelaLinhas).insert(linhasRemotas);
    if (linhasError) {
      return NextResponse.json({ error: linhasError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  const admin = supabaseAdmin();
  // As linhas remotas somem sozinhas (foreign key com "on delete cascade").
  const { error } = await admin.from("sessoes_medicao").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
