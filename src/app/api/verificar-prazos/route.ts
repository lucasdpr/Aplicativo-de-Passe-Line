import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { buscarUltimasMedicoes, calcularPrazos, comboLabel } from "@/lib/prazos";

export const runtime = "nodejs";

const LIMIARES = new Set([3, 2, 1, 0]);

function configurarWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !configurarWebPush()) {
    return NextResponse.json(
      { error: "Supabase ou VAPID não configurados no servidor" },
      { status: 500 }
    );
  }
  const supabase = createClient(url, key);

  const ultimas = await buscarUltimasMedicoes(supabase);
  const prazos = calcularPrazos(ultimas).filter((p) => LIMIARES.has(p.diasRestantes));

  if (prazos.length === 0) {
    return NextResponse.json({ verificados: 0, notificados: 0 });
  }

  // Evita reenviar o mesmo aviso (mesmo combo + mesma data-alvo + mesmo
  // limiar de dias) se o cron rodar mais de uma vez no mesmo dia.
  const jaNotificados = new Set<string>();
  const { data: registrosExistentes } = await supabase
    .from("prazos_notificados")
    .select("tipo_ficha, maquina, veio, data_alvo, dias_restantes")
    .in(
      "data_alvo",
      prazos.map((p) => p.dataAlvo)
    );
  for (const r of registrosExistentes ?? []) {
    jaNotificados.add(
      `${r.tipo_ficha}|${r.maquina}|${r.veio}|${r.data_alvo}|${r.dias_restantes}`
    );
  }

  const pendentes = prazos.filter(
    (p) =>
      !jaNotificados.has(
        `${p.tipoFicha}|${p.maquina}|${p.veio}|${p.dataAlvo}|${p.diasRestantes}`
      )
  );

  if (pendentes.length === 0) {
    return NextResponse.json({ verificados: prazos.length, notificados: 0 });
  }

  const { data: inscricoes } = await supabase.from("push_subscriptions").select("*");

  let notificados = 0;
  for (const p of pendentes) {
    const corpo =
      p.diasRestantes === 0
        ? `Vence hoje: ${comboLabel(p)}`
        : `Faltam ${p.diasRestantes} dia${p.diasRestantes > 1 ? "s" : ""} para ${comboLabel(p)}`;
    const payload = JSON.stringify({
      titulo: "Prazo de medição se aproximando",
      corpo,
      url: "/",
    });

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
            console.error("Falha ao enviar push de prazo", err);
          }
        }
      })
    );
    if (endpointsExpirados.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", endpointsExpirados);
    }

    await supabase.from("prazos_notificados").insert({
      tipo_ficha: p.tipoFicha,
      maquina: p.maquina,
      veio: p.veio,
      data_alvo: p.dataAlvo,
      dias_restantes: p.diasRestantes,
    });
    notificados++;
  }

  return NextResponse.json({ verificados: prazos.length, notificados });
}
