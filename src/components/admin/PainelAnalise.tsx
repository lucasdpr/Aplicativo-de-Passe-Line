"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  LineChart,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { buscarAnaliseCombos, type AnaliseCombo, type PontoSerie } from "@/lib/analise";

function formatarData(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatarDataLonga(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR");
}

/** Empeno/Desgaste: diâmetro caindo = mais gasto = pior. Pass-Line/GAP: desvio subindo = pior. */
function estaPiorando(combo: AnaliseCombo): boolean | null {
  if (combo.variacaoAbsoluta === null) return null;
  if (Math.abs(combo.variacaoAbsoluta) < 0.01) return null;
  return combo.tipoFicha === "EMPENO_DESGASTE"
    ? combo.variacaoAbsoluta < 0
    : combo.variacaoAbsoluta > 0;
}

function corDaVariacao(combo: AnaliseCombo): string {
  const piorando = estaPiorando(combo);
  if (piorando === null) return "var(--text-dim)";
  return piorando ? "#fca5a5" : "var(--success)";
}

const SIGLA_FICHA: Record<AnaliseCombo["tipoFicha"], string> = {
  PASS_LINE_DESEMPENADEIRA: "PL-D",
  GAP: "GAP",
  EMPENO_DESGASTE: "E/D",
  PASS_LINE_SEGMENTOS: "PL-S",
};

function textoTendencia(combo: AnaliseCombo): string {
  if (combo.tendencia === "estavel") return "Estável — sem variação relevante entre medições";
  if (combo.tendencia === "melhorando") return "Melhorando a cada medição";
  if (combo.tendencia === "piorando") return "Piorando a cada medição";
  return "Ainda sem medições suficientes pra saber a tendência";
}

function IconeTendencia({ combo, size = 12 }: { combo: AnaliseCombo; size?: number }) {
  if (combo.tendencia === "piorando") return <TrendingUp size={size} />;
  if (combo.tendencia === "melhorando") return <TrendingDown size={size} />;
  if (combo.tendencia === "estavel") return <Minus size={size} />;
  return null;
}

/**
 * Procura na série do combo o ponto mais próximo de "1 ano antes da última
 * medição" (dentro de uma janela de 30 dias) pra comparar com o valor
 * atual. Com o histórico ainda começando em 2026, isso só encontra algo
 * quando já existir mais de ~1 ano de dados acumulados.
 */
function comparacaoAnoAnterior(
  combo: AnaliseCombo
): { pontoAntigo: PontoSerie; diasEntre: number } | null {
  if (!combo.ultimaMedicaoEm || combo.serie.length < 2) return null;
  const ultimaData = new Date(`${combo.ultimaMedicaoEm}T00:00:00Z`).getTime();
  const alvo = ultimaData - 365 * 86_400_000;
  const JANELA_DIAS = 30;
  let melhor: PontoSerie | null = null;
  let melhorDistancia = Infinity;
  for (const ponto of combo.serie) {
    const data = new Date(`${ponto.data}T00:00:00Z`).getTime();
    const distancia = Math.abs(data - alvo);
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia;
      melhor = ponto;
    }
  }
  if (!melhor || melhorDistancia > JANELA_DIAS * 86_400_000) return null;
  const diasEntre = Math.round(
    (ultimaData - new Date(`${melhor.data}T00:00:00Z`).getTime()) / 86_400_000
  );
  return { pontoAntigo: melhor, diasEntre };
}

function textoPrevisao(combo: AnaliseCombo): string | null {
  if (combo.medicoesAteForaTolerancia === null) return null;
  const medicoes = combo.medicoesAteForaTolerancia;
  const plural = medicoes === 1 ? "medição" : "medições";
  if (combo.diasAteForaTolerancia !== null) {
    return `Em cerca de ${medicoes} ${plural} (~${combo.diasAteForaTolerancia} dias) deve sair da tolerância, se o ritmo atual continuar`;
  }
  return `Em cerca de ${medicoes} ${plural} deve sair da tolerância, se o ritmo atual continuar`;
}

function StatCard({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number | string;
  cor?: string;
}) {
  return (
    <div className="surface p-3">
      <div className="text-xs text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 text-xl font-bold" style={{ color: cor ?? "var(--text)" }}>
        {valor}
      </div>
    </div>
  );
}

