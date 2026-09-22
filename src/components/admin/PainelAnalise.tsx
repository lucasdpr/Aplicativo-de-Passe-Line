"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { buscarAnaliseCombos, type AnaliseCombo } from "@/lib/analise";

function formatarData(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function corDaVariacao(combo: AnaliseCombo): string {
  if (combo.variacaoAbsoluta === null) return "var(--text-faint)";
  // Empeno/Desgaste: diâmetro caindo = mais gasto = pior (vermelho).
  // Pass-Line/GAP: desvio subindo = pior (vermelho).
  const piorando =
    combo.tipoFicha === "EMPENO_DESGASTE"
      ? combo.variacaoAbsoluta < 0
      : combo.variacaoAbsoluta > 0;
  if (Math.abs(combo.variacaoAbsoluta) < 0.01) return "var(--text-dim)";
  return piorando ? "#fca5a5" : "var(--success)";
}

export function PainelAnalise() {
  const [combos, setCombos] = useState<AnaliseCombo[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    buscarAnaliseCombos(supabase).then((resultado) => {
      setCombos(resultado);
      const primeiroComDados = resultado.find((c) => c.serie.length > 1);
      if (primeiroComDados) {
        setSelecionado(`${primeiroComDados.tipoFicha}|${primeiroComDados.maquina}|${primeiroComDados.veio}`);
      }
    });
  }, []);

  const comDados = useMemo(() => (combos ?? []).filter((c) => c.serie.length > 0), [combos]);
  const comboAtivo = comDados.find(
    (c) => `${c.tipoFicha}|${c.maquina}|${c.veio}` === selecionado
  );

  const dadosGrafico = useMemo(
    () =>
      comboAtivo?.serie.map((p) => ({
        data: formatarData(p.data),
        valor: Number(p.valor.toFixed(3)),
      })) ?? [],
    [comboAtivo]
  );

  return (
    <section id="analise" className="scroll-mt-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
        <LineChart size={15} /> Análise e variação por equipamento
      </h2>

      {!combos && (
        <div className="surface p-6 text-center text-sm text-[var(--text-dim)]">
          Carregando análise...
        </div>
      )}

      {combos && comDados.length === 0 && (
        <div className="surface p-6 text-center text-sm text-[var(--text-dim)]">
          Ainda não há histórico suficiente pra calcular variação.
        </div>
      )}

      {comDados.length > 0 && (
        <>
          <div className="surface p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {comDados.map((c) => {
                const chave = `${c.tipoFicha}|${c.maquina}|${c.veio}`;
                const ativo = chave === selecionado;
                return (
                  <button
                    key={chave}
                    onClick={() => setSelecionado(chave)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                    style={
                      ativo
                        ? { background: "var(--primary-soft)", color: "var(--primary-strong)" }
                        : { background: "var(--surface-raised)", color: "var(--text-dim)" }
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {comboAtivo && (
              <>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{comboAtivo.label}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {comboAtivo.descricaoValor} · {comboAtivo.totalSessoes} medições
                    </div>
                  </div>
                  {comboAtivo.variacaoAbsoluta !== null && (
                    <div className="text-right">
                      <div className="text-xs text-[var(--text-faint)]">
                        Variação (1ª → última)
                      </div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: corDaVariacao(comboAtivo) }}
                      >
                        {comboAtivo.variacaoAbsoluta > 0 ? "+" : ""}
                        {comboAtivo.variacaoAbsoluta.toFixed(3)}mm
                        {comboAtivo.variacaoPercentual !== null && (
                          <span className="ml-1 font-normal text-[var(--text-faint)]">
                            ({comboAtivo.variacaoPercentual > 0 ? "+" : ""}
                            {comboAtivo.variacaoPercentual.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <ReLineChart data={dadosGrafico} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="data"
                        tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface-raised)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "var(--text-dim)" }}
                        formatter={(v) => [`${v}mm`, comboAtivo.descricaoValor]}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        stroke="var(--primary-strong)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--primary-strong)" }}
                      />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>

                {comboAtivo.foraToleranciaPct !== null && (
                  <div
                    className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{
                      background:
                        comboAtivo.foraToleranciaPct > 0 ? "var(--danger-soft)" : "var(--success-soft)",
                      color: comboAtivo.foraToleranciaPct > 0 ? "#fca5a5" : "var(--success)",
                    }}
                  >
                    {comboAtivo.foraToleranciaContagem} de {comboAtivo.medicoesTolerancia} medições fora
                    da tolerância ({comboAtivo.foraToleranciaPct.toFixed(1)}%)
                  </div>
                )}
              </>
            )}
          </div>

          <div className="surface mt-3 overflow-x-auto p-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Equipamento</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Medições</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Variação</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Fora da tolerância</th>
                </tr>
              </thead>
              <tbody>
                {comDados.map((c) => {
                  const chave = `${c.tipoFicha}|${c.maquina}|${c.veio}`;
                  return (
                    <tr
                      key={chave}
                      onClick={() => setSelecionado(chave)}
                      className="cursor-pointer transition hover:bg-[var(--surface-raised)]"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="p-3 font-medium">{c.label}</td>
                      <td className="p-3 text-[var(--text-dim)]">{c.totalSessoes}</td>
                      <td className="p-3 font-medium" style={{ color: corDaVariacao(c) }}>
                        {c.variacaoAbsoluta === null
                          ? "—"
                          : `${c.variacaoAbsoluta > 0 ? "+" : ""}${c.variacaoAbsoluta.toFixed(3)}mm`}
                      </td>
                      <td className="p-3 text-[var(--text-dim)]">
                        {c.foraToleranciaPct === null ? "—" : `${c.foraToleranciaPct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
