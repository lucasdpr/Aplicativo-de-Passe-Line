"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ruler,
  MoveHorizontal,
  GitCompareArrows,
  Layers,
  CheckCircle2,
  Clock,
  FileDown,
  Loader2,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { db } from "@/lib/db/dexie";
import type { TipoFicha } from "@/types";

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
  const sessoes = useLiveQuery(
    () => db.sessoes.orderBy("criadoEm").reverse().toArray(),
    []
  );
  const [gerandoId, setGerandoId] = useState<string | null>(null);

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
      <StatusBar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>
        <h1 className="font-display mb-4 mt-3 text-xl font-bold tracking-tight">
          Histórico de medições
        </h1>

        {sessoes?.length === 0 && (
          <div className="surface p-8 text-center text-sm text-[var(--text-dim)]">
            Nenhuma medição registrada ainda.
          </div>
        )}

        <div className="space-y-2.5">
          {sessoes?.map((s) => {
            const info = FICHA_INFO[s.tipoFicha];
            const Icon = info.icon;
            const sincronizado = s.status === "SINCRONIZADO";
            return (
              <div key={s.id} className="surface flex items-start gap-3 p-4">
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
                    {s.tecnicoNome} — matr. {s.tecnicoMatricula} (
                    {s.tecnicoFuncao})
                  </div>
                  <button
                    onClick={() => gerarPdf(s.id)}
                    disabled={!sincronizado || gerandoId === s.id}
                    title={
                      sincronizado
                        ? "Gerar PDF oficial"
                        : "Disponível após sincronizar com o servidor"
                    }
                    className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
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
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </AuthGuard>
  );
}
