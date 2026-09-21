import { db } from "@/lib/db/dexie";
import type { Edicao, MudancaCampo } from "@/types";

function fmtValor(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

function vazio(v: unknown) {
  return v === undefined || v === null || v === "";
}

export function diffObjetos(
  chave: string,
  antigo: object,
  novo: object,
  ignorar: string[] = []
): MudancaCampo[] {
  const a = antigo as Record<string, unknown>;
  const n = novo as Record<string, unknown>;
  const campos = new Set([...Object.keys(a), ...Object.keys(n)]);
  const mudancas: MudancaCampo[] = [];
  for (const campo of campos) {
    if (ignorar.includes(campo)) continue;
    const de = a[campo];
    const para = n[campo];
    if (vazio(de) && vazio(para)) continue;
    if (de !== para) {
      mudancas.push({
        linhaChave: chave,
        campo,
        de: fmtValor(de),
        para: fmtValor(para),
      });
    }
  }
  return mudancas;
}

export function diffLinhas<T extends object>(
  antigas: T[],
  novas: T[],
  chaveFn: (l: T) => string,
  ignorar: string[] = ["sessaoId", "id"]
): MudancaCampo[] {
  const mapAntigas = new Map(antigas.map((l) => [chaveFn(l), l]));
  const mapNovas = new Map(novas.map((l) => [chaveFn(l), l]));
  const chaves = new Set([...mapAntigas.keys(), ...mapNovas.keys()]);
  const mudancas: MudancaCampo[] = [];
  for (const chave of chaves) {
    const a = mapAntigas.get(chave) ?? ({} as T);
    const n = mapNovas.get(chave) ?? ({} as T);
    mudancas.push(...diffObjetos(chave, a, n, ignorar));
  }
  return mudancas;
}

export async function registrarEdicao(
  sessaoId: string,
  editorId: string,
  editorNome: string,
  mudancasHeader: MudancaCampo[],
  mudancasLinhas: MudancaCampo[]
) {
  if (mudancasHeader.length === 0 && mudancasLinhas.length === 0) return false;
  const agora = new Date().toISOString();
  await db.edicoes.add({
    sessaoId,
    editadoPorId: editorId,
    editadoPorNome: editorNome,
    editadoEm: agora,
    mudancasHeader,
    mudancasLinhas,
  });
  await db.sessoes.update(sessaoId, {
    editadoPorNome: editorNome,
    editadoEm: agora,
    status: "PENDENTE_SYNC",
    sincronizadoEm: undefined,
  });
  return true;
}

export async function listarEdicoes(sessaoId: string): Promise<Edicao[]> {
  return db.edicoes.where("sessaoId").equals(sessaoId).sortBy("editadoEm");
}
