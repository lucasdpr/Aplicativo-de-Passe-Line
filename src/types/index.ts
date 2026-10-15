// Domain types for the CSN Pass-Line inspection app.
// Four physical paper forms, all sharing the same session metadata.

export type Maquina = "MCC2" | "MCC3" | "MCC4";
export type Veio = "C" | "D" | "E" | "F" | "G" | "H"; // MCC2 -> C/D, MCC3 -> E/F, MCC4 -> G/H

export type TipoFicha =
  | "PASS_LINE_DESEMPENADEIRA"
  | "GAP"
  | "EMPENO_DESGASTE"
  | "PASS_LINE_SEGMENTOS"
  | "GAP_MCC4";

export type PapelTecnico = "TECNICO" | "VISUALIZADOR" | "ADMIN";

export interface Tecnico {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  pin: string; // hashed, never sent as-is
  papel: PapelTecnico;
  aprovado: boolean; // precisa de aprovação de um admin antes de logar
  criadoEm: string; // ISO datetime
}

export interface SessaoMedicao {
  id: string; // uuid, generated on device
  tipoFicha: TipoFicha;
  maquina: Maquina;
  veio: Veio;
  data: string; // ISO date (yyyy-mm-dd)
  tecnicoId: string;
  tecnicoNome: string;
  tecnicoMatricula: string;
  tecnicoFuncao: string;
  observacao?: string;
  inspecionadoPor?: string;
  liberadoPor?: string;
  criadoEm: string; // ISO datetime
  sincronizadoEm?: string; // ISO datetime, set once synced to Supabase
  status: "RASCUNHO" | "PENDENTE_SYNC" | "SINCRONIZADO";
  editadoPorNome?: string;
  editadoEm?: string;
}

export interface MudancaCampo {
  linhaChave: string;
  campo: string;
  de: string;
  para: string;
}

export interface Edicao {
  id?: number;
  sessaoId: string;
  editadoPorId: string;
  editadoPorNome: string;
  editadoEm: string;
  mudancasHeader: MudancaCampo[];
  mudancasLinhas: MudancaCampo[];
}

// --- Form 1: Pass-Line (Desempenadeira) ---
export interface LinhaPassLineDesempenadeira {
  nCad: number;
  oesteMedida?: number;
  oesteAcionado?: number;
  oesteAjuste?: number;
  lesteMedida?: number;
  lesteAcionado?: number;
  lesteAjuste?: number;
}

// --- Form 2: GAP ---
export interface LinhaGap {
  nCad: number;
  gapNominal: number; // printed value, e.g. 256.0
  toleranciaMm: number; // e.g. 0.5
  primeiraAcionado?: number;
  primeiraCentro?: number;
  primeiraNaoAcionado?: number;
  // Na ficha de papel esse campo é "OK" (sem ajuste) ou um marcador de nota
  // quando ajustou — não é um valor em mm.
  ajusteAcionado?: string;
  ajusteNaoAcionado?: string;
  segundaAcionado?: number;
  segundaCentro?: number;
  segundaNaoAcionado?: number;
}

// --- Form 3: Empeno e Desgaste ---
export interface LinhaEmpenoDesgaste {
  nCad: number;
  // Na ficha de papel o empeno é uma marcação de texto (ex.: "AC"), não um
  // número. O desgaste é o diâmetro bruto medido do rolo em mm (ex.: 399.22).
  empenoSuperior?: string;
  empenoInferior?: string;
  empenoPar?: string;
  desgasteSuperior?: number;
  desgasteInferior?: number;
  desgastePar?: number;
}

// --- Form 4: Pass-line dos Segmentos ---
export type LadoSegmento = "ACIONADO" | "NAO_ACIONADO";

export interface LeituraSegmento {
  segmento: string; // "0".."6" or "D"
  lado: LadoSegmento;
  posicao: number; // position index within the segment diagram
  valor?: number;
}

// --- Form 5: GAP da MCC4 (ficha própria, por segmento) ---
export type PontoGapMcc4 = "ENTRADA" | "SAIDA";

/**
 * Uma célula da "Planilha de medição e ajuste GAP da MCC #4": segmento 1–17,
 * entrada ou saída, lado acionado ou não. "ajuste" é quantos mm de calço
 * foram colocados pra levar ao padrão (a medida depois do calço não é
 * anotada). "aberto": segmento aberto (rolos travados, vira só mesa no fim
 * da linha) — não mantém GAP, então fica sem medida e não conta como fora.
 */
export interface LinhaGapMcc4 {
  segmento: number;
  ponto: PontoGapMcc4;
  lado: LadoSegmento;
  medicao?: number;
  ajuste?: number;
  aberto?: boolean;
}

export const GAP_MCC4 = { nominal: 255.0, tolerancia: 0.5, segmentos: 17 } as const;

export function foraGapMcc4(valor: number | undefined | null): boolean {
  if (valor === undefined || valor === null) return false;
  return Math.abs(Number(valor) - GAP_MCC4.nominal) > GAP_MCC4.tolerancia + 1e-9;
}

export type SituacaoGapMcc4 = "OK" | "FORA" | "AJUSTADO" | "ABERTO";

/**
 * OK: medição dentro. FORA: medição fora e sem calço. AJUSTADO: medição fora
 * e calço registrado (levado ao padrão). ABERTO: sem medida.
 */
export function situacaoGapMcc4(l: LinhaGapMcc4): SituacaoGapMcc4 | undefined {
  if (l.aberto) return "ABERTO";
  if (l.medicao === undefined || l.medicao === null) return undefined;
  if (!foraGapMcc4(l.medicao)) return "OK";
  return l.ajuste !== undefined && l.ajuste !== null && Number(l.ajuste) !== 0 ? "AJUSTADO" : "FORA";
}

export const TOLERANCIAS = {
  PASS_LINE_DESEMPENADEIRA: 0.5,
  PASS_LINE_SEGMENTOS: 1.0,
  /** MCC4 tem tolerância própria pro Pass-Line dos Segmentos: ±0,5mm. */
  PASS_LINE_SEGMENTOS_MCC4: 0.5,
} as const;

export const SEGMENTOS_PADRAO = ["0", "1", "2", "3", "4", "5", "6", "D"];
/** A MCC4 não usa "0" nem "D" — os segmentos vão de 1 a 17. */
export const SEGMENTOS_MCC4 = Array.from({ length: 17 }, (_, i) => String(i + 1));
export const N_CAD_RANGE = { min: 43, max: 79 };
/** A ficha de GAP vai só até a cadeira 75 (as demais fichas vão até a 79). */
export const N_CAD_RANGE_GAP = { min: 43, max: 75 };
