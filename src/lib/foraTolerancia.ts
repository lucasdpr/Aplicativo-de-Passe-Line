import { dentesPassLineMcc4 } from "@/lib/passLineMcc4";
import {
  TOLERANCIAS,
  situacaoGapMcc4,
  type LeituraSegmento,
  type LinhaGap,
  type LinhaGapMcc4,
  type LinhaPassLineDesempenadeira,
  type Maquina,
  type SessaoMedicao,
} from "@/types";

const EPS = 1e-9; // 260,2 - 260,5 dá 0,30000000000001

/**
 * Quantos pontos de cada medição ficaram fora da tolerância, só pras fichas
 * que têm regra clara: GAP (vale a 2ª medida quando feita, senão a 1ª),
 * Pass-Line da Desempenadeira (rolo x régua, ±0,50) e Pass-Line dos Segmentos.
 */
export function contarForaPorSessao(
  sessoes: SessaoMedicao[],
  linhasGap: (LinhaGap & { sessaoId: string })[],
  leituras: (LeituraSegmento & { sessaoId: string })[],
  linhasDesempenadeira: (LinhaPassLineDesempenadeira & { sessaoId: string })[] = [],
  linhasGapMcc4: (LinhaGapMcc4 & { sessaoId: string })[] = []
): Map<string, number> {
  const maquinaPorSessao = new Map<string, Maquina>(sessoes.map((s) => [s.id, s.maquina]));
  const fora = new Map<string, number>();
  const somar = (id: string) => fora.set(id, (fora.get(id) ?? 0) + 1);

  for (const l of linhasGap) {
    const pares = [
      [l.segundaAcionado, l.primeiraAcionado],
      [l.segundaCentro, l.primeiraCentro],
      [l.segundaNaoAcionado, l.primeiraNaoAcionado],
    ] as const;
    for (const [segunda, primeira] of pares) {
      const valor = segunda ?? primeira;
      if (valor === undefined || valor === null) continue;
      if (Math.abs(valor - l.gapNominal) > l.toleranciaMm + EPS) somar(l.sessaoId);
    }
  }

  for (const l of linhasGapMcc4) {
    if (situacaoGapMcc4(l) === "FORA") somar(l.sessaoId);
  }

  for (const l of linhasDesempenadeira) {
    for (const v of [l.oesteMedida, l.oesteAcionado, l.lesteMedida, l.lesteAcionado]) {
      if (v === undefined || v === null) continue;
      if (Math.abs(v) > 0.5 + EPS) somar(l.sessaoId);
    }
  }

  const mcc4 = new Map<string, (LeituraSegmento & { sessaoId: string })[]>();
  for (const l of leituras) {
    if (maquinaPorSessao.get(l.sessaoId) !== "MCC4") continue;
    mcc4.set(l.sessaoId, [...(mcc4.get(l.sessaoId) ?? []), l]);
  }
  for (const [sessaoId, lista] of mcc4) {
    for (const { lados } of dentesPassLineMcc4(lista)) {
      for (const d of Object.values(lados)) if (d.fora) somar(sessaoId);
    }
  }

  for (const l of leituras) {
    if (maquinaPorSessao.get(l.sessaoId) === "MCC4") continue;
    if (l.valor === undefined || l.valor === null) continue;
    const tol =
      maquinaPorSessao.get(l.sessaoId) === "MCC4"
        ? TOLERANCIAS.PASS_LINE_SEGMENTOS_MCC4
        : TOLERANCIAS.PASS_LINE_SEGMENTOS;
    if (Math.abs(l.valor) > tol + EPS) somar(l.sessaoId);
  }
  return fora;
}
