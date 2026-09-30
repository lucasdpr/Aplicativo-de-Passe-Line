"use client";

/** Lê dados de medição pelo servidor (exige login). Lança erro se falhar. */
export async function lerDados<T>(params: Record<string, string>): Promise<T> {
  const resp = await fetch(`/api/dados?${new URLSearchParams(params)}`, {
    credentials: "same-origin",
  });
  if (!resp.ok) throw new Error(`Falha ao ler dados (${resp.status})`);
  return resp.json() as Promise<T>;
}
