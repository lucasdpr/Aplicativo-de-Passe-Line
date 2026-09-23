import type { SupabaseClient } from "@supabase/supabase-js";
import type { Maquina, TipoFicha, Veio } from "@/types";

const VEIOS_POR_MAQUINA: Record<Maquina, Veio[]> = {
  MCC2: ["C", "D"],
  MCC3: ["E", "F"],
  MCC4: ["G", "H"],
};

const FICHAS_MONITORADAS: TipoFicha[] = [
  "PASS_LINE_DESEMPENADEIRA",
  "GAP",
  "EMPENO_DESGASTE",
];

/**
 * Nem toda máquina tem as mesmas fichas — a MCC4 usa Pass-Line dos
 * Segmentos (não a Desempenadeira, que é só MCC2/MCC3) e GAP, mas não tem
 * Empeno e Desgaste.
 */
const FICHAS_POR_MAQUINA: Record<Maquina, TipoFicha[]> = {
  MCC2: FICHAS_MONITORADAS,
  MCC3: FICHAS_MONITORADAS,
  MCC4: ["PASS_LINE_SEGMENTOS", "GAP"],
};

const NOMES_FICHA: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

/** Prazo, em dias, entre uma medição e a próxima obrigatória. */
export function intervaloDias(tipoFicha: TipoFicha, maquina: Maquina): number {
  if (maquina === "MCC4") return 45;
  if (tipoFicha === "GAP") return 30;
  return 120; // Pass-Line (Desempenadeira) e Empeno/Desgaste, MCC2/MCC3
}

export interface Combo {
  tipoFicha: TipoFicha;
  maquina: Maquina;
  veio: Veio;
}

export function comboLabel(c: Combo): string {
  return `${NOMES_FICHA[c.tipoFicha]} — ${c.maquina} veio ${c.veio}`;
}

export function todosOsCombos(): Combo[] {
  const combos: Combo[] = [];
  for (const maquina of Object.keys(VEIOS_POR_MAQUINA) as Maquina[]) {
    for (const veio of VEIOS_POR_MAQUINA[maquina]) {
      for (const tipoFicha of FICHAS_POR_MAQUINA[maquina]) {
        combos.push({ tipoFicha, maquina, veio });
      }
    }
  }
  return combos;
}

export interface PrazoCalculado extends Combo {
  ultimaMedicaoEm: string; // yyyy-mm-dd
  dataAlvo: string; // yyyy-mm-dd, quando a próxima medição vence
  diasRestantes: number; // negativo = atrasado
}

function somarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(hojeIso: string, alvoIso: string): number {
  const hoje = new Date(`${hojeIso}T00:00:00Z`).getTime();
  const alvo = new Date(`${alvoIso}T00:00:00Z`).getTime();
  return Math.round((alvo - hoje) / 86_400_000);
}

/**
 * Recebe um mapa "tipoFicha|maquina|veio" -> última data de medição (yyyy-mm-dd)
 * e devolve o cálculo de prazo para cada combo monitorado que já teve pelo
 * menos uma medição registrada (sem histórico, não dá pra saber quando vence).
 */
export function calcularPrazos(
  ultimasMedicoes: Map<string, string>,
  hojeIso: string = new Date().toISOString().slice(0, 10)
): PrazoCalculado[] {
  const resultado: PrazoCalculado[] = [];
  for (const combo of todosOsCombos()) {
    const chave = `${combo.tipoFicha}|${combo.maquina}|${combo.veio}`;
    const ultimaMedicaoEm = ultimasMedicoes.get(chave);
    if (!ultimaMedicaoEm) continue;
    const dataAlvo = somarDias(
      ultimaMedicaoEm,
      intervaloDias(combo.tipoFicha, combo.maquina)
    );
    const diasRestantes = diasEntre(hojeIso, dataAlvo);
    resultado.push({ ...combo, ultimaMedicaoEm, dataAlvo, diasRestantes });
  }
  return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

export function chaveCombo(c: Combo): string {
  return `${c.tipoFicha}|${c.maquina}|${c.veio}`;
}

/**
 * Busca, por tipoFicha+maquina+veio, a data da medição mais recente já
 * sincronizada. Usa apenas colunas leves (sem trazer as linhas).
 */
export async function buscarUltimasMedicoes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const { data } = await supabase
    .from("sessoes_medicao")
    .select("tipo_ficha, maquina, veio, data")
    .order("data", { ascending: false });

  for (const row of data ?? []) {
    const chave = `${row.tipo_ficha}|${row.maquina}|${row.veio}`;
    if (!mapa.has(chave)) mapa.set(chave, row.data as string);
  }
  return mapa;
}
