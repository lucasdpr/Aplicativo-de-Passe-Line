import { NextRequest, NextResponse } from "next/server";
import { enviarNotificacaoPush } from "@/lib/serverPush";
import { exigirSessao } from "@/lib/sessaoServidor";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TipoFicha } from "@/types";

export const runtime = "nodejs";

const NOMES_FICHA: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

/**
 * Avisa todo mundo que uma medição foi concluída. O texto e o link são
 * montados aqui a partir da medição gravada no banco — o navegador só diz
 * qual medição. (Antes a rota aceitava título, texto e link livres de
 * qualquer um, o que permitia mandar push falso com link de golpe.)
 */
export async function POST(req: NextRequest) {
  const auth = await exigirSessao(req, ["TECNICO", "ADMIN"]);
  if ("erro" in auth) return auth.erro;

  const { sessaoId } = await req.json();
  if (!sessaoId) {
    return NextResponse.json({ error: "sessaoId é obrigatório" }, { status: 400 });
  }

  const { data: sessao } = await supabaseAdmin()
    .from("sessoes_medicao")
    .select("tipo_ficha, maquina, veio, tecnico_nome")
    .eq("id", sessaoId)
    .maybeSingle();
  if (!sessao) {
    return NextResponse.json({ error: "Medição não encontrada" }, { status: 404 });
  }

  const resultado = await enviarNotificacaoPush({
    titulo: "Pass-Line concluído",
    corpo: `${sessao.tecnico_nome} concluiu ${NOMES_FICHA[sessao.tipo_ficha as TipoFicha]} — ${sessao.maquina} veio ${sessao.veio}`,
    urlDestino: "/historico",
  });
  if (resultado.erro) {
    return NextResponse.json({ error: resultado.erro }, { status: 500 });
  }
  return NextResponse.json({ enviados: resultado.enviados });
}
