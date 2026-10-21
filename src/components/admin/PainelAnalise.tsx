"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  History,
  MapPin,
  Minus,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { lerDados } from "@/lib/lerDados";
import type { Maquina } from "@/types";
import { type AnaliseCombo, type PontoSerie } from "@/lib/analise";

// ---------- Regras de leitura ----------

const chaveDe = (c: AnaliseCombo) => `${c.tipoFicha}|${c.maquina}|${c.veio}`;

function formatarData(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatarDataLonga(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR");
}

const mm = (v: number, casas = 2) => `${v.toFixed(casas).replace(".", ",")} mm`;
const sinal = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

/** Empeno/Desgaste: diâmetro caindo = mais gasto = pior. Nas outras: desvio subindo = pior. */
/** Abaixo disso a diferença é da leitura do instrumento, não do equipamento. */
const VARIACAO_MINIMA_MM = 0.05;

function estaPiorando(combo: AnaliseCombo): boolean | null {
  if (combo.variacaoAbsoluta === null) return null;
  if (Math.abs(combo.variacaoAbsoluta) < VARIACAO_MINIMA_MM - 1e-9) return null;
  return combo.tipoFicha === "EMPENO_DESGASTE"
    ? combo.variacaoAbsoluta < 0
    : combo.variacaoAbsoluta > 0;
}

function rotuloPosicao(tipoFicha: AnaliseCombo["tipoFicha"]) {
  if (tipoFicha === "PASS_LINE_SEGMENTOS") return "Emenda";
  if (tipoFicha === "GAP_MCC4") return "Segmento";
  return "Nº CAD";
}

const SIGLA_FICHA: Record<AnaliseCombo["tipoFicha"], string> = {
  PASS_LINE_DESEMPENADEIRA: "PL-D",
  GAP: "GAP",
  EMPENO_DESGASTE: "E/D",
  PASS_LINE_SEGMENTOS: "PL-S",
  GAP_MCC4: "GAP",
};

const NOME_FICHA: Record<AnaliseCombo["tipoFicha"], string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line da Desempenadeira",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos segmentos",
  GAP_MCC4: "GAP",
};

const COR_FICHA: Record<AnaliseCombo["tipoFicha"], string> = {
  PASS_LINE_DESEMPENADEIRA: "var(--primary-strong)",
  GAP: "var(--accent-steel)",
  EMPENO_DESGASTE: "var(--accent-ember)",
  PASS_LINE_SEGMENTOS: "var(--accent-slate)",
  GAP_MCC4: "var(--accent-steel)",
};

type Situacao = "fora" | "piorando" | "ok" | "sem_regra";

function situacaoDe(c: AnaliseCombo): Situacao {
  if (c.foraToleranciaAgora) return "fora";
  if (estaPiorando(c) === true) return "piorando";
  if (c.toleranciaMm === null) return "sem_regra";
  return "ok";
}

const SITUACAO: Record<Situacao, { texto: string; cor: string; fundo: string; icon: typeof AlertTriangle }> = {
  fora: { texto: "Fora da tolerância", cor: "#fca5a5", fundo: "var(--danger-soft)", icon: AlertTriangle },
  piorando: { texto: "Piorando", cor: "#fbbf24", fundo: "var(--warning-soft)", icon: TrendingUp },
  ok: { texto: "Dentro", cor: "#4ade80", fundo: "var(--success-soft)", icon: CheckCircle2 },
  sem_regra: { texto: "Acompanhamento", cor: "var(--text-dim)", fundo: "var(--surface-raised)", icon: Activity },
};

function textoTendencia(combo: AnaliseCombo): string {
  if (combo.tendencia === "estavel") return "Estável entre medições";
  if (combo.tendencia === "melhorando") return "Melhorando a cada medição";
  if (combo.tendencia === "piorando") return "Piorando a cada medição";
  return "Poucas medições para saber a tendência";
}

function IconeTendencia({ combo, size = 13 }: { combo: AnaliseCombo; size?: number }) {
  if (combo.tendencia === "piorando") return <TrendingUp size={size} />;
  if (combo.tendencia === "melhorando") return <TrendingDown size={size} />;
  return <Minus size={size} />;
}

