import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const admin = supabaseAdmin();

  if (body.acao === "aprovar") {
    const { error } = await admin.from("tecnicos").update({ aprovado: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "papel") {
    if (!body.papel) {
      return NextResponse.json({ error: "papel é obrigatório" }, { status: 400 });
    }
    const { error } = await admin.from("tecnicos").update({ papel: body.papel }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "resetarPin") {
    if (!body.novoPin || String(body.novoPin).length < 4) {
      return NextResponse.json({ error: "PIN precisa ter pelo menos 4 dígitos" }, { status: 400 });
    }
    const pinHash = await hashPin(String(body.novoPin));
    const { error } = await admin.from("tecnicos").update({ pin_hash: pinHash }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = supabaseAdmin();
  const { error } = await admin.from("tecnicos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
