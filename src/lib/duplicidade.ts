"use client";

import { db } from "@/lib/db/dexie";
import type { Maquina, TipoFicha, Veio } from "@/types";

// Campos que só identificam a linha (vêm preenchidos mesmo sem medir nada).
const CAMPOS_ESTRUTURAIS = new Set([
  "id",
  "sessaoId",
  "nCad",
  "gapNominal",
  "toleranciaMm",
  "segmento",
  "lado",
  "posicao",
]);

function linhasNormalizadas(linhas: object[]): string[] {
  return linhas
    .map((l) =>
      Object.entries(l)
        .filter(([k, v]) => k !== "id" && k !== "sessaoId" && v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, typeof v === "number" ? Number(v) : v] as const)
        .sort(([a], [b]) => a.localeCompare(b))
    )
    .filter((entradas) => entradas.some(([k]) => !CAMPOS_ESTRUTURAIS.has(k)))
    .map((entradas) => JSON.stringify(entradas))
    .sort();
}

async function linhasDaSessao(tipoFicha: TipoFicha, sessaoId: string): Promise<object[]> {
  switch (tipoFicha) {
    case "GAP":
      return db.linhasGap.where("sessaoId").equals(sessaoId).toArray();
    case "EMPENO_DESGASTE":
      return db.linhasEmpenoDesgaste.where("sessaoId").equals(sessaoId).toArray();
    case "PASS_LINE_DESEMPENADEIRA":
      return db.linhasPassLineDesempenadeira.where("sessaoId").equals(sessaoId).toArray();
    case "PASS_LINE_SEGMENTOS":
      return db.leiturasSegmentos.where("sessaoId").equals(sessaoId).toArray();
  }
}

function dataBr(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Procura outra medição da mesma ficha/máquina/veio que seja do mesmo dia ou
 * que tenha exatamente os mesmos valores (ex.: a mesma folha lançada de novo
 * com a data trocada). Devolve a mensagem de aviso, ou null se não achou nada.
 */
export async function verificarDuplicidade(
  tipoFicha: TipoFicha,
  header: { maquina: Maquina; veio: Veio; data: string },
  linhas: object[],
  sessaoIdAtual?: string | null
): Promise<string | null> {
  const outras = (
    await db.sessoes.where("tipoFicha").equals(tipoFicha).toArray()
  ).filter(
    (s) => s.id !== sessaoIdAtual && s.maquina === header.maquina && s.veio === header.veio
  );
  if (outras.length === 0) return null;

  const mesmoDia = outras.find((s) => s.data === header.data);
  if (mesmoDia) {
    return `Já existe uma medição desta ficha para ${header.maquina} veio ${header.veio} no dia ${dataBr(header.data)} (${mesmoDia.tecnicoNome}). Salvar mesmo assim?`;
  }

  const minhas = linhasNormalizadas(linhas);
  if (minhas.length === 0) return null;
  const conjunto = new Set(minhas);
  for (const s of outras) {
    const delas = linhasNormalizadas(await linhasDaSessao(tipoFicha, s.id));
    const iguais = delas.filter((l) => conjunto.has(l)).length;
    if (iguais === minhas.length && iguais === delas.length) {
      return `Os valores desta medição são idênticos aos da medição de ${dataBr(s.data)} (${s.tecnicoNome}) para ${header.maquina} veio ${header.veio}. Pode ser a mesma folha lançada de novo. Salvar mesmo assim?`;
    }
  }
  return null;
}