/** Quanto do limite o último valor já usa (só para fichas medidas como desvio). */
function usoDaTolerancia(c: AnaliseCombo): number | null {
  if (c.toleranciaMm === null || c.ultimoValor === null || c.tipoFicha === "EMPENO_DESGASTE") return null;
  return (Math.abs(c.ultimoValor) / c.toleranciaMm) * 100;
}

/**
 * Ponto da série mais próximo de "1 ano antes da última medição" (janela de
 * 30 dias). Só aparece quando já existe mais de ~1 ano de histórico.
 */
function comparacaoAnoAnterior(combo: AnaliseCombo): { pontoAntigo: PontoSerie; diasEntre: number } | null {
  if (!combo.ultimaMedicaoEm || combo.serie.length < 2) return null;
  const ultimaData = new Date(`${combo.ultimaMedicaoEm}T00:00:00Z`).getTime();
  const alvo = ultimaData - 365 * 86_400_000;
  let melhor: PontoSerie | null = null;
  let melhorDistancia = Infinity;
  for (const ponto of combo.serie) {
    const distancia = Math.abs(new Date(`${ponto.data}T00:00:00Z`).getTime() - alvo);
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia;
      melhor = ponto;
    }
  }
  if (!melhor || melhorDistancia > 30 * 86_400_000) return null;
  const diasEntre = Math.round((ultimaData - new Date(`${melhor.data}T00:00:00Z`).getTime()) / 86_400_000);
  return { pontoAntigo: melhor, diasEntre };
}

function textoPrevisao(combo: AnaliseCombo): string | null {
  if (combo.medicoesAteForaTolerancia === null) return null;
  const n = combo.medicoesAteForaTolerancia;
  const plural = n === 1 ? "medição" : "medições";
  return combo.diasAteForaTolerancia !== null
    ? `Sai da tolerância em ~${n} ${plural} (~${combo.diasAteForaTolerancia} dias), se o ritmo continuar`
    : `Sai da tolerância em ~${n} ${plural}, se o ritmo continuar`;
}

// ---------- Peças visuais ----------

function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const s = SITUACAO[situacao];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold"
      style={{ color: s.cor, background: s.fundo }}
    >
      <Icon size={11} />
      {s.texto}
    </span>
  );
}

/** Mini-curva da série, com o limite tracejado quando cabe na escala. */
function Sparkline({ c }: { c: AnaliseCombo }) {
  const valores = c.serie.map((p) => p.valor);
  const L = 76;
  const A = 24;
  if (valores.length < 2) {
    return <span className="block h-6 w-[76px]" aria-hidden />;
  }
  const tol = c.tipoFicha === "EMPENO_DESGASTE" ? null : c.toleranciaMm;
  const max = Math.max(...valores, tol ?? -Infinity);
  const min = c.tipoFicha === "EMPENO_DESGASTE" ? Math.min(...valores) : 0;
  const escala = (v: number) => A - 2 - ((v - min) / (max - min || 1)) * (A - 4);
  const pontos = valores.map((v, i) => `${(i / (valores.length - 1)) * (L - 4) + 2},${escala(v)}`).join(" ");
  const ultimo = valores[valores.length - 1];
  const cor = situacaoDe(c) === "fora" ? "#fca5a5" : situacaoDe(c) === "piorando" ? "#fbbf24" : "var(--primary-strong)";
  return (
    <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} aria-hidden className="shrink-0">
      {tol !== null && (
        <line x1="0" x2={L} y1={escala(tol)} y2={escala(tol)} stroke="#fca5a5" strokeOpacity="0.5" strokeDasharray="2 2" />
      )}
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={L - 2} cy={escala(ultimo)} r="2.4" fill={cor} />
    </svg>
  );
}

