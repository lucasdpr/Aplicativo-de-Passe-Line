"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { KeyRound, User as UserIcon, HardHat, Eye, ArrowLeft, Bell, BellRing } from "lucide-react";
import {
  autenticarPorPin,
  cadastrarTecnico,
  useAuthStore,
  MatriculaJaCadastradaError,
  CadastroPendenteError,
  SemConexaoError,
} from "@/lib/auth";
import { suportaPush, inscreverPush } from "@/lib/push";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [tipoAcesso, setTipoAcesso] = useState<"tecnico" | "visitante" | null>(null);
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [funcao, setFuncao] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [tecnicoPendente, setTecnicoPendente] = useState<{ id: string; nome: string } | null>(null);
  const [notificacaoAtivada, setNotificacaoAtivada] = useState(false);

  async function handleAtivarNotificacaoPendente() {
    if (!tecnicoPendente) return;
    const resultado = await inscreverPush(tecnicoPendente.id, tecnicoPendente.nome);
    if (resultado === "ativo") setNotificacaoAtivada(true);
  }

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setCarregando(true);
    try {
      const tecnico = await autenticarPorPin(matricula, pin);
      if (!tecnico) {
        setErro("Matrícula ou PIN inválidos.");
        return;
      }
      login(tecnico);
      router.push("/");
    } catch (err) {
      setErro(
        err instanceof CadastroPendenteError
          ? err.message
          : "Não foi possível entrar. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    if (pin.length < 4) {
      setErro("O PIN precisa ter pelo menos 4 dígitos.");
      return;
    }
    setCarregando(true);
    try {
      const tecnico = await cadastrarTecnico(
        nome,
        matricula,
        funcao,
        pin,
        tipoAcesso ?? "tecnico"
      );
      if (!tecnico.aprovado) {
        setModo("entrar");
        setTecnicoPendente({ id: tecnico.id, nome: tecnico.nome });
        setAviso(
          "Cadastro enviado! Peça pro admin da sua área aprovar seu acesso antes de você poder entrar."
        );
        return;
      }
      login(tecnico);
      router.push("/");
    } catch (err) {
      setErro(
        err instanceof MatriculaJaCadastradaError || err instanceof SemConexaoError
          ? err.message
          : "Não foi possível cadastrar."
      );
    } finally {
      setCarregando(false);
    }
  }

  function escolherTipoAcesso(tipo: "tecnico" | "visitante") {
    setTipoAcesso(tipo);
    setFuncao(tipo === "visitante" ? "Visitante" : "");
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(700px 400px at 50% 0%, rgba(45,212,191,0.10), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            <Image
              src="/icons/logo-mark.png"
              alt="Pass-Line"
              width={64}
              height={64}
              priority
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              CSN Pass-Line
            </h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Medição e ajuste — MCC2 / MCC3
            </p>
          </div>
        </div>

        <div className="surface p-6" style={{ boxShadow: "var(--shadow-md)" }}>
          <div
            className="mb-6 flex rounded-xl p-1 text-sm"
            style={{ background: "var(--bg)" }}
          >
            <button
              className="flex-1 rounded-lg py-2 font-medium transition"
              style={
                modo === "entrar"
                  ? { background: "var(--primary)", color: "#04201c" }
                  : { color: "var(--text-dim)" }
              }
              onClick={() => {
                setModo("entrar");
                setErro("");
                setAviso("");
              }}
              type="button"
            >
              Entrar
            </button>
            <button
              className="flex-1 rounded-lg py-2 font-medium transition"
              style={
                modo === "cadastrar"
                  ? { background: "var(--primary)", color: "#04201c" }
                  : { color: "var(--text-dim)" }
              }
              onClick={() => {
                setModo("cadastrar");
                setTipoAcesso(null);
                setErro("");
                setAviso("");
              }}
              type="button"
            >
              Cadastrar
            </button>
          </div>

          {modo === "cadastrar" && !tipoAcesso && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-dim)]">Você é...</p>
              <button
                type="button"
                onClick={() => escolherTipoAcesso("tecnico")}
                className="surface flex w-full items-center gap-3 p-4 text-left transition hover:border-[var(--primary-strong)]"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)" }}
                >
                  <HardHat size={18} style={{ color: "var(--primary-strong)" }} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">Técnico</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    Faz as medições em campo
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => escolherTipoAcesso("visitante")}
                className="surface flex w-full items-center gap-3 p-4 text-left transition hover:border-[var(--primary-strong)]"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)" }}
                >
                  <Eye size={18} style={{ color: "var(--primary-strong)" }} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">Visitante</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    Só acompanha, não faz medições
                  </div>
                </div>
              </button>
            </div>
          )}

          {modo === "cadastrar" && tipoAcesso && (
            <button
              type="button"
              onClick={() => setTipoAcesso(null)}
              className="mb-4 flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              <ArrowLeft size={12} />
              {tipoAcesso === "tecnico" ? "Técnico" : "Visitante"} · trocar
            </button>
          )}

          <form
            onSubmit={modo === "entrar" ? handleEntrar : handleCadastrar}
            className={`space-y-4 ${modo === "cadastrar" && !tipoAcesso ? "hidden" : ""}`}
          >
            {modo === "cadastrar" && (
              <>
                <Campo label="Nome completo">
                  <input
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value.toUpperCase())}
                    className="input uppercase"
                  />
                </Campo>
                <Campo label="Função">
                  <input
                    required
                    placeholder="Ex.: Técnico de Mecânica, Engenheiro, Gerente..."
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    className="input"
                  />
                </Campo>
              </>
            )}
            <Campo label="Matrícula">
              <div className="relative">
                <UserIcon
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  required
                  inputMode="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                  className="input pl-9 uppercase"
                />
              </div>
            </Campo>
            <Campo label="PIN">
              <div className="relative">
                <KeyRound
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  required
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="input pl-9 text-center tracking-[0.4em]"
                />
              </div>
            </Campo>

            {erro && (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--danger-soft)", color: "#fca5a5" }}
              >
                {erro}
              </p>
            )}
            {aviso && (
              <div
                className="space-y-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
              >
                <p>{aviso}</p>
                {tecnicoPendente && suportaPush() && (
                  <button
                    type="button"
                    onClick={handleAtivarNotificacaoPendente}
                    disabled={notificacaoAtivada}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
                  >
                    {notificacaoAtivada ? (
                      <>
                        <BellRing size={13} /> Vamos te avisar quando aprovar
                      </>
                    ) : (
                      <>
                        <Bell size={13} /> Avisar no celular quando for aprovado
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={carregando} className="btn-primary">
              {carregando
                ? "Aguarde..."
                : modo === "entrar"
                  ? "Entrar"
                  : "Cadastrar e entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          Funciona offline · sincroniza automaticamente ao conectar
        </p>
      </div>
    </main>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-dim)]">
        {label}
      </span>
      {children}
    </label>
  );
}
