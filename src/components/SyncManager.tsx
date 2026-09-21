"use client";

import { useEffect } from "react";
import { sincronizarPendentes } from "@/lib/db/sync";

const INTERVALO_TENTATIVA_MS = 60_000;

export function SyncManager() {
  useEffect(() => {
    sincronizarPendentes().catch(() => {});

    const aoConectar = () => {
      sincronizarPendentes().catch(() => {});
    };
    window.addEventListener("online", aoConectar);

    const intervalo = window.setInterval(() => {
      if (navigator.onLine) sincronizarPendentes().catch(() => {});
    }, INTERVALO_TENTATIVA_MS);

    return () => {
      window.removeEventListener("online", aoConectar);
      window.clearInterval(intervalo);
    };
  }, []);

  return null;
}
