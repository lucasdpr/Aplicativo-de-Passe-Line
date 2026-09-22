import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "@/lib/db/dexie";
import { supabase } from "@/lib/supabase";
import type { PapelTecnico, Tecnico } from "@/types";
import { v4 as uuid } from "uuid";

const MATRICULAS_ADMIN = (process.env.NEXT_PUBLIC_ADMIN_MATRICULAS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function semPinDe(tecnico: Tecnico): Omit<Tecnico, "pin"> {
  return {
    id: tecnico.id,
    nome: tecnico.nome,
    matricula: tecnico.matricula,
    funcao: tecnico.funcao,
    papel: tecnico.papel,
    aprovado: tecnico.aprovado,
    criadoEm: tecnico.criadoEm,
  };
}

function paraLinhaRemota(t: Tecnico) {
  return {
    id: t.id,
    nome: t.nome,
    matricula: t.matricula,
    funcao: t.funcao,
    pin_hash: t.pin,
    papel: t.papel,
    aprovado: t.aprovado,
    criado_em: t.criadoEm,
  };
}

function deLinhaRemota(row: Record<string, unknown>): Tecnico {
  return {
    id: row.id as string,
    nome: row.nome as string,
    matricula: row.matricula as string,
    funcao: row.funcao as string,
    pin: row.pin_hash as string,
    papel: row.papel as PapelTecnico,
    aprovado: row.aprovado as boolean,
    criadoEm: row.criado_em as string,
  };
}

interface AuthState {
  tecnicoLogado: Omit<Tecnico, "pin"> | null;
  hidratado: boolean;
  login: (tecnico: Omit<Tecnico, "pin">) => void;
  logout: () => void;
}

let marcarHidratado: (() => void) | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => {
      marcarHidratado = () => set({ hidratado: true });
      return {
        tecnicoLogado: null,
        hidratado: false,
        login: (tecnico) => set({ tecnicoLogado: tecnico }),
        logout: () => set({ tecnicoLogado: null }),
      };
    },
    {
      name: "passline-auth",
      onRehydrateStorage: () => () => {
        marcarHidratado?.();
      },
    }
  )
);

export class MatriculaJaCadastradaError extends Error {
  constructor() {
    super("Matrícula já cadastrada. Faça login ou peça para um admin resetar seu PIN.");
    this.name = "MatriculaJaCadastradaError";
  }
}

export class CadastroPendenteError extends Error {
  constructor() {
    super(
      "Seu cadastro foi enviado, mas ainda precisa ser aprovado por um administrador antes de você poder entrar."
    );
    this.name = "CadastroPendenteError";
  }
}

export class SemConexaoError extends Error {
  constructor() {
    super(
      "Sem conexão com a internet agora. É preciso estar online pra cadastrar (o cadastro é compartilhado entre os aparelhos)."
    );
    this.name = "SemConexaoError";
  }
}

