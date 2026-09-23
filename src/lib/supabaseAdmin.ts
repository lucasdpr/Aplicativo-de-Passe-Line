import "server-only";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cliente: any = null;

/**
 * Cliente Supabase com a chave de serviço — ignora Row Level Security.
 * Só pode ser importado de código que roda no servidor (rotas em
 * src/app/api/**), nunca de um componente cliente.
 */
export function supabaseAdmin() {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Supabase (chave de serviço) não configurado no servidor.");
  }
  cliente = createClient(url, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cliente;
}
