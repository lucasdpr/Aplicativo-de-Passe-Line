import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PapelTecnico } from "@/types";

/**
 * Sessão do lado do servidor. O login grava um cookie httpOnly assinado
 * (o navegador manda sozinho em todo fetch pro próprio site; JavaScript
 * não consegue ler nem forjar). Toda rota que mexe em dado confere esse
 * cookie e busca o técnico no banco a cada pedido — assim, excluir,
 * reprovar ou rebaixar alguém vale na hora, sem esperar o cookie vencer.
 *
 * Antes disso o "login" existia só no navegador (localStorage), e as rotas
 * da API aceitavam qualquer pedido.
 */

const COOKIE = "passline_sessao";
/** Longo de propósito: o app é usado offline por dias; cada login online renova. */
const VALIDADE_S = 60 * 24 * 60 * 60;

function chave(): Buffer {
  // Usa SESSION_SECRET se existir; senão deriva da chave de serviço do
  // Supabase (já é segredo só do servidor), pra não exigir configuração nova.
  const base = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Segredo de sessão não configurado no servidor.");
  return createHmac("sha256", base).update("passline-sessao-v1").digest();
}

function assinar(dados: string): string {
  return createHmac("sha256", chave()).update(dados).digest("base64url");
}

function criarToken(tecnicoId: string): string {
  const corpo = Buffer.from(
    JSON.stringify({ id: tecnicoId, exp: Math.floor(Date.now() / 1000) + VALIDADE_S })
  ).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

function lerToken(token: string | undefined): string | null {
  if (!token) return null;
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = Buffer.from(assinar(corpo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return null;
  }
  try {
    const { id, exp } = JSON.parse(Buffer.from(corpo, "base64url").toString());
    if (typeof id !== "string" || typeof exp !== "number") return null;
    if (exp < Date.now() / 1000) return null;
    return id;
  } catch {
    return null;
  }
}

/** Grava o cookie de sessão na resposta (chamar só depois de conferir o PIN). */
export function gravarSessao(resp: NextResponse, tecnicoId: string) {
  resp.cookies.set(COOKIE, criarToken(tecnicoId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VALIDADE_S,
  });
  return resp;
}

export function apagarSessao(resp: NextResponse) {
  resp.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return resp;
}

export interface TecnicoDaSessao {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  papel: PapelTecnico;
  aprovado: boolean;
  criadoEm: string;
}

/** Técnico dono do cookie, conferido no banco (null se não tem sessão válida). */
export async function tecnicoDaSessao(req: NextRequest): Promise<TecnicoDaSessao | null> {
  const id = lerToken(req.cookies.get(COOKIE)?.value);
  if (!id) return null;
  const { data } = await supabaseAdmin()
    .from("tecnicos")
    .select("id, nome, matricula, funcao, papel, aprovado, criado_em")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.aprovado) return null;
  return {
    id: data.id,
    nome: data.nome,
    matricula: data.matricula,
    funcao: data.funcao,
    papel: data.papel,
    aprovado: data.aprovado,
    criadoEm: data.criado_em,
  };
}

/**
 * Exige sessão válida (e, se `papeis` for passado, um desses papéis).
 * Devolve o técnico, ou a resposta de erro pronta pra rota retornar.
 */
export async function exigirSessao(
  req: NextRequest,
  papeis?: PapelTecnico[]
): Promise<{ tecnico: TecnicoDaSessao } | { erro: NextResponse }> {
  const tecnico = await tecnicoDaSessao(req);
  if (!tecnico) {
    return {
      erro: NextResponse.json(
        { error: "sessao_invalida", mensagem: "Sessão expirada. Saia e entre de novo com internet." },
        { status: 401 }
      ),
    };
  }
  if (papeis && !papeis.includes(tecnico.papel)) {
    return {
      erro: NextResponse.json(
        { error: "sem_permissao", mensagem: "Você não tem permissão pra fazer isso." },
        { status: 403 }
      ),
    };
  }
  return { tecnico };
}
