"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2, Users, UserCheck } from "lucide-react";
import {
  useAuthStore,
  resetarPin,
  definirPapel,
  excluirTecnico,
  listarTecnicos,
  aprovarTecnico,
} from "@/lib/auth";
import type { PapelTecnico, Tecnico } from "@/types";

const NOME_PAPEL: Record<PapelTecnico, string> = {
  TECNICO: "Técnico",
  VISUALIZADOR: "Visualizador",
  ADMIN: "Admin",
};

export default function AdminTecnicosPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const ehAdmin = tecnico?.papel === "ADMIN";

  const [tecnicos, setTecnicos] = useState<Omit<Tecnico, "pin">[] | null>(null);
  const [resetandoId, setResetandoId] = useState<string | null>(null);

  const recarregarTecnicos = useCallback(() => {
    listarTecnicos().then(setTecnicos);
  }, []);

  useEffect(() => {
    recarregarTecnicos();
  }, [recarregarTecnicos]);

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

  async function handleAprovarTecnico(id: string, nome: string) {
    const confirmado = window.confirm(
      `Confirmar que ${nome} é realmente um técnico da equipe e liberar o acesso dele?`
    );
    if (!confirmado) return;
    await aprovarTecnico(id);
    recarregarTecnicos();
    fetch("/api/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "Acesso liberado!",
        corpo: "Seu cadastro no CSN Pass-Line foi aprovado. Já pode entrar.",
        urlDestino: "/login",
        tecnicoId: id,
      }),
    }).catch(() => {});
  }

  async function handleDefinirPapel(id: string, nome: string, papel: PapelTecnico) {
    const confirmado = window.confirm(`Definir ${nome} como "${NOME_PAPEL[papel]}"?`);
    if (!confirmado) return;
    await definirPapel(id, papel);
    recarregarTecnicos();
  }

  async function handleExcluirTecnico(id: string, nome: string) {
    const confirmado = window.confirm(
      `Excluir o cadastro de ${nome}? As medições que ele já registrou continuam no histórico — só o acesso de login é removido. Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    await excluirTecnico(id);
    recarregarTecnicos();
  }

  const pendentes = tecnicos?.filter((t) => !t.aprovado) ?? [];
  const aprovados = tecnicos?.filter((t) => t.aprovado) ?? [];

  return (
    <>
      {ehAdmin && pendentes.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
            <UserCheck size={15} /> Cadastros pendentes de aprovação (
            {pendentes.length})
          </h2>
          <div className="space-y-2">
            {pendentes.map((t) => (
              <div
                key={t.id}
                className="surface flex flex-col gap-3 p-3"
                style={{ border: "1px solid var(--warning)" }}
              >
                <div className="min-w-0">
                  <span className="font-medium break-words">{t.nome}</span>
                  <div className="text-xs text-[var(--text-faint)]">
                    Matr. {t.matricula} · {t.funcao} · cadastrado em{" "}
                    {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAprovarTecnico(t.id, t.nome)}
                    className="btn-primary !w-auto px-4"
                  >
                    <UserCheck size={12} /> Confirmar que é técnico e liberar acesso
                  </button>
                  <button
                    onClick={() => handleExcluirTecnico(t.id, t.nome)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--danger-soft)",
                      color: "#fca5a5",
                    }}
                  >
                    <Trash2 size={12} /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
          <Users size={15} /> Técnicos cadastrados ({aprovados.length})
        </h2>
        <div className="space-y-2">
          {aprovados.map((t) => (
            <div key={t.id} className="surface flex flex-col gap-3 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-words">{t.nome}</span>
                  <span
                    className={`badge ${t.papel === "ADMIN" ? "badge-success" : "badge-warning"}`}
                  >
                    {NOME_PAPEL[t.papel]}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  Matr. {t.matricula} · {t.funcao} · cadastrado em{" "}
                  {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                </div>
              </div>
              {ehAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input !w-auto py-1.5 text-xs"
                    value={t.papel}
                    onChange={(e) =>
                      handleDefinirPapel(
                        t.id,
                        t.nome,
                        e.target.value as PapelTecnico
                      )
                    }
                  >
                    <option value="TECNICO">Técnico</option>
                    <option value="VISUALIZADOR">Visualizador</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    onClick={() => handleResetarPin(t.id, t.nome)}
                    disabled={resetandoId === t.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--surface-raised)",
                      color: "var(--text-dim)",
                    }}
                  >
                    <KeyRound size={12} /> Resetar PIN
                  </button>
                  <button
                    onClick={() => handleExcluirTecnico(t.id, t.nome)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--danger-soft)",
                      color: "#fca5a5",
                    }}
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
