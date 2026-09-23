import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function configurarWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

interface OpcoesNotificacao {
  titulo: string;
  corpo: string;
  urlDestino?: string;
  /** Manda só pra esse técnico específico. */
  tecnicoId?: string;
  /** Manda pra todo mundo com papel ADMIN aprovado. */
  paraAdmins?: boolean;
}

/**
 * Envia uma notificação push. Chamada tanto pela rota HTTP /api/notificar
 * (usada pelo navegador) quanto direto de outras rotas de servidor (ex.:
 * avisar os admins assim que alguém se cadastra), sem precisar de um
 * hop HTTP extra.
 */
export async function enviarNotificacaoPush(
  opcoes: OpcoesNotificacao
): Promise<{ enviados: number; erro?: string }> {
  if (!configurarWebPush()) {
    return { enviados: 0, erro: "VAPID não configurado no servidor" };
  }

  const admin = supabaseAdmin();

  let idsAlvo: string[] | null = null;
  if (opcoes.tecnicoId) {
    idsAlvo = [opcoes.tecnicoId];
  } else if (opcoes.paraAdmins) {
    const { data: admins } = await admin
      .from("tecnicos")
      .select("id")
      .eq("papel", "ADMIN")
      .eq("aprovado", true);
    const idsAdmins: string[] = (admins ?? []).map((a: { id: string }) => a.id);
    if (idsAdmins.length === 0) return { enviados: 0 };
    idsAlvo = idsAdmins;
  }

  let query = admin.from("push_subscriptions").select("*");
  if (idsAlvo) query = query.in("tecnico_id", idsAlvo);
  const { data: inscricoes, error } = await query;
  if (error) return { enviados: 0, erro: error.message };

  const payload = JSON.stringify({
    titulo: opcoes.titulo,
    corpo: opcoes.corpo,
    url: opcoes.urlDestino,
  });
  const endpointsExpirados: string[] = [];

  await Promise.all(
    (inscricoes ?? []).map(async (inscricao: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
          },
          payload
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          endpointsExpirados.push(inscricao.endpoint);
        } else {
          console.error("Falha ao enviar push", err);
        }
      }
    })
  );

  if (endpointsExpirados.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", endpointsExpirados);
  }

  return { enviados: (inscricoes?.length ?? 0) - endpointsExpirados.length };
}
