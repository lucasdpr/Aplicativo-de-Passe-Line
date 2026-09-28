"use client";

/**
 * Rascunho automático dos formulários — guarda o que está sendo digitado
 * no armazenamento local do aparelho (nunca depende de internet), pra não
 * perder nada se a pessoa sair sem salvar (aba fechada, botão "voltar",
 * app derrubado). Some sozinho assim que a medição é salva de verdade.
 *
 * O rascunho é de cada técnico (o tablet é compartilhado: um técnico nunca
 * abre o rascunho de outro) e vence depois de alguns dias.
 */
const PREFIXO = "passline-rascunho:";
const VERSAO = 2;
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

interface RascunhoGuardado<T> {
  v: typeof VERSAO;
  salvoEm: string;
  dados: T;
}

/** Chave do rascunho: formulário + técnico + sessão (ou "novo"). */
export function chaveRascunho(
  formulario: string,
  tecnicoId: string | undefined,
  sessaoId: string | null
) {
  return `${formulario}:${tecnicoId ?? "anonimo"}:${sessaoId ?? "novo"}`;
}

function ler<T>(chave: string): RascunhoGuardado<T> | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as RascunhoGuardado<T>;
    const vencido =
      r?.v !== VERSAO || !(Date.now() - new Date(r.salvoEm).getTime() < VALIDADE_MS);
    if (vencido) {
      localStorage.removeItem(PREFIXO + chave);
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

export function salvarRascunho<T>(chave: string, dados: T) {
  try {
    const r: RascunhoGuardado<T> = { v: VERSAO, salvoEm: new Date().toISOString(), dados };
    localStorage.setItem(PREFIXO + chave, JSON.stringify(r));
  } catch {
    // Armazenamento indisponível (modo privado, cheio, etc.) — sem
    // rascunho, mas não pode derrubar o formulário por causa disso.
  }
}

export function carregarRascunho<T>(chave: string): T | null {
  return ler<T>(chave)?.dados ?? null;
}

/** Quando o rascunho foi salvo pela última vez (null se não tem rascunho). */
export function infoRascunho(chave: string): { salvoEm: string } | null {
  const r = ler<unknown>(chave);
  return r ? { salvoEm: r.salvoEm } : null;
}

export function limparRascunho(chave: string) {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch {
    // ignora
  }
}

/**
 * Apaga rascunhos do formato antigo (sem técnico na chave, que qualquer
 * pessoa no tablet abria) e os vencidos.
 */
export function limparRascunhosAntigos() {
  try {
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k.slice(PREFIXO.length));
    }
    chaves.forEach((k) => ler(k));
  } catch {
    // ignora
  }
}
