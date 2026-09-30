import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gerarPdfSessao, type ModoPdfGap } from "@/lib/pdf/gerarPdf";
import { exigirSessao } from "@/lib/sessaoServidor";
import type {
  SessaoMedicao,
  LinhaPassLineDesempenadeira,
  LinhaGap,
  LinhaEmpenoDesgaste,
  LeituraSegmento,
  TipoFicha,
} from "@/types";

export const runtime = "nodejs";

const TABELA_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "linhas_pass_line_desempenadeira",
  GAP: "linhas_gap",
  EMPENO_DESGASTE: "linhas_empeno_desgaste",
  PASS_LINE_SEGMENTOS: "leituras_segmentos",
};

function fromSnakeCase<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = value;
  }
  return out as T;
}

export async function GET(req: NextRequest) {
  const auth = await exigirSessao(req);
  if ("erro" in auth) return auth.erro;

  const sessaoId = req.nextUrl.searchParams.get("sessaoId");
  if (!sessaoId) {
    return NextResponse.json({ error: "sessaoId é obrigatório" }, { status: 400 });
  }
  const modoGap: ModoPdfGap =
    req.nextUrl.searchParams.get("modo") === "ATUALIZADO" ? "ATUALIZADO" : "TUDO";

  const supabase = supabaseAdmin();

  const { data: sessaoRow, error: sessaoError } = await supabase
    .from("sessoes_medicao")
    .select("*")
    .eq("id", sessaoId)
    .single();

  if (sessaoError || !sessaoRow) {
    return NextResponse.json(
      { error: "Sessão não encontrada ou ainda não sincronizada" },
      { status: 404 }
    );
  }

  const sessao = fromSnakeCase<SessaoMedicao>(sessaoRow);

  const { data: linhasRows, error: linhasError } = await supabase
    .from(TABELA_POR_TIPO[sessao.tipoFicha])
    .select("*")
    .eq("sessao_id", sessaoId);

  if (linhasError) {
    return NextResponse.json({ error: linhasError.message }, { status: 500 });
  }

  const linhas = (linhasRows ?? []).map((r: Record<string, unknown>) =>
    fromSnakeCase<
      | LinhaPassLineDesempenadeira
      | LinhaGap
      | LinhaEmpenoDesgaste
      | LeituraSegmento
    >(r)
  );

  const pdfBytes = await gerarPdfSessao(
    sessao,
    linhas as unknown as Parameters<typeof gerarPdfSessao>[1],
    modoGap
  );

  const sufixoModo = sessao.tipoFicha === "GAP" && modoGap === "ATUALIZADO" ? "-atualizado" : "";
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pass-line-${sessao.tipoFicha.toLowerCase()}-${sessao.data}${sufixoModo}.pdf"`,
    },
  });
}
