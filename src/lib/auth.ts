import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "@/lib/db/dexie";
import { conferirPin, gerarHashPin } from "@/lib/pinHash";
import type { PapelTecnico, Tecnico } from "@/types";


/**
 * Guarda uma cópia local do técnico (pra login offline depois). Em aba
 * anônima/privada alguns navegadores bloqueiam ou limitam o IndexedDB —
 * isso nunca pode derrubar um login que já foi confirmado pelo servidor.
 */
async function guardarLocalSeConseguir(tecnico: Tecnico) {
  try {
    await db.tecnicos.put(tecnico);
  } catch (err) {
    console.warn("Não foi possível guardar o técnico localmente", err);
  }
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
        logout: () => {
          // Apaga também o cookie de sessão do servidor (se tiver internet;
          // sem internet ele fica, mas o próximo login online substitui).
          fetch("/api/auth/sair", { method: "POST" }).catch(() => {});
          set({ tecnicoLogado: null });
        },
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

export class LoginBloqueadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "LoginBloqueadoError";
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
  if (!navigator.onLine) throw new SemConexaoError();

  const resp = await fetch("/api/auth/cadastrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, matricula, funcao, pin, tipoAcesso }),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (corpo.error === "matricula_ja_cadastrada") throw new MatriculaJaCadastradaError();
    throw new Error(corpo.mensagem ?? corpo.error ?? "Não foi possível cadastrar.");
  }

  // Cópia local pra login offline: hash lento com sal, feito aqui mesmo
  // (o servidor não devolve mais o hash dele).
  const tecnico: Tecnico = { ...corpo.tecnico, pin: await gerarHashPin(pin) };
  await guardarLocalSeConseguir(tecnico);
  return semPinDe(tecnico);
}

export async function autenticarPorPin(
  matricula: string,
  pin: string
): Promise<Omit<Tecnico, "pin"> | null> {
  const matriculaPadronizada = matricula.trim().toUpperCase();

  if (navigator.onLine) {
    try {
      // "navigator.onLine" só confirma que tem link de rede (ex.: conectado
      // no wifi), não que a internet realmente funciona. Com wifi fraco/sem
      // sinal de verdade, o fetch ficaria pendurado sem responder — por
      // isso um limite de tempo curto, pra cair rápido no login local.
      const resp = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula: matriculaPadronizada, pin }),
        signal: AbortSignal.timeout(8000),
      });

      if (resp.status === 403) throw new CadastroPendenteError();
      if (resp.status === 429) {
        const corpo = await resp.json().catch(() => ({}));
        throw new LoginBloqueadoError(corpo.mensagem ?? "Muitas tentativas. Espere alguns minutos.");
      }
      // PIN errado conferido pelo servidor: não cai pro login offline (senão
      // um PIN antigo guardado neste aparelho ainda entraria).
      if (resp.status === 404) return null;

      if (resp.ok) {
        const { tecnico: encontrado } = await resp.json();
        const tecnico: Tecnico = { ...encontrado, pin: await gerarHashPin(pin) };
        await guardarLocalSeConseguir(tecnico);
        return semPinDe(tecnico);
      }

    } catch (err) {
      if (err instanceof CadastroPendenteError || err instanceof LoginBloqueadoError) throw err;
      // Falha de rede genuína: cai pro fallback local abaixo.
    }
  }

  // Offline (ou servidor indisponível no momento): usa o cache local deste
  // aparelho, alimentado por logins online anteriores.
  const tecnicoLocal = await buscarLegadoLocal(matriculaPadronizada, pin);
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
  pin: string
): Promise<Tecnico | null> {
  let todosLocais: Tecnico[];
  try {
    todosLocais = await db.tecnicos.toArray();
  } catch (err) {
    console.warn("IndexedDB indisponível pra checar cadastro local", err);
    return null;
  }
  const candidatosLocais = todosLocais.filter(
    (t) => t.matricula.trim().toUpperCase() === matriculaPadronizada
  );
  let encontrado: Tecnico | undefined;
  for (const t of candidatosLocais) {
    const r = await conferirPin(pin, t.pin);
    if (r.ok) {
      encontrado = t;
      // Hash antigo (SHA-256 sem sal) guardado neste aparelho: troca agora.
      if (r.formatoAntigo) {
        encontrado = { ...t, pin: await gerarHashPin(pin) };
        await guardarLocalSeConseguir(encontrado);
      }
      break;
    }
  }
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
  try {
    const resp = await fetch("/api/tecnicos");
    if (!resp.ok) return [];
    const { tecnicos } = await resp.json();
    return tecnicos ?? [];
  } catch {
    return [];
  }
}

export async function aprovarTecnico(tecnicoId: string) {
  const resp = await fetch(`/api/tecnicos/${tecnicoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "aprovar" }),
  });
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    throw new Error(corpo.mensagem ?? corpo.error ?? "Não foi possível aprovar.");
  }
}

export async function resetarPin(tecnicoId: string, novoPin: string) {
  const resp = await fetch(`/api/tecnicos/${tecnicoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "resetarPin", novoPin }),
  });
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    throw new Error(corpo.mensagem ?? corpo.error ?? "Não foi possível resetar o PIN.");
  }
}

export async function definirPapel(tecnicoId: string, papel: PapelTecnico) {
  const resp = await fetch(`/api/tecnicos/${tecnicoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "papel", papel }),
  });
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    throw new Error(corpo.mensagem ?? corpo.error ?? "Não foi possível trocar o papel.");
  }
}

export async function excluirTecnico(tecnicoId: string) {
  // As medições já registradas por este técnico são mantidas no histórico
  // (o vínculo é só o cadastro de acesso, não o registro de auditoria).
  const resp = await fetch(`/api/tecnicos/${tecnicoId}`, { method: "DELETE" });
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    throw new Error(corpo.mensagem ?? corpo.error ?? "Não foi possível excluir.");
  }
  await db.tecnicos.delete(tecnicoId);
}

/**
 * Confere, com internet, se a sessão do servidor (cookie) é mesmo do técnico
 * logado neste aparelho. Devolve:
 * - "ok" (e o técnico atualizado do banco, ex.: papel trocado por um admin)
 * - "invalida": sem sessão, vencida, ou de outro técnico — precisa entrar de novo
 * - "sem_rede": não deu pra confirmar agora (offline); não faz nada
 */
export async function conferirSessaoServidor(
  tecnicoId: string
): Promise<
  | { estado: "ok"; tecnico: Omit<Tecnico, "pin"> }
  | { estado: "invalida" }
  | { estado: "sem_rede" }
> {
  try {
    const resp = await fetch("/api/auth/eu", { signal: AbortSignal.timeout(8000) });
    if (resp.status === 401) return { estado: "invalida" };
    if (!resp.ok) return { estado: "sem_rede" };
    const { tecnico } = await resp.json();
    if (!tecnico || tecnico.id !== tecnicoId) return { estado: "invalida" };
    return { estado: "ok", tecnico };
  } catch {
    return { estado: "sem_rede" };
  }
}
