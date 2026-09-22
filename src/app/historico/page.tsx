"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import {
  Ruler,
  MoveHorizontal,
  GitCompareArrows,
  Layers,
  CheckCircle2,
  Clock,
  FileDown,
  Loader2,
  RefreshCw,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { AppSidebar } from "@/components/AppSidebar";
import { CalendarioMes } from "@/components/CalendarioMes";
import { db } from "@/lib/db/dexie";
import { puxarAtualizacoes, sincronizarPendentes, excluirSessao } from "@/lib/db/sync";
import { useAuthStore } from "@/lib/auth";
import type { SessaoMedicao, TipoFicha } from "@/types";

const FICHA_INFO: Record<
  TipoFicha,
  { nome: string; icon: typeof Ruler }
> = {
  PASS_LINE_DESEMPENADEIRA: { nome: "Pass-Line (Desempenadeira)", icon: Ruler },
  GAP: { nome: "GAP", icon: MoveHorizontal },
  EMPENO_DESGASTE: { nome: "Empeno e Desgaste", icon: GitCompareArrows },
  PASS_LINE_SEGMENTOS: { nome: "Pass-Line dos Segmentos", icon: Layers },
};

export default function HistoricoPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const sessoes = useLiveQuery(
    () => db.sessoes.orderBy("criadoEm").reverse().toArray(),
    []
  );
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoErro, setUltimoErro] = useState<string[] | null>(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const diasComMedicao = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessoes ?? []) set.add(s.data);
    return set;
  }, [sessoes]);

  const sessoesDoFiltro = diaSelecionado
    ? sessoes?.filter((s) => s.data === diaSelecionado)
    : sessoes;

  const gruposPorDia = useMemo(() => {
    const mapa = new Map<string, SessaoMedicao[]>();
    for (const s of sessoesDoFiltro ?? []) {
      const lista = mapa.get(s.data) ?? [];
      lista.push(s);
      mapa.set(s.data, lista);
    }
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sessoesDoFiltro]);

  function formatarDia(data: string) {
    const d = new Date(`${data}T00:00:00`);
    const texto = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  useEffect(() => {
    puxarAtualizacoes().catch(() => {});
  }, []);

  async function handleSincronizarAgora() {
    setSincronizando(true);
    setUltimoErro(null);
    try {
      if (!navigator.onLine) {
        setUltimoErro(["Sem conexão com a internet agora."]);
        return;
      }
      const resultado = await sincronizarPendentes();
      if (resultado.erros.length > 0) setUltimoErro(resultado.erros);
      await puxarAtualizacoes();
    } finally {
      setSincronizando(false);
    }
  }

  async function handleExcluirSessao(sessao: SessaoMedicao) {
    const info = FICHA_INFO[sessao.tipoFicha];
    const confirmado = window.confirm(
      `Excluir esta medição de ${info.nome} (${sessao.tecnicoNome}, ${sessao.data})? Essa ação não pode ser desfeita e remove também do banco na nuvem.`
    );
    if (!confirmado) return;
    try {
      await excluirSessao(sessao);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function gerarPdf(sessaoId: string) {
    setGerandoId(sessaoId);
    try {
      const resp = await fetch(`/api/pdf?sessaoId=${sessaoId}`);
      if (!resp.ok) {
        const erro = await resp.json().catch(() => null);
        alert(erro?.error ?? "Não foi possível gerar o PDF.");
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } finally {
      setGerandoId(null);
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col md:flex-row">
        <AppSidebar papel={tecnico?.papel} />
        <div className="min-w-0 flex-1">
          <StatusBar />
          <main className="mx-auto w-full max-w-2xl flex-1 p-4">
        <div className="mb-4 mt-3 flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight">
            Histórico de medições
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setMostrarCalendario((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: mostrarCalendario
                  ? "var(--primary-soft)"
                  : "var(--surface-raised)",
                color: mostrarCalendario
                  ? "var(--primary-strong)"
                  : "var(--text-dim)",
              }}
            >
              <CalendarDays size={13} />
              Calendário
            </button>
            <button
              onClick={handleSincronizarAgora}
              disabled={sincronizando}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-dim)",
              }}
            >
              <RefreshCw size={13} className={sincronizando ? "animate-spin" : ""} />
              Sincronizar
            </button>
          </div>
        </div>

        {mostrarCalendario && (
          <div className="mb-4">
            <CalendarioMes
              diasComMedicao={diasComMedicao}
              diaSelecionado={diaSelecionado}
              onSelecionarDia={setDiaSelecionado}
            />
          </div>
        )}

        {ultimoErro && (
          <div
            className="mb-4 rounded-xl p-3 text-xs"
            style={{ background: "var(--danger-soft)", color: "#fca5a5" }}
          >
            <div className="mb-1 font-medium">Falha ao sincronizar:</div>
            {ultimoErro.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        {sessoes?.length === 0 && (
          <div className="surface p-8 text-center text-sm text-[var(--text-dim)]">
            Nenhuma medição registrada ainda.
          </div>
        )}

        {sessoes && sessoes.length > 0 && gruposPorDia.length === 0 && (
          <div className="surface p-8 text-center text-sm text-[var(--text-dim)]">
            Nenhuma medição neste dia.
          </div>
        )}

        <div className="space-y-5">
          {gruposPorDia.map(([data, sessoesDoDia]) => (
            <div key={data}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold">{formatarDia(data)}</h2>
                <span className="badge">{sessoesDoDia.length}</span>
              </div>
              <div className="space-y-2.5">
                {sessoesDoDia.map((s) => (
                  <CartaoSessao
                    key={s.id}
                    sessao={s}
                    ehAdmin={tecnico?.papel === "ADMIN"}
                    gerandoId={gerandoId}
                    onGerarPdf={gerarPdf}
                    onExcluir={handleExcluirSessao}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

function CartaoSessao({
  sessao: s,
  ehAdmin,
  gerandoId,
  onGerarPdf,
  onExcluir,
}: {
  sessao: SessaoMedicao;
  ehAdmin: boolean;
  gerandoId: string | null;
  onGerarPdf: (id: string) => void;
  onExcluir: (s: SessaoMedicao) => void;
}) {
  const info = FICHA_INFO[s.tipoFicha];
  const Icon = info.icon;
  const sincronizado = s.status === "SINCRONIZADO";
  return (
    <div className="surface flex items-start gap-3 p-4">
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--primary-soft)" }}
      >
        <Icon size={17} style={{ color: "var(--primary-strong)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{info.nome}</span>
          <span
            className={`badge shrink-0 ${sincronizado ? "badge-success" : "badge-warning"}`}
          >
            {sincronizado ? (
              <CheckCircle2 size={11} />
            ) : (
              <Clock size={11} />
            )}
            {sincronizado ? "Sincronizado" : "Pendente"}
          </span>
        </div>
        <div className="mt-1 text-sm text-[var(--text-dim)]">
          {s.maquina} · Veio {s.veio} · {s.data}
        </div>
        <div className="text-xs text-[var(--text-faint)]">
          {s.tecnicoNome} — matr. {s.tecnicoMatricula} ({s.tecnicoFuncao})
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onGerarPdf(s.id)}
            disabled={!sincronizado || gerandoId === s.id}
            title={
              sincronizado
                ? "Gerar PDF oficial"
                : "Disponível após sincronizar com o servidor"
            }
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "var(--primary-soft)",
              color: "var(--primary-strong)",
            }}
          >
            {gerandoId === s.id ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileDown size={13} />
            )}
            Gerar PDF
          </button>
          {ehAdmin && (
            <button
              onClick={() => onExcluir(s)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: "var(--danger-soft)",
                color: "#fca5a5",
              }}
            >
              <Trash2 size={13} /> Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
