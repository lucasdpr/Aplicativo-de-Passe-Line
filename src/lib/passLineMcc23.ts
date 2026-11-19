import { TOLERANCIAS, type LadoSegmento, type LeituraSegmento } from "@/types";

/**
 * Pass-Line dos Segmentos da MCC2/MCC3, igual à folha de papel
 * ("MEDIÇÃO E AJUSTE DE PASS-LINE MCC'S # 2 e 3 — Pass-line dos Segmentos").
 *
 * A folha é por EMENDA (0→1 … 6→D). Em cada emenda e em cada lado há dois
 * desenhos; cada desenho lista os rolos, um por linha, e o técnico escreve
 * a leitura na linha do rolo. Tolerância de ±1,00 mm por leitura.
 *
 * Como fica no banco (tabela leituras_segmentos, sem coluna nova):
 * - segmento = chave da emenda, ex.: "4-5" (de-para);
 * - posicao  = desenho × 10 + linha (11–16 no 1º desenho, 21–26 no 2º),
 *   com a linha contada de cima pra baixo, como no papel.
 */

export interface RoloDesenho {
  /** Segmento a que o rolo pertence ("0".."6" ou "D"). */
  segmento: string;
  rolo: number;
}

export interface EmendaMcc23 {
  indice: number;
  de: string;
  para: string;
  /** Chave gravada em leituras_segmentos.segmento. */
  chave: string;
  rotulo: string;
  /** Rolos de cada desenho, de cima pra baixo (um por linha do papel). */
  desenhos: [RoloDesenho[], RoloDesenho[]];
  /** Linha (0-based) onde o papel desenha a seta, em cada desenho. */
  setas: [number, number];
}

const SEQUENCIA = ["0", "1", "2", "3", "4", "5", "6", "D"];

function desenhosDaEmenda(de: string, para: string): [RoloDesenho[], RoloDesenho[]] {
  const r = (segmento: string, rolo: number) => ({ segmento, rolo });
  if (de === "0") {
    // O segmento 0 tem rolos até o 10.
    return [
      [r("0", 9), r("0", 10), r(para, 1), r(para, 2), r(para, 3), r(para, 4)],
      [r("0", 6), r("0", 7), r("0", 8), r("0", 9), r("0", 10), r(para, 1)],
    ];
  }
  return [
    [r(de, 5), r(para, 1), r(para, 2), r(para, 3), r(para, 4)],
    [r(de, 2), r(de, 3), r(de, 4), r(de, 5), r(para, 1)],
  ];
}

export const EMENDAS_MCC23: EmendaMcc23[] = SEQUENCIA.slice(0, -1).map((de, indice) => {
  const para = SEQUENCIA[indice + 1];
  return {
    indice,
    de,
    para,
    chave: `${de}-${para}`,
    rotulo: `${de} → ${para}`,
    desenhos: desenhosDaEmenda(de, para),
    setas: de === "0" ? [3, 2] : [2, 2],
  };
});

export const TOLERANCIA_SEGMENTOS_MCC23 = TOLERANCIAS.PASS_LINE_SEGMENTOS;
export const LADOS_MCC23: { key: LadoSegmento; label: string }[] = [
  { key: "ACIONADO", label: "Lado acionado" },
  { key: "NAO_ACIONADO", label: "Lado não acionado" },
];

export function posicaoMcc23(desenho: 1 | 2, linha: number) {
  return desenho * 10 + linha + 1;
}

export function emendaPorChave(chave: string): EmendaMcc23 | undefined {
  return EMENDAS_MCC23.find((e) => e.chave === chave);
}

/** Rolo de uma leitura gravada (undefined se não é do formato da folha). */
export function roloDaLeitura(l: Pick<LeituraSegmento, "segmento" | "posicao">) {
  const emenda = emendaPorChave(l.segmento);
  if (!emenda) return undefined;
  const desenho = Math.floor(l.posicao / 10);
  const linha = (l.posicao % 10) - 1;
  if (desenho !== 1 && desenho !== 2) return undefined;
  const rolo = emenda.desenhos[desenho - 1][linha];
  return rolo ? { emenda, desenho: desenho as 1 | 2, linha, rolo } : undefined;
}

export function rotuloRolo(r: RoloDesenho) {
  return `Seg. ${r.segmento} · rolo ${r.rolo}`;
}

/** Todas as linhas da folha, vazias, nos dois lados. */
export function leiturasIniciaisMcc23(): LeituraSegmento[] {
  const leituras: LeituraSegmento[] = [];
  for (const emenda of EMENDAS_MCC23) {
    for (const { key: lado } of LADOS_MCC23) {
      emenda.desenhos.forEach((rolos, i) => {
        rolos.forEach((_, linha) => {
          leituras.push({ segmento: emenda.chave, lado, posicao: posicaoMcc23((i + 1) as 1 | 2, linha) });
        });
      });
    }
  }
  return leituras;
}

export function leituraForaMcc23(valor: number | null | undefined) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return false;
  // Folga pra erro de ponto flutuante.
  return Math.abs(valor) > TOLERANCIA_SEGMENTOS_MCC23 + 1e-9;
}
