import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exigirSessao } from "@/lib/sessaoServidor";

export const runtime = "nodejs";

/** Sinal de vida: o aparelho avisa que o técnico está com o app aberto agora. */
export async function POST(req: NextRequest) {
  const sessao = await exigirSessao(req);
  if ("erro" in sessao) return sessao.erro;

  const { error } = await supabaseAdmin()
    .from("presenca")
    .upsert({ tecnico_id: sessao.tecnico.id, visto_em: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Quem está online e quando cada um entrou por último (só admin). */
export async function GET(req: NextRequest) {
  const sessao = await exigirSessao(req, ["ADMIN"]);
  if ("erro" in sessao) return sessao.erro;

  const { data, error } = await supabaseAdmin()
    .from("presenca")
    .select("tecnico_id, ultimo_login_em, visto_em");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    presencas: (data ?? []).map((r: Record<string, unknown>) => ({
      tecnicoId: r.tecnico_id as string,
      ultimoLoginEm: (r.ultimo_login_em as string | null) ?? null,
      vistoEm: r.visto_em as string,
    })),
  });
}
