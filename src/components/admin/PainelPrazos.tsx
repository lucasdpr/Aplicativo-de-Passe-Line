"use client";

import { useEffect, useState } from "react";
import { AlarmClock, CheckCircle2, CircleHelp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buscarUltimasMedicoes,
  calcularPrazos,
  comboLabel,
  todosOsCombos,
  chaveCombo,
  type PrazoCalculado,
} from "@/lib/prazos";

function statusDe(dias: number): { cor: string; fundo: string; texto: string } {
  if (dias < 0) return { cor: "#fca5a5", fundo: "var(--danger-soft)", texto: `Atrasado ${Math.abs(dias)}d` };
  if (dias <= 3) return { cor: "var(--warning)", fundo: "var(--warning-soft)", texto: dias === 0 ? "Vence hoje" : `Faltam ${dias}d` };
  if (dias <= 7) return { cor: "var(--warning)", fundo: "var(--warning-soft)", texto: `Faltam ${dias}d` };
  return { cor: "var(--success)", fundo: "var(--primary-soft)", texto: `Faltam ${dias}d` };
}

export function PainelPrazos() {
  const [prazos, setPrazos] = useState<PrazoCalculado[] | null>(null);
  const [semHistorico, setSemHistorico] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    buscarUltimasMedicoes(supabase).then((ultimas) => {
      setPrazos(calcularPrazos(ultimas));
      setSemHistorico(
        todosOsCombos()
          .filter((c) => !ultimas.has(chaveCombo(c)))
          .map((c) => comboLabel(c))
      );
    });
  }, []);

  return (
    <section id="prazos" className="scroll-mt-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
        <AlarmClock size={15} /> Prazos de medição
      </h2>

      {!prazos && (
        <div className="surface p-6 text-center text-sm text-[var(--text-dim)]">
          Carregando prazos...
        </div>
      )}

      {prazos && prazos.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {prazos.map((p) => {
            const s = statusDe(p.diasRestantes);
            return (
              <div
                key={`${p.tipoFicha}-${p.maquina}-${p.veio}`}
                className="surface flex items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{comboLabel(p)}</div>
                  <div className="text-xs text-[var(--text-faint)]">
                    Última medição: {new Date(`${p.ultimaMedicaoEm}T00:00:00`).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold"
                  style={{ background: s.fundo, color: s.cor }}
                >
                  {s.texto}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {semHistorico.length > 0 && (
        <div className="surface mt-3 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-dim)]">
            <CircleHelp size={13} /> Sem nenhuma medição registrada ainda
          </div>
          <div className="flex flex-wrap gap-1.5">
            {semHistorico.map((label) => (
              <span
                key={label}
                className="rounded-md px-2 py-1 text-xs"
                style={{ background: "var(--surface-raised)", color: "var(--text-faint)" }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {prazos && prazos.length === 0 && semHistorico.length === 0 && (
        <div className="surface flex items-center gap-2 p-6 text-sm text-[var(--text-dim)]">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} /> Tudo em dia.
        </div>
      )}
    </section>
  );
}
