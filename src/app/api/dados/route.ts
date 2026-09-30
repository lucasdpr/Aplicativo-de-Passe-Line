import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exigirSessao } from "@/lib/sessaoServidor";
import { buscarTodas } from "@/lib/buscarTodas";
import { buscarAnaliseCombos } from "@/lib/analise";
import { buscarUltimasMedicoes } from "@/lib/prazos";
import type { TipoFicha } from "@/types";

export const runtime = "nodejs";

const TABELA_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "linhas_pass_line_desempenadeira",
  GAP: "linhas_gap",
  EMPENO_DESGASTE: "linhas_empeno_desgaste",
  PASS_LINE_SEGMENTOS: "leituras_segmentos",
};

/**
 * Toda leitura de medição passa por aqui, com login. As tabelas não aceitam
 * mais leitura pela chave pública (que fica dentro do app e qualquer um tira).
 */
export async function GET(req: NextRequest) {
  const auth = await exigirSessao(req);
  if ("erro" in auth) return auth.erro;

  const admin = supabaseAdmin();
  const p = req.nextUrl.searchParams;

  switch (p.get("tipo")) {
    case "analise":
      return NextResponse.json(await buscarAnaliseCombos(admin));

    case "ultimas": {
      const mapa = await buscarUltimasMedicoes(admin);
      return NextResponse.json(Object.fromEntries(mapa));
    }

    case "indice": {
      const { data, error } = await buscarTodas<Record<string, unknown>>((de, ate) =>
        admin.from("sessoes_medicao").select("id, tipo_ficha, atualizado_em").order("id").range(de, ate)
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    case "sessao": {
      const id = p.get("id");
      if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
      const { data: sessao } = await admin.from("sessoes_medicao").select("*").eq("id", id).maybeSingle();
      if (!sessao) return NextResponse.json({ sessao: null, linhas: [] });
      if (p.get("soMeta")) return NextResponse.json({ sessao, linhas: [] });
      const tabela = TABELA_POR_TIPO[sessao.tipo_ficha as TipoFicha];
      const { data: linhas, error } = await admin.from(tabela).select("*").eq("sessao_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ sessao, linhas: linhas ?? [] });
    }

    default:
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
}
