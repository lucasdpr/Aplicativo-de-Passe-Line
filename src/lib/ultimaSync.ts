"use client";

const CHAVE = "passline-ultima-atualizacao";
export const EVENTO_ULTIMA_ATUALIZACAO = "passline-ultima-atualizacao";

export function marcarUltimaAtualizacao() {
  const agora = new Date().toISOString();
  try {
    localStorage.setItem(CHAVE, agora);
  } catch {
    // sem armazenamento: só não mostra o horário
  }
  window.dispatchEvent(new Event(EVENTO_ULTIMA_ATUALIZACAO));
}

export function lerUltimaAtualizacao(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