function Metrica({
  rotulo,
  valor,
  nota,
  cor,
  children,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  cor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-xs text-[var(--text-faint)]">{rotulo}</div>
      <div
        className="mt-1 font-mono text-xl font-semibold tracking-tight"
        style={{ color: cor ?? "var(--text)", fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </div>
      {children}
      {nota && <div className="mt-1 text-xs text-[var(--text-faint)]">{nota}</div>}
    </div>
  );
}

const estiloTooltip = {
  contentStyle: {
    background: "var(--surface-raised)",
    border: "1px solid var(--border-strong)",
    borderRadius: 10,
    fontSize: 12,
    boxShadow: "0 12px 30px -12px rgba(0,0,0,.8)",
  },
  labelStyle: { color: "var(--text-dim)", marginBottom: 2 },
  itemStyle: { color: "var(--text)" },
};

const eixo = {
  tick: { fill: "var(--text-faint)", fontSize: 11 },
  axisLine: { stroke: "var(--border)" },
  tickLine: false,
} as const;

// ---------- Painel ----------

export function PainelAnalise() {
  const [combos, setCombos] = useState<AnaliseCombo[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [filtroMaquina, setFiltroMaquina] = useState<Maquina | "TODAS">("TODAS");
  const [tabelaPosicoesAberta, setTabelaPosicoesAberta] = useState(false);

  useEffect(() => {
    lerDados<AnaliseCombo[]>({ tipo: "analise" })
      .then((resultado) => {
        setCombos(resultado);
        // Abre direto no que mais pede atenção.
        const comDados = resultado.filter((c) => c.serie.length > 0);
        const primeiro =
          comDados.find((c) => c.foraToleranciaAgora) ??
          comDados.find((c) => estaPiorando(c) === true) ??
          comDados.find((c) => c.serie.length > 1) ??
          comDados[0];
        if (primeiro) setSelecionado(chaveDe(primeiro));
      })
      .catch(() => setCombos([]));
  }, []);

  const comDados = useMemo(() => (combos ?? []).filter((c) => c.serie.length > 0), [combos]);
  const semHistorico = useMemo(() => (combos ?? []).filter((c) => c.serie.length === 0), [combos]);
  const maquinas = useMemo(
    () => [...new Set(comDados.map((c) => c.maquina))].sort() as Maquina[],
    [comDados]
  );
  const listados = useMemo(
    () => comDados.filter((c) => filtroMaquina === "TODAS" || c.maquina === filtroMaquina),
    [comDados, filtroMaquina]
  );
  const comboAtivo = comDados.find((c) => chaveDe(c) === selecionado);

  const foraAgora = comDados.filter((c) => c.foraToleranciaAgora).length;
  const piorando = comDados.filter((c) => estaPiorando(c) === true).length;
  const atrasados = useMemo(() => comDados.filter((c) => c.diasAtraso !== null && c.diasAtraso > 0), [comDados]);

  const ranking = useMemo(
    () =>
      comDados
        // Empeno/desgaste é diâmetro do rolo: na mesma escala dos desvios, achataria o resto.
        .filter((c) => c.variacaoAbsoluta !== null && c.tipoFicha !== "EMPENO_DESGASTE")
        .map((c) => {
          const p = estaPiorando(c);
          return {
            nome: `${SIGLA_FICHA[c.tipoFicha]} ${c.maquina}-${c.veio}`,
            chave: chaveDe(c),
            variacao: Number((c.variacaoAbsoluta ?? 0).toFixed(3)),
            cor: p === true ? "#f87171" : p === false ? "#4ade80" : "var(--text-faint)",
            estado: p === true ? "Piorou" : p === false ? "Melhorou" : "Estável",
          };
        })
        .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao)),
    [comDados]
  );

  return (
    <section id="analise" className="print:text-black">
      <header className="entrar mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rotulo-secao">Acompanhar</p>
          <h1 className="font-display mt-1.5 text-3xl font-semibold tracking-tight">Análise e variação</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-dim)]">
            Como cada equipamento evoluiu entre as medições, o que está fora da tolerância e em
            qual posição está o problema.
          </p>
        </div>
        {comDados.length > 0 && (
          <button
            onClick={() => window.print()}
            className="sidebar-botao-menu print:hidden"
          >
            <Printer size={15} /> Imprimir
          </button>
        )}
      </header>

      {!combos && <Carregando />}

      {combos && comDados.length === 0 && (
        <div className="surface p-10 text-center">
          <Gauge className="mx-auto text-[var(--text-faint)]" size={28} />
          <p className="mt-3 font-medium">Ainda não há histórico para calcular variação</p>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Assim que houver duas medições do mesmo equipamento, a evolução aparece aqui.
          </p>
        </div>
      )}

      {comDados.length > 0 && (
        <div className="space-y-5">
          <div className="entrar grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
            <Kpi rotulo="Fora da tolerância" valor={foraAgora} nota="na última medição" cor="var(--danger)" icon={AlertTriangle} />
            <Kpi rotulo="Piorando" valor={piorando} nota="desde a 1ª medição" cor="var(--warning)" icon={TrendingUp} />
            <Kpi rotulo="Medição atrasada" valor={atrasados.length} nota="passaram do prazo" cor={atrasados.length ? "var(--danger)" : "var(--border-strong)"} icon={CalendarClock} />
            <Kpi rotulo="Com histórico" valor={comDados.length} nota={`${semHistorico.length} ainda sem medição`} cor="var(--primary-strong)" icon={Activity} />
          </div>

          <div className="entrar grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ animationDelay: "120ms" }}>
            {/* Lista de equipamentos */}
            <div className="surface flex max-h-[44rem] flex-col overflow-hidden p-0 print:hidden">
              <div className="flex flex-wrap gap-1 border-b p-2.5" style={{ borderColor: "var(--border)" }} role="tablist" aria-label="Filtrar por máquina">
                {(["TODAS", ...maquinas] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={filtroMaquina === m}
                    onClick={() => setFiltroMaquina(m)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium transition"
                    style={
                      filtroMaquina === m
                        ? { background: "var(--primary-soft)", color: "var(--primary-strong)" }
                        : { color: "var(--text-dim)" }
                    }
                  >
                    {m === "TODAS" ? "Todas" : m}
                  </button>
                ))}
              </div>
              <ul className="flex-1 overflow-y-auto p-1.5">
                {listados.map((c) => {
                  const ativo = chaveDe(c) === selecionado;
                  return (
                    <li key={chaveDe(c)}>
                      <button
                        onClick={() => {
                          setSelecionado(chaveDe(c));
                          setTabelaPosicoesAberta(false);
                        }}
                        aria-current={ativo}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--surface-raised)]"
                        style={ativo ? { background: "var(--primary-soft)" } : undefined}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="sigla-ficha !text-[0.62rem]" style={{ "--cor": COR_FICHA[c.tipoFicha] } as React.CSSProperties}>
                              {SIGLA_FICHA[c.tipoFicha]}
                            </span>
                            <span className="truncate text-sm font-medium">
                              {c.maquina} · veio {c.veio}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-[var(--text-faint)]">
                            <SituacaoPonto situacao={situacaoDe(c)} />
                            {SITUACAO[situacaoDe(c)].texto}
                            {c.ultimaMedicaoEm && <> · {formatarData(c.ultimaMedicaoEm)}</>}
                          </span>
                        </span>
                        <Sparkline c={c} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {comboAtivo ? (
              <Detalhe
                c={comboAtivo}
                tabelaAberta={tabelaPosicoesAberta}
                alternarTabela={() => setTabelaPosicoesAberta((v) => !v)}
              />
            ) : (
              <div className="surface p-8 text-center text-sm text-[var(--text-dim)]">
                Escolha um equipamento na lista.
              </div>
            )}
          </div>

          {ranking.length > 0 && (
            <div className="surface p-5">
              <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold tracking-tight">Ranking de variação</h2>
                  <p className="text-xs text-[var(--text-faint)]">
                    Quanto cada equipamento mudou da 1ª para a última medição (empeno e desgaste ficam na tabela). Clique numa barra para abrir.
                  </p>
                </div>
                <div className="flex gap-3 text-xs text-[var(--text-dim)]">
                  {[
                    ["#f87171", "Piorou"],
                    ["#4ade80", "Melhorou"],
                    ["var(--text-faint)", "Estável"],
                  ].map(([cor, t]) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ width: "100%", height: Math.max(160, ranking.length * 30 + 30) }}>
                <ResponsiveContainer>
                  <BarChart data={ranking} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }} barCategoryGap={6}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
                    <XAxis type="number" {...eixo} tickFormatter={(v) => `${v}`} unit=" mm" />
                    <YAxis type="category" dataKey="nome" width={118} {...eixo} tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                    <ReferenceLine x={0} stroke="var(--border-strong)" />
                    <Tooltip
                      {...estiloTooltip}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      formatter={(v, _n, item) => [
                        `${sinal(Number(v))}${Math.abs(Number(v)).toFixed(3).replace(".", ",")} mm`,
                        (item?.payload as { estado?: string })?.estado ?? "Variação",
                      ]}
                    />
                    <Bar
                      dataKey="variacao"
                      radius={4}
                      cursor="pointer"
                      onClick={(e) => {
                        const chave = (e as { payload?: { chave?: string } })?.payload?.chave;
                        if (chave) setSelecionado(chave);
                      }}
                    >
                      {ranking.map((d) => (
                        <Cell
                          key={d.chave}
                          fill={d.cor}
                          fillOpacity={d.chave === selecionado ? 1 : 0.75}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <TabelaGeral combos={comDados} selecionado={selecionado} selecionar={setSelecionado} />

          {semHistorico.length > 0 && (
            <div className="surface p-4">
              <div className="mb-2 text-xs font-medium text-[var(--text-dim)]">
                Sem nenhuma medição registrada ainda ({semHistorico.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {semHistorico.map((c) => (
                  <span key={chaveDe(c)} className="pilula-veio">
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Carregando() {
  return (
    <div className="space-y-4" aria-label="Carregando análise">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-tile h-[104px] animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="surface h-96 animate-pulse" />
        <div className="surface h-96 animate-pulse" />
      </div>
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  nota,
  cor,
  icon: Icon,
}: {
  rotulo: string;
  valor: number;
  nota: string;
  cor: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <div className="stat-tile" style={{ "--cor-estado": cor } as React.CSSProperties}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-dim)]">
        <Icon size={13} style={{ color: cor }} />
        {rotulo}
      </span>
      <span className="stat-valor">{valor}</span>
      <span className="text-xs text-[var(--text-faint)]">{nota}</span>
    </div>
  );
}

function SituacaoPonto({ situacao }: { situacao: Situacao }) {
  const estado = situacao === "fora" ? "atrasado" : situacao === "piorando" ? "vencendo" : situacao === "ok" ? "em_dia" : undefined;
  return <span className="ponto-estado" data-estado={estado} aria-hidden />;
}

function Detalhe({
  c,
  tabelaAberta,
  alternarTabela,
}: {
  c: AnaliseCombo;
  tabelaAberta: boolean;
  alternarTabela: () => void;
}) {
  const ehEmpeno = c.tipoFicha === "EMPENO_DESGASTE";
  const tol = ehEmpeno ? null : c.toleranciaMm;
  const situacao = situacaoDe(c);
  const piorando = estaPiorando(c);
  const uso = usoDaTolerancia(c);
  const comparacao = comparacaoAnoAnterior(c);
  const previsao = textoPrevisao(c);

  const serie = c.serie.map((p) => ({ data: formatarData(p.data), dataLonga: formatarDataLonga(p.data), valor: Number(p.valor.toFixed(3)) }));
  const maxSerie = Math.max(...c.serie.map((p) => p.valor));
  const topoY = tol !== null ? Math.max(tol * 1.4, maxSerie * 1.15) : undefined;

  const posicoes = [...c.detalhePorNCad].sort((a, b) => a.nCad - b.nCad).map((d) => ({
    pos: c.tipoFicha === "PASS_LINE_SEGMENTOS" && d.nCad === 0 ? "B" : String(d.nCad),
    valor: Number(d.ultimoValor.toFixed(3)),
    fora: tol !== null && Math.abs(d.ultimoValor) > tol + 1e-9,
    pior: d.piorValor,
    piorData: d.piorData,
  }));
  const qtdForaPos = posicoes.filter((p) => p.fora).length;
  const corVariacao = piorando === true ? "#fca5a5" : piorando === false ? "#4ade80" : "var(--text)";

  return (
    <div className="surface min-w-0 overflow-hidden p-0">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="sigla-ficha" style={{ "--cor": COR_FICHA[c.tipoFicha] } as React.CSSProperties}>
              {SIGLA_FICHA[c.tipoFicha]}
            </span>
            <SeloSituacao situacao={situacao} />
          </div>
          <h2 className="font-display mt-1.5 text-xl font-semibold tracking-tight">
            {NOME_FICHA[c.tipoFicha]} · {c.maquina} veio {c.veio}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-faint)]">
            {c.descricaoValor} · {c.totalSessoes} {c.totalSessoes === 1 ? "medição" : "medições"}
            {c.ultimaMedicaoEm && <> · última em {formatarDataLonga(c.ultimaMedicaoEm)}</>}
            {tol !== null && <> · tolerância ±{tol.toFixed(2).replace(".", ",")} mm</>}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium" style={{ background: "var(--surface-raised)", color: corVariacao }}>
          <IconeTendencia combo={c} />
          {textoTendencia(c)}
        </span>
      </div>

      {/* Números principais */}
      <div className="grid grid-cols-2 divide-x divide-y border-b md:grid-cols-4 md:divide-y-0" style={{ borderColor: "var(--border)" }}>
        <Metrica
          rotulo="Última medição"
          valor={c.ultimoValor !== null ? mm(c.ultimoValor, ehEmpeno ? 2 : 3) : "–"}
          nota={ehEmpeno ? "diâmetro médio" : "desvio médio"}
        />
        <Metrica
          rotulo="Uso da tolerância"
          valor={uso !== null ? `${Math.round(uso)}%` : "–"}
          cor={uso === null ? undefined : uso > 100 ? "#fca5a5" : uso > 80 ? "#fbbf24" : "#4ade80"}
        >
          {uso !== null && (
            <div className="medidor mt-2" aria-hidden>
              <span style={{ width: `${Math.min(100, uso)}%`, background: uso > 100 ? "var(--danger)" : uso > 80 ? "var(--warning)" : "var(--success)" }} />
            </div>
          )}
          {uso === null && <div className="mt-1 text-xs text-[var(--text-faint)]">sem limite nesta ficha</div>}
        </Metrica>
        <Metrica
          rotulo="Variação (1ª → última)"
          valor={c.variacaoAbsoluta !== null ? `${sinal(c.variacaoAbsoluta)}${mm(Math.abs(c.variacaoAbsoluta), 3)}` : "–"}
          cor={corVariacao}
          nota={c.variacaoPercentual !== null ? `${sinal(c.variacaoPercentual)}${Math.abs(c.variacaoPercentual).toFixed(1)}%` : undefined}
        />
        <Metrica
          rotulo="Ritmo por medição"
          valor={c.variacaoPorMedicao !== null ? `${sinal(c.variacaoPorMedicao)}${mm(Math.abs(c.variacaoPorMedicao), 3)}` : "–"}
          nota={c.intervaloMedioDias !== null ? `a cada ~${Math.round(c.intervaloMedioDias)} dias` : undefined}
        />
      </div>

      <div className="space-y-6 p-5">
        {/* Evolução */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Evolução</h3>
            {tol !== null && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                <span className="h-0 w-4 border-t border-dashed" style={{ borderColor: "#fca5a5" }} />
                limite ±{tol.toFixed(2).replace(".", ",")} mm
              </span>
            )}
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={serie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-evolucao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-strong)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary-strong)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                {tol !== null && topoY !== undefined && (
                  <ReferenceArea y1={tol} y2={topoY} fill="#ef4444" fillOpacity={0.06} ifOverflow="extendDomain" />
                )}
                <XAxis dataKey="data" {...eixo} minTickGap={16} />
                <YAxis {...eixo} width={48} domain={tol !== null ? [0, topoY ?? "auto"] : ["auto", "auto"]} tickFormatter={(v) => Number(v).toFixed(ehEmpeno ? 1 : 2)} />
                <Tooltip
                  {...estiloTooltip}
                  labelFormatter={(_, p) => (p?.[0]?.payload as { dataLonga?: string })?.dataLonga ?? ""}
                  formatter={(v) => {
                    const n = Number(v);
                    const fora = tol !== null && n > tol;
                    return [`${n.toFixed(3).replace(".", ",")} mm${tol !== null ? (fora ? " · fora" : " · dentro") : ""}`, c.descricaoValor];
                  }}
                />
                {tol !== null && <ReferenceLine y={tol} stroke="#fca5a5" strokeDasharray="5 4" />}
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--primary-strong)"
                  strokeWidth={2}
                  fill="url(#grad-evolucao)"
                  dot={{ r: 3.5, fill: "var(--surface)", stroke: "var(--primary-strong)", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "var(--primary-strong)", stroke: "var(--surface)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Onde está o problema */}
        {posicoes.length > 0 && (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MapPin size={14} className="text-[var(--text-faint)]" />
                Onde está o problema
              </h3>
              <span className="text-xs text-[var(--text-faint)]">
                Última medição por {rotuloPosicao(c.tipoFicha).toLowerCase()}
                {tol !== null && (
                  <>
                    {" "}· <span style={{ color: qtdForaPos ? "#fca5a5" : "#4ade80" }}>{qtdForaPos} fora</span> de {posicoes.length}
                  </>
                )}
              </span>
            </div>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                {ehEmpeno ? (
                  <LineChart data={posicoes} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="pos" {...eixo} interval="preserveStartEnd" minTickGap={6} />
                    <YAxis {...eixo} width={48} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toFixed(1)} />
                    <Tooltip {...estiloTooltip} labelFormatter={(l) => `${rotuloPosicao(c.tipoFicha)} ${l}`} formatter={(v) => [`${Number(v).toFixed(2).replace(".", ",")} mm`, "Diâmetro"]} />
                    <Line dataKey="valor" stroke="var(--accent-ember)" strokeWidth={1.6} dot={{ r: 3, fill: "var(--accent-ember)" }} />
                  </LineChart>
                ) : (
                  <BarChart data={posicoes} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="pos" {...eixo} interval="preserveStartEnd" minTickGap={4} />
                    <YAxis {...eixo} width={48} tickFormatter={(v) => Number(v).toFixed(2)} />
                    <Tooltip
                      {...estiloTooltip}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      labelFormatter={(l) => `${rotuloPosicao(c.tipoFicha)} ${l}`}
                      formatter={(v, _n, item) => {
                        const p = item?.payload as { fora?: boolean };
                        return [`${Number(v).toFixed(3).replace(".", ",")} mm · ${p?.fora ? "fora" : "dentro"}`, "Desvio"];
                      }}
                    />
                    {tol !== null && <ReferenceLine y={tol} stroke="#fca5a5" strokeDasharray="5 4" />}
                    <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
                      {posicoes.map((p) => (
                        <Cell key={p.pos} fill={p.fora ? "#f87171" : "var(--primary-strong)"} fillOpacity={p.fora ? 0.95 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <button
              onClick={alternarTabela}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-[var(--text-dim)] hover:text-[var(--text)]"
              aria-expanded={tabelaAberta}
            >
              {tabelaAberta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {tabelaAberta ? "Esconder tabela" : "Ver em tabela"}
            </button>
            {tabelaAberta && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0" style={{ background: "var(--surface-raised)" }}>
                    <tr>
                      <th className="p-2 font-medium text-[var(--text-dim)]">{rotuloPosicao(c.tipoFicha)}</th>
                      <th className="p-2 font-medium text-[var(--text-dim)]">Última</th>
                      <th className="p-2 font-medium text-[var(--text-dim)]">Pior já visto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posicoes.map((p) => (
                      <tr key={p.pos} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="p-2 font-mono font-medium">{p.pos}</td>
                        <td className="p-2 font-mono" style={{ color: p.fora ? "#fca5a5" : "var(--text-dim)" }}>
                          {p.valor.toFixed(3).replace(".", ",")} mm {p.fora && "· fora"}
                        </td>
                        <td className="p-2 font-mono text-[var(--text-faint)]">
                          {p.pior.toFixed(3).replace(".", ",")} mm · {formatarData(p.piorData)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Leituras */}
        <div className="grid gap-3 sm:grid-cols-2">
          {previsao && (
            <Nota icon={Clock} cor="#fbbf24" titulo="Estimativa">
              {previsao}
            </Nota>
          )}
          {c.piorPonto && (
            <Nota icon={MapPin} cor="var(--text-dim)" titulo={`Pior ponto: ${rotuloPosicao(c.tipoFicha)} ${c.piorPonto.nCad}`}>
              {mm(c.piorPonto.valor, 3)} em {formatarDataLonga(c.piorPonto.data)}
            </Nota>
          )}
          {c.foraToleranciaPct !== null && (
            <Nota
              icon={c.foraToleranciaPct > 0 ? AlertTriangle : CheckCircle2}
              cor={c.foraToleranciaPct > 0 ? "#fca5a5" : "#4ade80"}
              titulo={`${c.foraToleranciaContagem} de ${c.medicoesTolerancia} leituras fora`}
            >
              {c.foraToleranciaPct.toFixed(1).replace(".", ",")}% de todo o histórico deste equipamento
            </Nota>
          )}
          <Nota icon={History} cor="var(--text-dim)" titulo="Mesma época do ano passado">
            {comparacao
              ? `${mm(comparacao.pontoAntigo.valor, 3)} em ${formatarDataLonga(comparacao.pontoAntigo.data)}, contra ${c.ultimoValor !== null ? mm(c.ultimoValor, 3) : "–"} agora`
              : "Ainda não há medição de ~1 ano atrás para comparar."}
          </Nota>
        </div>
      </div>
    </div>
  );
}

function Nota({
  icon: Icon,
  cor,
  titulo,
  children,
}: {
  icon: typeof AlertTriangle;
  cor: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.015)" }}>
      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: cor }} />
      <div className="min-w-0 text-xs leading-relaxed">
        <div className="font-semibold text-[var(--text)]">{titulo}</div>
        <div className="text-[var(--text-dim)]">{children}</div>
      </div>
    </div>
  );
}

function TabelaGeral({
  combos,
  selecionado,
  selecionar,
}: {
  combos: AnaliseCombo[];
  selecionado: string | null;
  selecionar: (k: string) => void;
}) {
  const ordenados = [...combos].sort((a, b) => {
    const peso = (c: AnaliseCombo) => ({ fora: 0, piorando: 1, ok: 2, sem_regra: 3 })[situacaoDe(c)];
    return peso(a) - peso(b) || a.label.localeCompare(b.label);
  });
  return (
    <div className="surface overflow-hidden p-0">
      <div className="px-5 pb-2 pt-4">
        <h2 className="font-display text-base font-semibold tracking-tight">Todos os equipamentos</h2>
        <p className="text-xs text-[var(--text-faint)]">Os que pedem atenção aparecem primeiro. Clique numa linha para abrir o detalhe.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-y" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
              {["Equipamento", "Situação", "Medições", "Última", "Variação", "Pior ponto", "Fora (histórico)", "Previsão"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium text-[var(--text-dim)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.map((c) => {
              const chave = chaveDe(c);
              const p = estaPiorando(c);
              return (
                <tr
                  key={chave}
                  onClick={() => {
                    selecionar(chave);
                    document.getElementById("analise")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="cursor-pointer border-b transition hover:bg-[var(--surface-raised)]"
                  style={{ borderColor: "var(--border)", background: chave === selecionado ? "var(--primary-soft)" : undefined }}
                >
                  <td className="px-4 py-2.5 font-medium">
                    <span className="flex items-center gap-2">
                      <span className="sigla-ficha !text-[0.62rem]" style={{ "--cor": COR_FICHA[c.tipoFicha] } as React.CSSProperties}>
                        {SIGLA_FICHA[c.tipoFicha]}
                      </span>
                      {c.maquina} · {c.veio}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <SeloSituacao situacao={situacaoDe(c)} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text-dim)]">{c.totalSessoes}</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text-dim)]">{c.ultimaMedicaoEm && formatarData(c.ultimaMedicaoEm)}</td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: p === true ? "#fca5a5" : p === false ? "#4ade80" : "var(--text-dim)" }}>
                    {c.variacaoAbsoluta === null ? "—" : `${sinal(c.variacaoAbsoluta)}${Math.abs(c.variacaoAbsoluta).toFixed(3).replace(".", ",")}`}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-dim)]">
                    {c.piorPonto ? `${rotuloPosicao(c.tipoFicha)} ${c.piorPonto.nCad} · ${c.piorPonto.valor.toFixed(2).replace(".", ",")}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text-dim)]">
                    {c.foraToleranciaPct === null ? "—" : `${c.foraToleranciaPct.toFixed(1).replace(".", ",")}%`}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-dim)]">
                    {c.medicoesAteForaTolerancia === null
                      ? "—"
                      : `~${c.medicoesAteForaTolerancia} med.${c.diasAteForaTolerancia !== null ? ` (${c.diasAteForaTolerancia}d)` : ""}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
