// Domain types for the CSN Pass-Line inspection app.
// Four physical paper forms, all sharing the same session metadata.

export type Maquina = "MCC2" | "MCC3";
export type Veio = "C" | "D" | "E" | "F"; // MCC2 -> C/D, MCC3 -> E/F

export type TipoFicha =
  | "PASS_LINE_DESEMPENADEIRA"
  | "GAP"
  | "EMPENO_DESGASTE"
  | "PASS_LINE_SEGMENTOS";

export interface Tecnico {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  pin: string; // hashed locally, never sent as-is
  isAdmin?: boolean;
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
  ajusteAcionado?: number;
  ajusteNaoAcionado?: number;
  segundaAcionado?: number;
  segundaCentro?: number;
  segundaNaoAcionado?: number;
}

// --- Form 3: Empeno e Desgaste ---
export interface LinhaEmpenoDesgaste {
  nCad: number;
  empenoSuperior?: number;
  empenoInferior?: number;
  empenoPar?: number;
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

export const TOLERANCIAS = {
  PASS_LINE_DESEMPENADEIRA: 0.5,
  EMPENO_DESGASTE: 2.0,
  PASS_LINE_SEGMENTOS: 1.0,
} as const;

export const SEGMENTOS_PADRAO = ["0", "1", "2", "3", "4", "5", "6", "D"];
export const N_CAD_RANGE = { min: 42, max: 79 };
