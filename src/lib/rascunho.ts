"use client";

/**
 * Rascunho automático dos formulários — guarda o que está sendo digitado
 * no armazenamento local do aparelho (nunca depende de internet), pra não
 * perder nada se a pessoa sair sem salvar (aba fechada, botão "voltar",
 * app derrubado). Some sozinho assim que a medição é salva de verdade.
 */
const PREFIXO = "passline-rascunho:";

export function salvarRascunho<T>(chave: string, dados: T) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(dados));
  } catch {
    // Armazenamento indisponível (modo privado, cheio, etc.) — sem
    // rascunho, mas não pode derrubar o formulário por causa disso.
  }
}

export function carregarRascunho<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function limparRascunho(chave: string) {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch {
    // ignora
  }
}