export async function cadastrarTecnico(
  nome: string,
  matricula: string,
  funcao: string,
  pin: string,
  tipoAcesso: "tecnico" | "visitante" = "tecnico"
) {
  if (!supabase || !navigator.onLine) throw new SemConexaoError();

  const nomePadronizado = nome.trim().toUpperCase();
  const matriculaPadronizada = matricula.trim().toUpperCase();

  const { data: existentes, error: buscaError } = await supabase
    .from("tecnicos")
    .select("id")
    .ilike("matricula", matriculaPadronizada);
  if (buscaError) throw buscaError;
  if (existentes && existentes.length > 0) throw new MatriculaJaCadastradaError();

  const pinHash = await hashPin(pin);
  const ehAdmin = MATRICULAS_ADMIN.includes(matriculaPadronizada);
  const tecnico: Tecnico = {
    id: uuid(),
    nome: nomePadronizado,
    matricula: matriculaPadronizada,
    funcao,
    pin: pinHash,
    papel: ehAdmin ? "ADMIN" : tipoAcesso === "visitante" ? "VISUALIZADOR" : "TECNICO",
    // Matrículas da lista de admins pulam a fila de aprovação; as demais
    // ficam pendentes até um admin confirmar no painel.
    aprovado: ehAdmin,
    criadoEm: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from("tecnicos")
    .insert(paraLinhaRemota(tecnico));
  if (insertError) throw insertError;

  await db.tecnicos.put(tecnico);
  return semPinDe(tecnico);
}

export async function autenticarPorPin(
  matricula: string,
  pin: string
): Promise<Omit<Tecnico, "pin"> | null> {
  const matriculaPadronizada = matricula.trim().toUpperCase();
  const pinHash = await hashPin(pin);

  if (supabase && navigator.onLine) {
    const { data: linhasRemotas, error } = await supabase
      .from("tecnicos")
      .select("*")
      .ilike("matricula", matriculaPadronizada);

    if (!error && linhasRemotas) {
      const candidatos = linhasRemotas.map(deLinhaRemota);
      const tecnico = candidatos.find((t) => t.pin === pinHash);

      if (tecnico) {
        if (!tecnico.aprovado) throw new CadastroPendenteError();

        const atualizacoes: Partial<Tecnico> = {};
        if (tecnico.matricula !== matriculaPadronizada) {
          atualizacoes.matricula = matriculaPadronizada;
        }
        if (tecnico.nome !== tecnico.nome.toUpperCase()) {
          atualizacoes.nome = tecnico.nome.toUpperCase();
        }
        if (MATRICULAS_ADMIN.includes(matriculaPadronizada) && tecnico.papel !== "ADMIN") {
          atualizacoes.papel = "ADMIN";
        }
        if (Object.keys(atualizacoes).length > 0) {
          const atualizado = { ...tecnico, ...atualizacoes };
          await supabase
            .from("tecnicos")
            .update(paraLinhaRemota(atualizado))
            .eq("id", tecnico.id);
          Object.assign(tecnico, atualizacoes);
        }

        // Guarda uma cópia local pra esse aparelho continuar aceitando o
        // login desse técnico mesmo sem internet depois.
        await db.tecnicos.put(tecnico);
        return semPinDe(tecnico);
      }

      // Não achou na nuvem: pode ser um cadastro antigo, feito antes desta
      // versão (só existia no aparelho). Confere no cache local e, se bater
      // o PIN, migra esse técnico pra nuvem agora (mantendo o acesso que já
      // tinha, sem exigir aprovação de novo).
      const legado = await buscarLegadoLocal(matriculaPadronizada, pinHash);
      if (legado) {
        const migrado: Tecnico = {
          ...legado,
          matricula: matriculaPadronizada,
          nome: legado.nome.toUpperCase(),
          papel: MATRICULAS_ADMIN.includes(matriculaPadronizada)
            ? "ADMIN"
            : legado.papel,
          aprovado: true,
        };
        const { error: upsertError } = await supabase
          .from("tecnicos")
          .upsert(paraLinhaRemota(migrado));
        if (!upsertError) {
          await db.tecnicos.put(migrado);
          return semPinDe(migrado);
        }
      }
    }
  }

  // Offline (ou Supabase indisponível no momento): usa o cache local deste
  // aparelho, alimentado por logins online anteriores.
  const tecnicoLocal = await buscarLegadoLocal(matriculaPadronizada, pinHash);
  if (!tecnicoLocal) return null;
  if (!tecnicoLocal.aprovado) throw new CadastroPendenteError();
  return semPinDe(tecnicoLocal);
}

/**
 * Busca no cache local deste aparelho por matrícula+PIN. Também repara
 * cadastros feitos antes da nuvem/aprovação existirem (sem os campos
 * `papel`/`aprovado`), tratando-os como técnicos já aprovados — nunca fica
 * mais restritivo do que o acesso que a pessoa já tinha.
 */
async function buscarLegadoLocal(
  matriculaPadronizada: string,
  pinHash: string
): Promise<Tecnico | null> {
  const todosLocais = await db.tecnicos.toArray();
  const candidatosLocais = todosLocais.filter(
    (t) => t.matricula.trim().toUpperCase() === matriculaPadronizada
  );
  const encontrado = candidatosLocais.find((t) => t.pin === pinHash);
  if (!encontrado) return null;

  const eraAdminAntigo = (encontrado as unknown as { isAdmin?: boolean }).isAdmin;
  return {
    ...encontrado,
    papel: encontrado.papel ?? (eraAdminAntigo ? "ADMIN" : "TECNICO"),
    aprovado: encontrado.aprovado ?? true,
  };
}

/** Lista todos os técnicos cadastrados (aprovados ou não). Requer internet. */
export async function listarTecnicos(): Promise<Omit<Tecnico, "pin">[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tecnicos")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => semPinDe(deLinhaRemota(row)));
}

export async function aprovarTecnico(tecnicoId: string) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("tecnicos")
    .update({ aprovado: true })
    .eq("id", tecnicoId);
  if (error) throw error;
}

export async function resetarPin(tecnicoId: string, novoPin: string) {
  if (!supabase) throw new Error("Supabase não configurado");
  const pinHash = await hashPin(novoPin);
  const { error } = await supabase
    .from("tecnicos")
    .update({ pin_hash: pinHash })
    .eq("id", tecnicoId);
  if (error) throw error;
}

export async function definirPapel(tecnicoId: string, papel: PapelTecnico) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("tecnicos")
    .update({ papel })
    .eq("id", tecnicoId);
  if (error) throw error;
}

export async function excluirTecnico(tecnicoId: string) {
  if (!supabase) throw new Error("Supabase não configurado");
  // As medições já registradas por este técnico são mantidas no histórico
  // (o vínculo é só o cadastro de acesso, não o registro de auditoria).
  const { error } = await supabase.from("tecnicos").delete().eq("id", tecnicoId);
  if (error) throw error;
  await db.tecnicos.delete(tecnicoId);
}
