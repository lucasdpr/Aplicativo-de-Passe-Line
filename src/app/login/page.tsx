"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  autenticarPorPin,
  cadastrarTecnico,
  useAuthStore,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [funcao, setFuncao] = useState("Técnico de Mecânica");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const tecnico = await autenticarPorPin(matricula, pin);
      if (!tecnico) {
        setErro("Matrícula ou PIN inválidos.");
        return;
      }
      login(tecnico);
      router.push("/");
    } finally {
      setCarregando(false);
    }
  }

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (pin.length < 4) {
      setErro("O PIN precisa ter pelo menos 4 dígitos.");
      return;
    }
    setCarregando(true);
    try {
      const tecnico = await cadastrarTecnico(nome, matricula, funcao, pin);
      login(tecnico);
      router.push("/");
    } catch {
      setErro("Não foi possível cadastrar. Matrícula já existe?");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-center mb-1">
          CSN Pass-Line
        </h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          Medição e ajuste — MCC2 / MCC3
        </p>

        <div className="flex mb-6 rounded-lg bg-slate-800 p-1 text-sm">
          <button
            className={`flex-1 rounded-md py-2 ${modo === "entrar" ? "bg-sky-500 text-slate-950 font-medium" : "text-slate-300"}`}
            onClick={() => setModo("entrar")}
            type="button"
          >
            Entrar
          </button>
          <button
            className={`flex-1 rounded-md py-2 ${modo === "cadastrar" ? "bg-sky-500 text-slate-950 font-medium" : "text-slate-300"}`}
            onClick={() => setModo("cadastrar")}
            type="button"
          >
            Cadastrar
          </button>
        </div>

        <form
          onSubmit={modo === "entrar" ? handleEntrar : handleCadastrar}
          className="space-y-4"
        >
          {modo === "cadastrar" && (
            <>
              <Campo label="Nome completo">
                <input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                />
              </Campo>
              <Campo label="Função">
                <input
                  required
                  value={funcao}
                  onChange={(e) => setFuncao(e.target.value)}
                  className="input"
                />
              </Campo>
            </>
          )}
          <Campo label="Matrícula">
            <input
              required
              inputMode="numeric"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="input"
            />
          </Campo>
          <Campo label="PIN">
            <input
              required
              type="password"
              inputMode="numeric"
              minLength={4}
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input tracking-widest text-center"
            />
          </Campo>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-sky-500 py-3 font-medium text-slate-950 disabled:opacity-50"
          >
            {modo === "entrar" ? "Entrar" : "Cadastrar e entrar"}
          </button>
        </form>
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
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}
