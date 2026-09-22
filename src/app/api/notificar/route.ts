import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

function configurarWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function POST(req: NextRequest) {
  if (!configurarWebPush()) {
    return NextResponse.json(
      { error: "VAPID não configurado no servidor" },
      { status: 500 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor" },
      { status: 500 }
    );
  }

  const { titulo, corpo, urlDestino, tecnicoId } = await req.json();
  if (!titulo || !corpo) {
    return NextResponse.json(
      { error: "titulo e corpo são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, key);
  let query = supabase.from("push_subscriptions").select("*");
  if (tecnicoId) query = query.eq("tecnico_id", tecnicoId);
  const { data: inscricoes, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = JSON.stringify({ titulo, corpo, url: urlDestino });
  const endpointsExpirados: string[] = [];

  await Promise.all(
    (inscricoes ?? []).map(async (inscricao) => {
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
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", endpointsExpirados);
  }

  return NextResponse.json({
    enviados: (inscricoes?.length ?? 0) - endpointsExpirados.length,
  });
}
