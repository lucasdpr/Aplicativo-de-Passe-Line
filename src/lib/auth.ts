import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "@/lib/db/dexie";
import type { Tecnico } from "@/types";
import { v4 as uuid } from "uuid";

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface AuthState {
  tecnicoLogado: Omit<Tecnico, "pin"> | null;
  login: (tecnico: Omit<Tecnico, "pin">) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tecnicoLogado: null,
      login: (tecnico) => set({ tecnicoLogado: tecnico }),
      logout: () => set({ tecnicoLogado: null }),
    }),
    { name: "passline-auth" }
  )
);

export async function cadastrarTecnico(
  nome: string,
  matricula: string,
  funcao: string,
  pin: string
) {
  const pinHash = await hashPin(pin);
  const tecnico: Tecnico = {
    id: uuid(),
    nome,
    matricula,
    funcao,
    pin: pinHash,
  };
  await db.tecnicos.add(tecnico);
  const { pin: _pin, ...semPin } = tecnico;
  void _pin;
  return semPin;
}

export async function autenticarPorPin(
  matricula: string,
  pin: string
): Promise<Omit<Tecnico, "pin"> | null> {
  const pinHash = await hashPin(pin);
  const tecnico = await db.tecnicos
    .where("matricula")
    .equals(matricula)
    .first();
  if (!tecnico || tecnico.pin !== pinHash) return null;
  const semPin: Omit<Tecnico, "pin"> = {
    id: tecnico.id,
    nome: tecnico.nome,
    matricula: tecnico.matricula,
    funcao: tecnico.funcao,
  };
  return semPin;
}
