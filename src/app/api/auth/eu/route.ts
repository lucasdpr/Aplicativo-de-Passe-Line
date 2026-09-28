import { NextRequest, NextResponse } from "next/server";
import { tecnicoDaSessao } from "@/lib/sessaoServidor";

export const runtime = "nodejs";

/** Quem é o dono da sessão deste aparelho (conferido no banco). */
export async function GET(req: NextRequest) {
  const tecnico = await tecnicoDaSessao(req);
  if (!tecnico) return NextResponse.json({ error: "sessao_invalida" }, { status: 401 });
  return NextResponse.json({ tecnico });
}
