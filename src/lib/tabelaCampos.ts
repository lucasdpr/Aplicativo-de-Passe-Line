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

/**
 * Converte o texto bruto de um campo de medida (mm) pra número, tratando os
 * últimos dígitos digitados como as casas decimais — assim o técnico digita
 * só os números no teclado numérico do celular (ex.: "2604" com 1 casa vira
 * "260,4") sem precisar procurar o ponto/vírgula. `casasDecimais` deve bater
 * com a precisão real usada nessa ficha (1 casa pro GAP, 2 pras outras). Se
 * o texto colado já tiver um separador, os dígitos ao redor dele são usados
 * do mesmo jeito (colar "260.4" também vira 260,4).
 */
export function paraValorDigitado(
  valorTexto: string,
  casasDecimais: 1 | 2 = 1
): number | undefined {
  if (valorTexto.trim() === "") return undefined;
  const negativo = valorTexto.trim().startsWith("-");
  const digitos = valorTexto.replace(/[^0-9]/g, "");
  if (digitos === "") {
    // Só o sinal de "-" foi digitado ainda, sem nenhum dígito — "-0" guarda
    // essa intenção (não dá pra representar isso só com "undefined", senão
    // o próximo dígito digitado perderia o sinal).
    return negativo ? -0 : undefined;
  }
  const numero = Number(digitos) / Math.pow(10, casasDecimais);
  return negativo ? -numero : numero;
}

/**
 * Formata o valor pra exibir no campo, sempre com o número de casas decimais
 * combinado e sem zero à esquerda (".2" em vez de "0,2") — o zero à esquerda
 * faria o próximo dígito digitado entrar na sequência errada em
 * `paraValorDigitado`. `casasDecimais` precisa ser o mesmo usado lá.
 */
export function formatarValorDigitado(
  valor: number | undefined,
  casasDecimais: 1 | 2 = 1
): string {
  if (valor === undefined || Number.isNaN(valor)) return "";
  const negativo = valor < 0 || Object.is(valor, -0);
  const textoAbs = Math.abs(valor).toFixed(casasDecimais);
  const semZeroInicial = textoAbs.startsWith("0.") ? textoAbs.slice(1) : textoAbs;
  return (negativo ? "-" : "") + semZeroInicial;
}

/** Estilo pra faixa alternada + divisória entre grupos de colunas na tabela. */
export function estiloColuna(indiceGrupo: number, primeiraDoGrupo: boolean) {
  return {
    background: indiceGrupo % 2 === 1 ? "rgba(255, 255, 255, 0.025)" : undefined,
    borderLeft: primeiraDoGrupo && indiceGrupo > 0 ? "1px solid var(--border-strong)" : undefined,
  } as CSSProperties;
}
