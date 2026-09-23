import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarNotificacaoPush } from "@/lib/serverPush";

export const runtime = "nodejs";

const MATRICULAS_ADMIN = (process.env.NEXT_PUBLIC_ADMIN_MATRICULAS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const { nome, matricula, funcao, pin, tipoAcesso } = await req.json();
  if (!nome || !matricula || !funcao || !pin) {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }
  if (String(pin).length < 4) {
    return NextResponse.json({ error: "O PIN precisa ter pelo menos 4 dígitos" }, { status: 400 });
  }

  const nomePadronizado = String(nome).trim().toUpperCase();
  const matriculaPadronizada = String(matricula).trim().toUpperCase();
  const admin = supabaseAdmin();

  const { data: existentes, error: buscaError } = await admin
    .from("tecnicos")
    .select("id")
    .ilike("matricula", matriculaPadronizada);
  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 500 });
  }
  if (existentes && existentes.length > 0) {
    return NextResponse.json({ error: "matricula_ja_cadastrada" }, { status: 409 });
  }

  const pinHash = await hashPin(String(pin));
  const ehAdmin = MATRICULAS_ADMIN.includes(matriculaPadronizada);
  const papel = ehAdmin ? "ADMIN" : tipoAcesso === "visitante" ? "VISUALIZADOR" : "TECNICO";
  const id = uuid();
  const criadoEm = new Date().toISOString();

  const { error: insertError } = await admin.from("tecnicos").insert({
    id,
    nome: nomePadronizado,
    matricula: matriculaPadronizada,
    funcao,
    pin_hash: pinHash,
    papel,
    aprovado: ehAdmin,
    criado_em: criadoEm,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (!ehAdmin) {
    // Cadastro fica pendente de aprovação — avisa os admins agora, senão
    // ninguém fica sabendo que alguém está esperando liberação.
    enviarNotificacaoPush({
      titulo: "Novo cadastro pendente",
      corpo: `${nomePadronizado} (matr. ${matriculaPadronizada}) pediu acesso como ${
        tipoAcesso === "visitante" ? "visitante" : "técnico"
      }. Precisa da sua aprovação.`,
      urlDestino: "/admin/tecnicos",
      paraAdmins: true,
    }).catch(() => {});
  }

  return NextResponse.json({
    tecnico: {
      id,
      nome: nomePadronizado,
      matricula: matriculaPadronizada,
      funcao,
      papel,
      aprovado: ehAdmin,
      criadoEm,
    },
    // Volta o hash também — o dispositivo que cadastrou guarda uma cópia
    // local pra continuar aceitando login offline neste aparelho depois.
    pinHash,
  });
}
