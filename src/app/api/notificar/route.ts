import { NextRequest, NextResponse } from "next/server";
import { enviarNotificacaoPush } from "@/lib/serverPush";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { titulo, corpo, urlDestino, tecnicoId, paraAdmins } = await req.json();
  if (!titulo || !corpo) {
    return NextResponse.json({ error: "titulo e corpo são obrigatórios" }, { status: 400 });
  }

  const resultado = await enviarNotificacaoPush({ titulo, corpo, urlDestino, tecnicoId, paraAdmins });
  if (resultado.erro) {
    return NextResponse.json({ error: resultado.erro }, { status: 500 });
  }
  return NextResponse.json({ enviados: resultado.enviados });
}
