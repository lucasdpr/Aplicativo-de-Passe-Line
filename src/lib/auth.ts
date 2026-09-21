import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "@/lib/db/dexie";
import type { Tecnico } from "@/types";
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
    isAdmin: tecnico.isAdmin,
    criadoEm: tecnico.criadoEm,
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

export async function cadastrarTecnico(
  nome: string,
  matricula: string,
  funcao: string,
  pin: string
) {
  const nomePadronizado = nome.trim().toUpperCase();
  const matriculaPadronizada = matricula.trim().toUpperCase();

  const todos = await db.tecnicos.toArray();
  const jaExiste = todos.some(
    (t) => t.matricula.trim().toUpperCase() === matriculaPadronizada
  );
  if (jaExiste) throw new MatriculaJaCadastradaError();

  const pinHash = await hashPin(pin);
  const tecnico: Tecnico = {
    id: uuid(),
    nome: nomePadronizado,
    matricula: matriculaPadronizada,
    funcao,
    pin: pinHash,
    isAdmin: MATRICULAS_ADMIN.includes(matriculaPadronizada),
    criadoEm: new Date().toISOString(),
  };
  await db.tecnicos.add(tecnico);
  return semPinDe(tecnico);
}

export async function autenticarPorPin(
  matricula: string,
  pin: string
): Promise<Omit<Tecnico, "pin"> | null> {
  const matriculaPadronizada = matricula.trim().toUpperCase();
  const pinHash = await hashPin(pin);

  // Busca sem diferenciar maiúsculas/minúsculas: cadastros feitos antes da
  // padronização em maiúsculas ficaram salvos com a grafia original e não
  // batem numa comparação exata. Também testa TODOS os registros dessa
  // matrícula (não só o primeiro), pois versões antigas do app permitiam
  // cadastrar a mesma matrícula mais de uma vez com PINs diferentes.
  const todos = await db.tecnicos.toArray();
  const candidatos = todos.filter(
    (t) => t.matricula.trim().toUpperCase() === matriculaPadronizada
  );
  const tecnico = candidatos.find((t) => t.pin === pinHash);
  if (!tecnico) return null;

  const atualizacoes: Partial<Tecnico> = {};
  if (tecnico.matricula !== matriculaPadronizada) {
    atualizacoes.matricula = matriculaPadronizada;
  }
  if (tecnico.nome !== tecnico.nome.toUpperCase()) {
    atualizacoes.nome = tecnico.nome.toUpperCase();
  }
  // Cadastros feitos antes da matrícula entrar na lista de admins (ou antes
  // do recurso existir) são promovidos automaticamente no primeiro login.
  if (MATRICULAS_ADMIN.includes(matriculaPadronizada) && !tecnico.isAdmin) {
    atualizacoes.isAdmin = true;
  }
  if (Object.keys(atualizacoes).length > 0) {
    await db.tecnicos.update(tecnico.id, atualizacoes);
    Object.assign(tecnico, atualizacoes);
  }

  return semPinDe(tecnico);
}

export async function listarTecnicos(): Promise<Omit<Tecnico, "pin">[]> {
  const todos = await db.tecnicos.toArray();
  return todos.map(semPinDe);
}

export async function resetarPin(tecnicoId: string, novoPin: string) {
  const pinHash = await hashPin(novoPin);
  await db.tecnicos.update(tecnicoId, { pin: pinHash });
}

export async function definirAdmin(tecnicoId: string, isAdmin: boolean) {
  await db.tecnicos.update(tecnicoId, { isAdmin });
}

export async function excluirTecnico(tecnicoId: string) {
  // As medições já registradas por este técnico são mantidas no histórico
  // (o vínculo é só o cadastro de acesso, não o registro de auditoria).
  await db.tecnicos.delete(tecnicoId);
}
