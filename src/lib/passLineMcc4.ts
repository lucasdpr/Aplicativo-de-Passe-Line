import { TOLERANCIAS, type LadoSegmento, type LeituraSegmento } from "@/types";

/**
 * Pass-Line dos Segmentos da MCC4, como na "Planilha de medição e ajuste de
 * pass line da MCC #4": cada segmento tem 4 medidas (entrada e saída, nos
 * dois lados). Em cada emenda compara-se a saída do segmento de cima com a
 * entrada do de baixo; a diferença é o "dente", que é o que tem tolerância.
 *
 * Gravação: posição 1 = entrada, posição 2 = saída. O Bender só tem saída.
 */
export const POSICAO_ENTRADA = 1;
export const POSICAO_SAIDA = 2;
export const SEGMENTO_BENDER = "BENDER";
export const TOLERANCIA_DENTE_MCC4 = TOLERANCIAS.PASS_LINE_SEGMENTOS_MCC4;

export interface Juncao {
  /** Índice da emenda: 0 = Bender/Seg. 1, n = Seg. n/Seg. n+1. */
  indice: number;
  de: string;
  para: string;
  rotulo: string;
}

export const JUNCOES_MCC4: Juncao[] = [
  { indice: 0, de: SEGMENTO_BENDER, para: "1", rotulo: "Bender / Segmento 1" },
  ...Array.from({ length: 16 }, (_, i) => ({
    indice: i + 1,
    de: String(i + 1),
    para: String(i + 2),
    rotulo: `Segmento ${i + 1} / Segmento ${i + 2}`,
  })),
];

export interface DenteLado {
  saida?: number;
  entrada?: number;
  dente?: number;
  fora: boolean;
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function calcularDente(saida?: number, entrada?: number): number | undefined {
  if (saida === undefined || entrada === undefined) return undefined;
  return Math.round(Math.abs(saida - entrada) * 1000) / 1000;
}

export function denteFora(dente: number | undefined) {
  return dente !== undefined && dente > TOLERANCIA_DENTE_MCC4 + 1e-9;
}

/** Dentes de cada emenda, por lado, a partir das leituras gravadas. */
export function dentesPassLineMcc4(
  leituras: Pick<LeituraSegmento, "segmento" | "lado" | "posicao" | "valor">[]
): { juncao: Juncao; lados: Record<LadoSegmento, DenteLado> }[] {
  const valor = new Map<string, number | undefined>();
  for (const l of leituras) {
    valor.set(`${l.segmento}|${l.lado}|${Number(l.posicao)}`, num(l.valor));
  }
  return JUNCOES_MCC4.map((juncao) => {
    const lado = (ld: LadoSegmento): DenteLado => {
      const saida = valor.get(`${juncao.de}|${ld}|${POSICAO_SAIDA}`);
      const entrada = valor.get(`${juncao.para}|${ld}|${POSICAO_ENTRADA}`);
      const dente = calcularDente(saida, entrada);
      return { saida, entrada, dente, fora: denteFora(dente) };
    };
    return { juncao, lados: { NAO_ACIONADO: lado("NAO_ACIONADO"), ACIONADO: lado("ACIONADO") } };
  });
}