export function PainelAnalise() {
  const [combos, setCombos] = useState<AnaliseCombo[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalheNCadAberto, setDetalheNCadAberto] = useState(false);

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
  const semHistorico = useMemo(() => (combos ?? []).filter((c) => c.serie.length === 0), [combos]);
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

  const dadosComparacao = useMemo(
    () =>
      comDados
        .filter((c) => c.variacaoAbsoluta !== null)
        .map((c) => ({
          nome: `${SIGLA_FICHA[c.tipoFicha]} ${c.maquina}-${c.veio}`,
          chave: `${c.tipoFicha}|${c.maquina}|${c.veio}`,
          variacao: Number((c.variacaoAbsoluta ?? 0).toFixed(3)),
          cor: corDaVariacao(c),
        })),
    [comDados]
  );

  const foraAgoraCount = comDados.filter((c) => c.foraToleranciaAgora).length;
  const piorandoCount = comDados.filter((c) => estaPiorando(c) === true).length;
  const atrasados = useMemo(
    () => comDados.filter((c) => c.diasAtraso !== null && c.diasAtraso > 0),
    [comDados]
  );
  const comparacao = comboAtivo ? comparacaoAnoAnterior(comboAtivo) : null;

  return (
    <section id="analise" className="scroll-mt-4 print:text-black">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
          <LineChart size={15} /> Análise e variação por equipamento
        </h2>
        {comDados.length > 0 && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium print:hidden"
            style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
          >
            <Download size={13} /> Exportar / Imprimir
          </button>
        )}
      </div>

      {atrasados.length > 0 && (
        <div
          className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
          style={{ background: "var(--danger-soft)", color: "#fca5a5" }}
        >
          <CalendarClock size={15} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">
              {atrasados.length} {atrasados.length === 1 ? "equipamento atrasado" : "equipamentos atrasados"}
            </span>{" "}
            pra próxima medição:{" "}
            {atrasados
              .map((c) => `${c.label} (${c.diasAtraso}d de atraso)`)
              .join(" · ")}
          </div>
        </div>
      )}

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
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Equipamentos com histórico" valor={comDados.length} />
            <StatCard
              label="Fora da tolerância agora"
              valor={foraAgoraCount}
              cor={foraAgoraCount > 0 ? "#fca5a5" : "var(--success)"}
            />
            <StatCard
              label="Piorando"
              valor={piorandoCount}
              cor={piorandoCount > 0 ? "var(--warning)" : "var(--success)"}
            />
            <StatCard label="Sem medição ainda" valor={semHistorico.length} />
          </div>

          <div className="surface p-4">
            <div className="mb-3 space-y-2">
              {(
                [
                  ["PASS_LINE_DESEMPENADEIRA", "Pass-Line (Desempenadeira)"],
                  ["PASS_LINE_SEGMENTOS", "Pass-Line dos Segmentos"],
                  ["GAP", "GAP"],
                  ["EMPENO_DESGASTE", "Empeno e Desgaste"],
                ] as const
              ).map(([tipo, rotulo]) => {
                const linha = comDados.filter((c) => c.tipoFicha === tipo);
                if (linha.length === 0) return null;
                return (
                  <div key={tipo}>
                    <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                      {rotulo}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {linha.map((c) => {
                        const chave = `${c.tipoFicha}|${c.maquina}|${c.veio}`;
                        const ativo = chave === selecionado;
                        return (
                          <button
                            key={chave}
                            onClick={() => setSelecionado(chave)}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                            style={
                              ativo
                                ? { background: "var(--primary-soft)", color: "var(--primary-strong)" }
                                : { background: "var(--surface-raised)", color: "var(--text-dim)" }
                            }
                          >
                            {c.foraToleranciaAgora && (
                              <AlertTriangle size={11} style={{ color: "#fca5a5" }} />
                            )}
                            {c.maquina} veio {c.veio}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {comboAtivo && (
              <>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{comboAtivo.label}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {comboAtivo.descricaoValor} · {comboAtivo.totalSessoes} medições · última em{" "}
                      {comboAtivo.ultimaMedicaoEm && formatarDataLonga(comboAtivo.ultimaMedicaoEm)}
                      {comboAtivo.toleranciaMm !== null && (
                        <> · tolerância ±{comboAtivo.toleranciaMm.toFixed(3)}mm</>
                      )}
                    </div>
                    <div
                      className="mt-1 flex items-center gap-1 text-xs"
                      style={{ color: corDaVariacao(comboAtivo) }}
                    >
                      <IconeTendencia combo={comboAtivo} />
                      {textoTendencia(comboAtivo)}
                    </div>
                  </div>
                  {comboAtivo.variacaoAbsoluta !== null && (
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-[var(--text-faint)]">
                        {estaPiorando(comboAtivo) === true && <TrendingUp size={12} />}
                        {estaPiorando(comboAtivo) === false && <TrendingDown size={12} />}
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
                      {comboAtivo.toleranciaMm !== null && (
                        <ReferenceLine
                          y={comboAtivo.toleranciaMm}
                          stroke="#fca5a5"
                          strokeDasharray="4 4"
                          label={{
                            value: "limite da tolerância",
                            position: "insideTopRight",
                            fill: "#fca5a5",
                            fontSize: 10,
                          }}
                        />
                      )}
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {comboAtivo.foraToleranciaPct !== null && (
                    <div
                      className="flex flex-col justify-center rounded-lg px-3 py-2 text-xs"
                      style={{
                        background:
                          comboAtivo.foraToleranciaPct > 0 ? "var(--danger-soft)" : "var(--success-soft)",
                        color: comboAtivo.foraToleranciaPct > 0 ? "#fca5a5" : "var(--success)",
                      }}
                    >
                      <span className="font-semibold">
                        {comboAtivo.foraToleranciaContagem} de {comboAtivo.medicoesTolerancia}
                      </span>
                      <span>medições fora da tolerância ({comboAtivo.foraToleranciaPct.toFixed(1)}%)</span>
                    </div>
                  )}

                  {comboAtivo.piorPonto && (
                    <div
                      className="flex flex-col justify-center rounded-lg px-3 py-2 text-xs"
                      style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
                    >
                      <span className="font-semibold text-[var(--text)]">
                        Nº CAD {comboAtivo.piorPonto.nCad}: {comboAtivo.piorPonto.valor.toFixed(3)}mm
                      </span>
                      <span>
                        pior ponto já registrado · {formatarDataLonga(comboAtivo.piorPonto.data)}
                      </span>
                    </div>
                  )}

                  {comboAtivo.variacaoPorMedicao !== null && (
                    <div
                      className="flex flex-col justify-center rounded-lg px-3 py-2 text-xs"
                      style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
                    >
                      <span className="font-semibold text-[var(--text)]">
                        {comboAtivo.variacaoPorMedicao > 0 ? "+" : ""}
                        {comboAtivo.variacaoPorMedicao.toFixed(4)}mm por medição
                      </span>
                      <span>
                        ritmo médio de variação — quanto esse valor muda, em média, a cada nova medição
                      </span>
                    </div>
                  )}

                  {textoPrevisao(comboAtivo) && (
                    <div
                      className="flex flex-col justify-center rounded-lg px-3 py-2 text-xs"
                      style={{ background: "var(--warning-soft, var(--surface-raised))", color: "var(--warning)" }}
                    >
                      <span className="flex items-center gap-1 font-semibold text-[var(--text)]">
                        <Clock size={12} /> Estimativa
                      </span>
                      <span>{textoPrevisao(comboAtivo)}</span>
                    </div>
                  )}

                  <div
                    className="flex flex-col justify-center rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
                  >
                    {comparacao ? (
                      <>
                        <span className="font-semibold text-[var(--text)]">
                          {comparacao.pontoAntigo.valor.toFixed(3)}mm há {comparacao.diasEntre} dias
                        </span>
                        <span>
                          comparado a {comboAtivo.ultimoValor?.toFixed(3)}mm agora — mesma época do ano
                          passado ({formatarDataLonga(comparacao.pontoAntigo.data)})
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-[var(--text)]">Ano anterior</span>
                        <span>
                          ainda não há medição de ~1 ano atrás pra comparar (o histórico começa em
                          2026)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {comboAtivo.detalhePorNCad.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setDetalheNCadAberto((v) => !v)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium"
                      style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
                    >
                      <span>Detalhe por Nº CAD ({comboAtivo.detalhePorNCad.length} posições)</span>
                      {detalheNCadAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {detalheNCadAberto && (
                      <div className="mt-2 max-h-64 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                              <th className="p-2 font-medium text-[var(--text-dim)]">Nº CAD</th>
                              <th className="p-2 font-medium text-[var(--text-dim)]">Último valor</th>
                              <th className="p-2 font-medium text-[var(--text-dim)]">Pior já visto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comboAtivo.detalhePorNCad
                              .slice()
                              .sort((a, b) =>
                                comboAtivo.tipoFicha === "EMPENO_DESGASTE"
                                  ? a.piorValor - b.piorValor
                                  : b.piorValor - a.piorValor
                              )
                              .map((d) => {
                                const critico =
                                  comboAtivo.toleranciaMm !== null &&
                                  comboAtivo.tipoFicha !== "EMPENO_DESGASTE" &&
                                  Math.abs(d.ultimoValor) > comboAtivo.toleranciaMm;
                                return (
                                  <tr key={d.nCad} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td className="p-2 font-medium">{d.nCad}</td>
                                    <td
                                      className="p-2"
                                      style={{ color: critico ? "#fca5a5" : "var(--text-dim)" }}
                                    >
                                      {d.ultimoValor.toFixed(3)}mm
                                    </td>
                                    <td className="p-2 text-[var(--text-faint)]">
                                      {d.piorValor.toFixed(3)}mm · {formatarData(d.piorData)}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="surface mt-3 p-4">
            <h3 className="mb-3 text-xs font-semibold text-[var(--text-dim)]">
              Comparação de variação entre equipamentos
            </h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={dadosComparacao} margin={{ top: 4, right: 8, left: -16, bottom: 48 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="nome"
                    tick={{ fill: "var(--text-faint)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    interval={0}
                    angle={-40}
                    textAnchor="end"
                    height={60}
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
                    formatter={(v) => [`${v}mm`, "Variação"]}
                  />
                  <Bar
                    dataKey="variacao"
                    radius={[4, 4, 0, 0]}
                    onClick={(entrada) => {
                      const chave = (entrada as { payload?: { chave?: string } })?.payload?.chave;
                      if (chave) setSelecionado(chave);
                    }}
                    cursor="pointer"
                  >
                    {dadosComparacao.map((d) => (
                      <Cell key={d.chave} fill={d.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface mt-3 overflow-x-auto p-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Equipamento</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Medições</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Última</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Variação</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Tendência</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Pior ponto</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Fora da tolerância</th>
                  <th className="p-3 font-medium text-[var(--text-dim)]">Previsão</th>
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
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {c.foraToleranciaAgora && (
                            <AlertTriangle size={12} style={{ color: "#fca5a5" }} />
                          )}
                          {c.label}
                        </div>
                      </td>
                      <td className="p-3 text-[var(--text-dim)]">{c.totalSessoes}</td>
                      <td className="p-3 text-[var(--text-dim)]">
                        {c.ultimaMedicaoEm && formatarData(c.ultimaMedicaoEm)}
                      </td>
                      <td className="p-3 font-medium" style={{ color: corDaVariacao(c) }}>
                        {c.variacaoAbsoluta === null
                          ? "—"
                          : `${c.variacaoAbsoluta > 0 ? "+" : ""}${c.variacaoAbsoluta.toFixed(3)}mm`}
                      </td>
                      <td className="p-3" style={{ color: corDaVariacao(c) }}>
                        <div className="flex items-center gap-1">
                          <IconeTendencia combo={c} size={11} />
                          {c.tendencia === "piorando"
                            ? "Piorando"
                            : c.tendencia === "melhorando"
                              ? "Melhorando"
                              : c.tendencia === "estavel"
                                ? "Estável"
                                : "—"}
                        </div>
                      </td>
                      <td className="p-3 text-[var(--text-dim)]">
                        {c.piorPonto ? `Nº ${c.piorPonto.nCad} (${c.piorPonto.valor.toFixed(3)}mm)` : "—"}
                      </td>
                      <td className="p-3 text-[var(--text-dim)]">
                        {c.foraToleranciaPct === null ? "—" : `${c.foraToleranciaPct.toFixed(1)}%`}
                      </td>
                      <td className="p-3 text-[var(--text-dim)]">
                        {c.medicoesAteForaTolerancia === null
                          ? "—"
                          : `~${c.medicoesAteForaTolerancia} medições${
                              c.diasAteForaTolerancia !== null ? ` (${c.diasAteForaTolerancia}d)` : ""
                            }`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {semHistorico.length > 0 && (
            <div className="surface mt-3 p-3">
              <div className="mb-1.5 text-xs font-medium text-[var(--text-dim)]">
                Sem nenhuma medição registrada ainda
              </div>
              <div className="flex flex-wrap gap-1.5">
                {semHistorico.map((c) => (
                  <span
                    key={`${c.tipoFicha}|${c.maquina}|${c.veio}`}
                    className="rounded-md px-2 py-1 text-xs"
                    style={{ background: "var(--surface-raised)", color: "var(--text-faint)" }}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
