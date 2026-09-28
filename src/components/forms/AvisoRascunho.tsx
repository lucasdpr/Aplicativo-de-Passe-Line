"use client";

import { History } from "lucide-react";
import { hojeIso } from "@/lib/datas";

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

/**
 * Aviso de que o formulário abriu com um rascunho não salvo — pra ninguém
 * salvar sem perceber dados (ou data) de antes. Dá pra descartar e começar
 * do zero (ou voltar pro que está gravado, se for edição).
 */
export function AvisoRascunho({
  salvoEm,
  dataMedicao,
  editando,
  onDescartar,
}: {
  salvoEm: string;
  /** Data da medição no cabeçalho (AAAA-MM-DD). */
  dataMedicao: string;
  editando: boolean;
  onDescartar: () => void;
}) {
  const quando = new Date(salvoEm);
  const dataDiferente = !editando && dataMedicao !== hojeIso();

  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
      style={{ background: "var(--warning-soft)", borderColor: "var(--warning)" }}
    >
      <History size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">
          Rascunho recuperado de {quando.toLocaleDateString("pt-BR")} às{" "}
          {quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-xs text-[var(--text-dim)]">
          {editando
            ? "Você está vendo uma edição que não foi salva, não o que está gravado."
            : "Estes dados foram preenchidos antes e ainda não foram salvos."}
        </p>
        {dataDiferente && (
          <p className="text-xs font-semibold" style={{ color: "var(--warning)" }}>
            Atenção: a data da medição está {formatarData(dataMedicao)}, não hoje.
            Confira antes de salvar.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDescartar}
        className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
        style={{ borderColor: "var(--border-strong)" }}
      >
        {editando ? "Descartar e voltar ao gravado" : "Descartar e começar do zero"}
      </button>
    </div>
  );
}
