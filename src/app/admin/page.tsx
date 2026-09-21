"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldMinus,
  KeyRound,
  Users,
  History,
  Trash2,
  Pencil,
  ChevronDown,
  Bell,
  BellOff,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import {
  useAuthStore,
  resetarPin,
  definirAdmin,
  excluirTecnico,
} from "@/lib/auth";
import {
  suportaPush,
  statusInscricaoPush,
  inscreverPush,
  cancelarPush,
} from "@/lib/push";
import { db } from "@/lib/db/dexie";
import { puxarAtualizacoes, excluirSessao } from "@/lib/db/sync";
import type { Edicao, SessaoMedicao, TipoFicha } from "@/types";

const NOMES_FICHA: Record<string, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

const SLUG_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "pass-line-desempenadeira",
  GAP: "gap",
  EMPENO_DESGASTE: "empeno-desgaste",
  PASS_LINE_SEGMENTOS: "pass-line-segmentos",
};

export default function AdminPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const tecnicos = useLiveQuery(() => db.tecnicos.toArray(), []);
  const sessoes = useLiveQuery(
    () => db.sessoes.orderBy("criadoEm").reverse().toArray(),
    []
  );
  const edicoes = useLiveQuery(() => db.edicoes.toArray(), []);
  const [filtroTecnico, setFiltroTecnico] = useState<string>("TODOS");
  const [resetandoId, setResetandoId] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [statusPush, setStatusPush] = useState<
    "inativo" | "ativo" | "negado" | "carregando"
  >(() => (suportaPush() ? "carregando" : "inativo"));

  useEffect(() => {
    if (!suportaPush()) return;
    statusInscricaoPush().then(setStatusPush);
  }, []);

  useEffect(() => {
    puxarAtualizacoes().catch(() => {});
  }, []);

  async function handleAtivarNotificacoes() {
    if (!tecnico) return;
    setStatusPush("carregando");
    const resultado = await inscreverPush(tecnico.id, tecnico.nome);
    setStatusPush(resultado === "erro" ? "inativo" : resultado);
  }

  async function handleDesativarNotificacoes() {
    setStatusPush("carregando");
    await cancelarPush();
    setStatusPush("inativo");
  }

  const edicoesPorSessao = new Map<string, Edicao[]>();
  for (const e of edicoes ?? []) {
    const lista = edicoesPorSessao.get(e.sessaoId) ?? [];
    lista.push(e);
    edicoesPorSessao.set(e.sessaoId, lista);
  }

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

  async function handleAlternarAdmin(id: string, nome: string, atual: boolean) {
    const confirmado = window.confirm(
      atual
        ? `Remover acesso de administrador de ${nome}?`
        : `Tornar ${nome} administrador?`
    );
    if (!confirmado) return;
    await definirAdmin(id, !atual);
  }

  async function handleExcluirTecnico(id: string, nome: string) {
    const confirmado = window.confirm(
      `Excluir o cadastro de ${nome}? As medições que ele já registrou continuam no histórico — só o acesso de login é removido. Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    await excluirTecnico(id);
  }

  async function handleExcluirSessao(sessao: SessaoMedicao) {
    const confirmado = window.confirm(
      `Excluir esta medição de ${NOMES_FICHA[sessao.tipoFicha]} (${sessao.tecnicoNome}, ${sessao.data})? Essa ação não pode ser desfeita e remove também do banco na nuvem.`
    );
    if (!confirmado) return;
    await excluirSessao(sessao);
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

        <div className="surface flex items-center gap-3 p-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--primary-soft)" }}
          >
            {statusPush === "ativo" ? (
              <Bell size={16} style={{ color: "var(--primary-strong)" }} />
            ) : (
              <BellOff size={16} style={{ color: "var(--text-faint)" }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Notificações neste celular</div>
            <div className="text-xs text-[var(--text-dim)]">
              {statusPush === "ativo" &&
                "Ativas — você recebe um aviso quando um técnico concluir uma medição"}
              {statusPush === "inativo" &&
                "Desativadas — ative para ser avisado quando alguém concluir uma medição"}
              {statusPush === "negado" &&
                "Bloqueadas no navegador — permita notificações nas configurações do site"}
              {statusPush === "carregando" && "Verificando..."}
            </div>
          </div>
          {statusPush === "inativo" && (
            <button
              onClick={handleAtivarNotificacoes}
              className="btn-primary !w-auto shrink-0 px-4"
            >
              Ativar
            </button>
          )}
          {statusPush === "ativo" && (
            <button
              onClick={handleDesativarNotificacoes}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-dim)",
              }}
            >
              Desativar
            </button>
          )}
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
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() =>
                      handleAlternarAdmin(t.id, t.nome, !!t.isAdmin)
                    }
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--surface-raised)",
                      color: "var(--text-dim)",
                    }}
                  >
                    {t.isAdmin ? (
                      <>
                        <ShieldMinus size={12} /> Remover admin
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={12} /> Tornar admin
                      </>
                    )}
                  </button>
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
            {sessoesFiltradas?.map((s) => {
              const historicoEdicoes = edicoesPorSessao.get(s.id) ?? [];
              const aberto = expandido === s.id;
              return (
                <div key={s.id} className="surface p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {NOMES_FICHA[s.tipoFicha]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${s.status === "SINCRONIZADO" ? "badge-success" : "badge-warning"}`}
                      >
                        {s.status === "SINCRONIZADO"
                          ? "Sincronizado"
                          : "Pendente"}
                      </span>
                      <Link
                        href={`/formularios/${SLUG_POR_TIPO[s.tipoFicha]}?sessaoId=${s.id}`}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                        style={{
                          background: "var(--surface-raised)",
                          color: "var(--text-dim)",
                        }}
                      >
                        <Pencil size={11} /> Editar
                      </Link>
                      <button
                        onClick={() => handleExcluirSessao(s)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                        style={{
                          background: "var(--danger-soft)",
                          color: "#fca5a5",
                        }}
                      >
                        <Trash2 size={11} /> Excluir
                      </button>
                    </div>
                  </div>
                  <div className="text-[var(--text-dim)]">
                    {s.maquina} · Veio {s.veio} · {s.data}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {s.tecnicoNome} — matr. {s.tecnicoMatricula}
                  </div>
                  {s.editadoPorNome && (
                    <div className="mt-1 text-xs text-[var(--text-faint)]">
                      Editado por {s.editadoPorNome} em{" "}
                      {s.editadoEm &&
                        new Date(s.editadoEm).toLocaleString("pt-BR")}
                    </div>
                  )}

                  {historicoEdicoes.length > 0 && (
                    <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                      <button
                        onClick={() => setExpandido(aberto ? null : s.id)}
                        className="flex items-center gap-1 text-xs text-[var(--primary-strong)]"
                      >
                        <ChevronDown
                          size={12}
                          className={aberto ? "rotate-180" : ""}
                        />
                        {historicoEdicoes.length} alteração
                        {historicoEdicoes.length > 1 ? "ões" : ""}
                      </button>
                      {aberto && (
                        <div className="mt-2 space-y-2">
                          {historicoEdicoes.map((e, i) => (
                            <div
                              key={i}
                              className="rounded-lg p-2 text-xs"
                              style={{ background: "var(--surface-raised)" }}
                            >
                              <div className="mb-1 text-[var(--text-faint)]">
                                {e.editadoPorNome} em{" "}
                                {new Date(e.editadoEm).toLocaleString("pt-BR")}
                              </div>
                              {[...e.mudancasHeader, ...e.mudancasLinhas].map(
                                (m, j) => (
                                  <div key={j} className="text-[var(--text)]">
                                    <span className="text-[var(--text-faint)]">
                                      {m.linhaChave !== "header"
                                        ? `[${m.linhaChave}] `
                                        : ""}
                                      {m.campo}:
                                    </span>{" "}
                                    <span className="text-[#fca5a5] line-through">
                                      {m.de}
                                    </span>{" "}
                                    →{" "}
                                    <span className="text-[var(--success)]">
                                      {m.para}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
