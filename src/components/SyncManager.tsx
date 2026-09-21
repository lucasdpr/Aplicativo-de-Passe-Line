"use client";

import { useEffect } from "react";
import { sincronizarPendentes, puxarAtualizacoes } from "@/lib/db/sync";

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

    return () => {
      window.removeEventListener("online", aoConectar);
      window.clearInterval(intervalo);
    };
  }, []);

  return null;
}
