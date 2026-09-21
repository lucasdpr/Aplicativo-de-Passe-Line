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

export async function cadastrarTecnico(
  nome: string,
  matricula: string,
  funcao: string,
  pin: string
) {
  const nomePadronizado = nome.trim().toUpperCase();
  const matriculaPadronizada = matricula.trim().toUpperCase();
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
  const tecnico = await db.tecnicos
    .where("matricula")
    .equals(matriculaPadronizada)
    .first();
  if (!tecnico || tecnico.pin !== pinHash) return null;

  // Cadastros feitos antes da matrícula entrar na lista de admins (ou antes
  // do recurso existir) são promovidos automaticamente no primeiro login.
  if (MATRICULAS_ADMIN.includes(matriculaPadronizada) && !tecnico.isAdmin) {
    await db.tecnicos.update(tecnico.id, { isAdmin: true });
    tecnico.isAdmin = true;
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
