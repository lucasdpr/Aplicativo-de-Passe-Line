import type { CSSProperties } from "react";

export interface CampoAgrupado<K extends string> {
  key: K;
  label: string;
  grupo: string;
}

export interface GrupoColunas<K extends string> {
  nome: string;
  indice: number;
  campos: CampoAgrupado<K>[];
}

/** Agrupa uma lista de campos (na ordem em que aparecem) pelos "grupo" consecutivos iguais. */
export function agruparCampos<K extends string>(
  campos: CampoAgrupado<K>[]
): GrupoColunas<K>[] {
  const grupos: GrupoColunas<K>[] = [];
  for (const campo of campos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nome === campo.grupo) {
      ultimo.campos.push(campo);
    } else {
      grupos.push({ nome: campo.grupo, indice: grupos.length, campos: [campo] });
    }
  }
  return grupos;
}

/**
 * Limita um número digitado a uma faixa físicamente sensata, pra pegar erro
 * de digitação (ex.: escreveu "1000" sem querer em vez de "1,00") antes de
 * ele ir parar no banco.
 */
export function clamparNumero(valor: number, min: number, max: number): number {
  if (Number.isNaN(valor)) return valor;
  return Math.min(max, Math.max(min, valor));
}

/** Estilo pra faixa alternada + divisória entre grupos de colunas na tabela. */
export function estiloColuna(indiceGrupo: number, primeiraDoGrupo: boolean) {
  return {
    background: indiceGrupo % 2 === 1 ? "rgba(255, 255, 255, 0.025)" : undefined,
    borderLeft: primeiraDoGrupo && indiceGrupo > 0 ? "1px solid var(--border-strong)" : undefined,
  } as CSSProperties;
}
