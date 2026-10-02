import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exigirSessao } from "@/lib/sessaoServidor";
import { gerarHashPin } from "@/lib/pinHash";
import { enviarNotificacaoPush } from "@/lib/serverPush";
import type { PapelTecnico } from "@/types";

const PAPEIS_VALIDOS: PapelTecnico[] = ["ADMIN", "TECNICO", "VISUALIZADOR"];

export const runtime = "nodejs";


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await exigirSessao(req, ["ADMIN"]);
  if ("erro" in sessao) return sessao.erro;

  const { id } = await params;
  const body = await req.json();
  const admin = supabaseAdmin();

  if (body.acao === "aprovar") {
    const { error } = await admin.from("tecnicos").update({ aprovado: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // O aviso de "acesso liberado" é montado aqui no servidor (antes o
    // navegador mandava texto e link livres pra /api/notificar).
    enviarNotificacaoPush({
      titulo: "Acesso liberado!",
      corpo: "Seu cadastro no CSN Pass-Line foi aprovado. Já pode entrar.",
      urlDestino: "/login",
      tecnicoId: id,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "papel") {
    if (!PAPEIS_VALIDOS.includes(body.papel)) {
      return NextResponse.json({ error: "papel inválido" }, { status: 400 });
    }
    if (id === sessao.tecnico.id && body.papel !== "ADMIN") {
      return NextResponse.json(
        { error: "Você não pode tirar o seu próprio acesso de administrador." },
        { status: 400 }
      );
    }
    const { error } = await admin.from("tecnicos").update({ papel: body.papel }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "resetarPin") {
    if (!/^\d{4,8}$/.test(String(body.novoPin ?? ""))) {
      return NextResponse.json({ error: "O PIN precisa ter de 4 a 8 números" }, { status: 400 });
    }
    const pinHash = await gerarHashPin(String(body.novoPin));
    const { error } = await admin.from("tecnicos").update({ pin_hash: pinHash }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await exigirSessao(req, ["ADMIN"]);
  if ("erro" in sessao) return sessao.erro;

  const { id } = await params;
  if (id === sessao.tecnico.id) {
    return NextResponse.json({ error: "Você não pode excluir o seu próprio cadastro." }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { error } = await admin.from("tecnicos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
