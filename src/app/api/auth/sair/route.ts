import { NextResponse } from "next/server";
import { apagarSessao } from "@/lib/sessaoServidor";

export const runtime = "nodejs";

export async function POST() {
  return apagarSessao(NextResponse.json({ ok: true }));
}
