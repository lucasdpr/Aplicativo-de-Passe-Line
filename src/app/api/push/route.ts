import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tecnicoDaSessao } from "@/lib/sessaoServidor";

export const runtime = "nodejs";

/**
 * Guarda/remove a inscrição de notificação push deste aparelho. Antes o
 * navegador gravava direto na tabela com a chave pública, o que obrigava a
 * tabela a aceitar leitura e escrita de qualquer um.
 *
 * Quem está logado inscreve em seu próprio nome. Quem acabou de se
 * cadastrar (ainda sem aprovação, logo sem sessão) pode inscrever só um
 * cadastro que esteja pendente — pra receber o aviso de "acesso liberado".
 */
export async function POST(req: NextRequest) {
  const { endpoint, p256dh, auth, tecnicoIdPendente } = await req.json();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }
  const admin = supabaseAdmin();

  let tecnico: { id: string; nome: string } | null = await tecnicoDaSessao(req);
  if (!tecnico && tecnicoIdPendente) {
    const { data } = await admin
      .from("tecnicos")
      .select("id, nome, aprovado")
      .eq("id", tecnicoIdPendente)
      .maybeSingle();
    if (data && !data.aprovado) tecnico = { id: data.id, nome: data.nome };
  }
  if (!tecnico) {
    return NextResponse.json({ error: "sessao_invalida" }, { status: 401 });
  }

  const { error } = await admin.from("push_subscriptions").upsert(
    { tecnico_id: tecnico.id, tecnico_nome: tecnico.nome, endpoint, p256dh, auth },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint é obrigatório" }, { status: 400 });
  // Remover só pelo endpoint é seguro: ele é um segredo que só o próprio
  // navegador inscrito conhece.
  const { error } = await supabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
