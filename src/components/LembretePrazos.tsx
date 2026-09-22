"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buscarUltimasMedicoes,
  calcularPrazos,
  comboLabel,
  type PrazoCalculado,
} from "@/lib/prazos";

function textoPrazo(dias: number): string {
  if (dias < 0) return `Atrasado há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoje";
  return `Faltam ${dias} dia${dias === 1 ? "" : "s"}`;
}

export function LembretePrazos() {
  const [prazos, setPrazos] = useState<PrazoCalculado[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    buscarUltimasMedicoes(supabase).then((ultimas) => {
      const todos = calcularPrazos(ultimas);
      setPrazos(todos.filter((p) => p.diasRestantes <= 3));
    });
  }, []);

  if (!prazos || prazos.length === 0) return null;

  return (
    <div
      className="mx-4 mb-3 space-y-1.5 rounded-xl p-3 text-sm"
      style={{ background: "var(--warning-soft)", border: "1px solid var(--border-strong)" }}
    >
      <div className="flex items-center gap-1.5 font-medium" style={{ color: "var(--warning)" }}>
        <AlarmClock size={15} />
        Medições próximas do prazo
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
