/**
 * O Supabase devolve no máximo 1000 linhas por consulta (limite padrão da
 * API). Qualquer lista que possa passar disso tem que vir em páginas —
 * senão o resto some calado. Ex.: `linhas_gap` já passou de 1000 linhas e
 * a Análise estava calculando sem parte delas.
 *
 * `consulta(de, ate)` deve montar a query já com uma ordenação estável
 * (ex.: por id), pra paginação não pular nem repetir linha.
 */
const TAMANHO_PAGINA = 1000;

export async function buscarTodas<T>(
  consulta: (
    de: number,
    ate: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) return { data: todas, error };
    todas.push(...(data ?? []));
    if (!data || data.length < TAMANHO_PAGINA) return { data: todas, error: null };
  }
}
