"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Users,
  History,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { useAuthStore, resetarPin } from "@/lib/auth";
import { db } from "@/lib/db/dexie";

const NOMES_FICHA: Record<string, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

export default function AdminPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const tecnicos = useLiveQuery(() => db.tecnicos.toArray(), []);
  const sessoes = useLiveQuery(
    () => db.sessoes.orderBy("criadoEm").reverse().toArray(),
    []
  );
  const [filtroTecnico, setFiltroTecnico] = useState<string>("TODOS");
  const [resetandoId, setResetandoId] = useState<string | null>(null);

  if (tecnico && !tecnico.isAdmin) {
    return (
      <AuthGuard>
        <StatusBar />
        <main className="mx-auto w-full max-w-2xl flex-1 p-4">
          <div className="surface p-8 text-center text-sm text-[var(--text-dim)]">
            Esta área é restrita a administradores.
          </div>
        </main>
      </AuthGuard>
    );
  }

  async function handleResetarPin(id: string, nome: string) {
    const novoPin = window.prompt(
      `Novo PIN para ${nome} (mínimo 4 dígitos):`
    );
    if (!novoPin) return;
    if (novoPin.length < 4) {
      alert("O PIN precisa ter pelo menos 4 dígitos.");
      return;
    }
    setResetandoId(id);
    try {
      await resetarPin(id, novoPin);
      alert("PIN redefinido com sucesso.");
    } finally {
      setResetandoId(null);
    }
  }

  const sessoesFiltradas =
    filtroTecnico === "TODOS"
      ? sessoes
      : sessoes?.filter((s) => s.tecnicoId === filtroTecnico);

  return (
    <AuthGuard>
      <StatusBar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--primary-soft)" }}
          >
            <ShieldCheck size={18} style={{ color: "var(--primary-strong)" }} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">
              Painel do administrador
            </h1>
            <p className="text-sm text-[var(--text-dim)]">
              Técnicos cadastrados e histórico completo
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
            <Users size={15} /> Técnicos cadastrados ({tecnicos?.length ?? 0})
          </h2>
          <div className="space-y-2">
            {tecnicos?.map((t) => (
              <div
                key={t.id}
                className="surface flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{t.nome}</span>
                    {t.isAdmin && (
                      <span className="badge badge-success">admin</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    Matr. {t.matricula} · {t.funcao} · cadastrado em{" "}
                    {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <button
                  onClick={() => handleResetarPin(t.id, t.nome)}
                  disabled={resetandoId === t.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-dim)",
                  }}
                >
                  <KeyRound size={12} /> Resetar PIN
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
            <History size={15} /> Histórico completo
          </h2>

          <select
            className="input mb-3"
            value={filtroTecnico}
            onChange={(e) => setFiltroTecnico(e.target.value)}
          >
            <option value="TODOS">Todos os técnicos</option>
            {tecnicos?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {sessoesFiltradas?.length === 0 && (
              <div className="surface p-6 text-center text-sm text-[var(--text-dim)]">
                Nenhuma medição encontrada.
              </div>
            )}
            {sessoesFiltradas?.map((s) => (
              <div key={s.id} className="surface p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {NOMES_FICHA[s.tipoFicha]}
                  </span>
                  <span
                    className={`badge ${s.status === "SINCRONIZADO" ? "badge-success" : "badge-warning"}`}
                  >
                    {s.status === "SINCRONIZADO" ? "Sincronizado" : "Pendente"}
                  </span>
                </div>
                <div className="text-[var(--text-dim)]">
                  {s.maquina} · Veio {s.veio} · {s.data}
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  {s.tecnicoNome} — matr. {s.tecnicoMatricula}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
