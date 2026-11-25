import type { SessaoMedicao, TipoFicha } from "@/types";

/** Rota do formulário de cada ficha (o mesmo formulário serve pra editar). */
export const SLUG_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "pass-line-desempenadeira",
  GAP: "gap",
  EMPENO_DESGASTE: "empeno-desgaste",
  PASS_LINE_SEGMENTOS: "pass-line-segmentos",
  GAP_MCC4: "gap-mcc4",
};

/** Abre a medição no formulário pra editar (cabeçalho, data e valores). */
export function linkEdicao(s: Pick<SessaoMedicao, "id" | "tipoFicha">) {
  return `/formularios/${SLUG_POR_TIPO[s.tipoFicha]}?sessaoId=${s.id}`;
}
