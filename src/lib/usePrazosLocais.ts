"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { calcularPrazos, chaveCombo, type PrazoCalculado } from "@/lib/prazos";

/** Dias até vencer a partir dos quais o prazo já pede atenção. */
export const DIAS_ALERTA = 7;

export type EstadoPrazo = "atrasado" | "vencendo" | "em_dia";

export function estadoDoPrazo(diasRestantes: number): EstadoPrazo {
  if (diasRestantes < 0) return "atrasado";
  if (diasRestantes <= DIAS_ALERTA) return "vencendo";
  return "em_dia";
}

export interface ResumoPrazos {
  prazos: PrazoCalculado[];
  porChave: Map<string, PrazoCalculado>;
  atrasados: number;
  vencendo: number;
  emDia: number;
}

/**
 * Prazos calculados com as medições que estão no aparelho (as sincronizadas
 * de todo mundo + as daqui ainda não enviadas) — funciona sem internet.
 */
export function usePrazosLocais(): ResumoPrazos | undefined {
  return useLiveQuery(async () => {
    const sessoes = await db.sessoes.toArray();
    const ultimas = new Map<string, string>();
    for (const s of sessoes) {
      if (s.status === "RASCUNHO") continue;
      const chave = chaveCombo(s);
      const atual = ultimas.get(chave);
      if (!atual || s.data > atual) ultimas.set(chave, s.data);
    }
    const prazos = calcularPrazos(ultimas);
    const porChave = new Map(prazos.map((p) => [chaveCombo(p), p]));
    let atrasados = 0;
    let vencendo = 0;
    let emDia = 0;
    for (const p of prazos) {
      const e = estadoDoPrazo(p.diasRestantes);
      if (e === "atrasado") atrasados++;
      else if (e === "vencendo") vencendo++;
      else emDia++;
    }
    return { prazos, porChave, atrasados, vencendo, emDia };
  }, []);
}
