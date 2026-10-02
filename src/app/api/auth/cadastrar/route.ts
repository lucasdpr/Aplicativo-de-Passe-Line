import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gravarSessao } from "@/lib/sessaoServidor";
import { gerarHashPin } from "@/lib/pinHash";
import { enviarNotificacaoPush } from "@/lib/serverPush";

export const runtime = "nodejs";

const MATRICULAS_ADMIN = (process.env.NEXT_PUBLIC_ADMIN_MATRICULAS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);


export async function POST(req: NextRequest) {
  const { nome, matricula, funcao, pin, tipoAcesso } = await req.json();
  if (!nome || !matricula || !funcao || !pin) {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(String(pin))) {
    return NextResponse.json({ error: "O PIN precisa ter de 4 a 8 números" }, { status: 400 });
  }

  const nomePadronizado = String(nome).trim().toUpperCase();
  const matriculaPadronizada = String(matricula).trim().toUpperCase();
  const admin = supabaseAdmin();

  const { data: existentes, error: buscaError } = await admin
    .from("tecnicos")
    .select("id")
    .eq("matricula", matriculaPadronizada);
  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 500 });
  }
  if (existentes && existentes.length > 0) {
    return NextResponse.json({ error: "matricula_ja_cadastrada" }, { status: 409 });
  }

  const pinHash = await gerarHashPin(String(pin));
  // A matrícula de NEXT_PUBLIC_ADMIN_MATRICULAS só serve pra criar o
  // PRIMEIRO admin. Depois que existe um, cadastrar essa matrícula vira um
  // cadastro comum, pendente de aprovação — senão quem soubesse o valor (ele
  // fica visível no código do app) virava admin sozinho.
  let ehAdmin = false;
  if (MATRICULAS_ADMIN.includes(matriculaPadronizada)) {
    const { count } = await admin
      .from("tecnicos")
      .select("id", { count: "exact", head: true })
      .eq("papel", "ADMIN");
    ehAdmin = count === 0;
  }
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

  const resposta = NextResponse.json({
    tecnico: {
      id,
      nome: nomePadronizado,
      matricula: matriculaPadronizada,
      funcao,
      papel,
      aprovado: ehAdmin,
      criadoEm,
    },
  });
  // Só quem já nasce aprovado (admin) sai daqui logado no servidor.
  return ehAdmin ? gravarSessao(resposta, id) : resposta;
}
