"use client";

import { useEffect, useState } from "react";

/** O app avisa o servidor a cada tanto; passou do dobro disso sem sinal, saiu. */
const INTERVALO_SINAL_MS = 90_000;
export const ONLINE_ATE_MS = INTERVALO_SINAL_MS * 2.5;

export interface Presenca {
  tecnicoId: string;
  ultimoLoginEm: string | null;
  vistoEm: string;
}

/** Avisa que este técnico está com o app aberto (só com internet e tela visível). */
export function useSinalDePresenca(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const enviar = () => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      // Falhar aqui não pode atrapalhar ninguém: é só um aviso.
      fetch("/api/presenca", { method: "POST", keepalive: true }).catch(() => {});
    };
    enviar();
    const timer = window.setInterval(enviar, INTERVALO_SINAL_MS);
    document.addEventListener("visibilitychange", enviar);
    window.addEventListener("online", enviar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", enviar);
      window.removeEventListener("online", enviar);
    };
  }, [ativo]);
}

/** Lista de presença pro admin; atualiza sozinha enquanto a tela está aberta. */
export function usePresencas(ativo: boolean) {
  const [presencas, setPresencas] = useState<Map<string, Presenca> | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    const carregar = async () => {
      try {
        const resp = await fetch("/api/presenca");
        if (!resp.ok) return;
        const { presencas: lista } = (await resp.json()) as { presencas: Presenca[] };
        if (cancelado) return;
        setPresencas(new Map(lista.map((p) => [p.tecnicoId, p])));
        setAgora(Date.now());
      } catch {
        // sem internet: mantém o que já tinha
      }
    };
    carregar();
    const timer = window.setInterval(carregar, 30_000);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
    };
  }, [ativo]);

  return { presencas, agora };
}

export function estaOnline(p: Presenca | undefined, agora: number) {
  return !!p && agora - new Date(p.vistoEm).getTime() < ONLINE_ATE_MS;
}

/** "agora há pouco", "há 12 min", "há 3 h", "há 2 dias". */
export function haQuantoTempo(iso: string, agora: number) {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60_000));
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

export function dataHora(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
