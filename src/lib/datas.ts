/**
 * Data de hoje (AAAA-MM-DD) no horário de Brasília.
 *
 * Não usar `new Date().toISOString().slice(0, 10)`: isso é a data em UTC,
 * que das 21h à meia-noite já é o dia seguinte — a medição do turno da
 * noite saía com a data de amanhã e o "vence hoje" chegava um dia antes.
 * O fuso é fixo (e não o do aparelho) porque o mesmo cálculo roda no
 * servidor, que fica em UTC.
 */
export const FUSO_USINA = "America/Sao_Paulo";

export function hojeIso(agora: Date = new Date()): string {
  // "sv-SE" formata como AAAA-MM-DD.
  return agora.toLocaleDateString("sv-SE", { timeZone: FUSO_USINA });
}
