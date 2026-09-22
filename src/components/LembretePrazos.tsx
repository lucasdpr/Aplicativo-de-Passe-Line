"use client";

import { useEffect, useState } from "react";
import { AlarmClock, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buscarUltimasMedicoes,
  calcularPrazos,
  comboLabel,
  type PrazoCalculado,
} from "@/lib/prazos";

const CHAVE_FECHADO = "csn-pass-line:lembrete-fechado-em";

function textoPrazo(dias: number): string {
  if (dias < 0) return `Atrasado há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoje";
  return `Faltam ${dias} dia${dias === 1 ? "" : "s"}`;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LembretePrazos() {
  const [prazos, setPrazos] = useState<PrazoCalculado[] | null>(null);
  const [expandido, setExpandido] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_FECHADO) !== hojeIso();
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!supabase) return;
    buscarUltimasMedicoes(supabase).then((ultimas) => {
      const todos = calcularPrazos(ultimas);
      setPrazos(todos.filter((p) => p.diasRestantes <= 3));
    });
  }, []);

  if (!prazos || prazos.length === 0) return null;

  if (!expandido) {
    return (
      <button
        type="button"
        onClick={() => setExpandido(true)}
        className="surface mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 p-3 text-left text-sm transition hover:border-[var(--border-strong)]"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--warning-soft)" }}
        >
          <AlarmClock size={16} style={{ color: "var(--warning)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {prazos.length} medição{prazos.length === 1 ? "" : "ões"} próxima
            {prazos.length === 1 ? "" : "s"} do prazo
          </div>
          <div className="truncate text-xs text-[var(--text-faint)]">Toque pra ver</div>
        </div>
      </button>
    );
  }

  return (
    <div
      className="mx-4 mb-3 space-y-1.5 rounded-xl p-3 text-sm"
      style={{ background: "var(--warning-soft)", border: "1px solid var(--border-strong)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium" style={{ color: "var(--warning)" }}>
          <AlarmClock size={15} />
          Medições próximas do prazo
        </div>
        <button
          type="button"
          onClick={() => {
            setExpandido(false);
            try {
              localStorage.setItem(CHAVE_FECHADO, hojeIso());
            } catch {
              // ignora falha ao salvar preferência local
            }
          }}
          className="shrink-0 rounded-lg p-1 transition hover:bg-black/10"
          style={{ color: "var(--warning)" }}
          aria-label="Fechar aviso"
        >
          <X size={14} />
        </button>
      </div>
      {prazos.map((p) => (
        <div key={`${p.tipoFicha}-${p.maquina}-${p.veio}`} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--text-dim)]">{comboLabel(p)}</span>
          <span
            className="shrink-0 font-medium"
            style={{ color: p.diasRestantes < 0 ? "#fca5a5" : "var(--warning)" }}
          >
            {textoPrazo(p.diasRestantes)}
          </span>
        </div>
      ))}
    </div>
  );
}
