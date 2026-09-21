"use client";

import { useEffect } from "react";
import { sincronizarPendentes, puxarAtualizacoes } from "@/lib/db/sync";
import { supabase } from "@/lib/supabase";

const INTERVALO_TENTATIVA_MS = 60_000;

async function sincronizarTudo() {
  await sincronizarPendentes().catch(() => {});
  await puxarAtualizacoes().catch(() => {});
}

export function SyncManager() {
  useEffect(() => {
    sincronizarTudo();

    const aoConectar = () => {
      sincronizarTudo();
    };
    window.addEventListener("online", aoConectar);

    const intervalo = window.setInterval(() => {
      if (navigator.onLine) sincronizarTudo();
    }, INTERVALO_TENTATIVA_MS);

    // Tempo real: assim que qualquer aparelho salvar/editar uma medição no
    // Supabase, este dispositivo já busca a atualização na hora, sem
    // precisar esperar o intervalo nem recarregar a página.
    const canal = supabase
      ?.channel("sessoes_medicao_mudancas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessoes_medicao" },
        () => {
          puxarAtualizacoes().catch(() => {});
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("online", aoConectar);
      window.clearInterval(intervalo);
      if (canal) supabase?.removeChannel(canal);
    };
  }, []);

  return null;
}
