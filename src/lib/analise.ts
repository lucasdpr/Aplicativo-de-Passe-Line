import type { SupabaseClient } from "@supabase/supabase-js";
import type { Maquina, TipoFicha, Veio } from "@/types";
import { comboLabel, intervaloDias, type Combo } from "@/lib/prazos";

const VEIOS_POR_MAQUINA: Record<Maquina, Veio[]> = {
  MCC2: ["C", "D"],
  MCC3: ["E", "F"],
  MCC4: ["G", "H"],
};

const FICHAS_COM_ANALISE: TipoFicha[] = [
  "PASS_LINE_DESEMPENADEIRA",
  "GAP",
  "EMPENO_DESGASTE",
];

/**
 * MCC4 tem GAP, mas a Análise ainda não sabe calcular tendência pro
 * Pass-Line dos Segmentos (estrutura por segmento, não por Nº CAD) —
 * só GAP entra aqui até isso ser construído.
 */
const FICHAS_COM_ANALISE_POR_MAQUINA: Record<Maquina, TipoFicha[]> = {
  MCC2: FICHAS_COM_ANALISE,
  MCC3: FICHAS_COM_ANALISE,
  MCC4: ["GAP"],
};

function todosOsCombosAnalise(): Combo[] {
  const combos: Combo[] = [];
  for (const maquina of Object.keys(VEIOS_POR_MAQUINA) as Maquina[]) {
    for (const veio of VEIOS_POR_MAQUINA[maquina]) {
      for (const tipoFicha of FICHAS_COM_ANALISE_POR_MAQUINA[maquina]) {
        combos.push({ tipoFicha, maquina, veio });
      }
    }
  }
  return combos;
}

export interface PontoSerie {
  data: string; // yyyy-mm-dd
  valor: number;
}

export interface PontoExtremo {
  nCad: number;
  valor: number;
  data: string;
}

export interface DetalheNCad {
  nCad: number;
  ultimoValor: number;
  ultimaData: string;
  piorValor: number;
  piorData: string;
}

export interface AnaliseCombo extends Combo {
  label: string;
  unidade: string;
  /** O que "valor" representa nesse tipo de ficha (pro rótulo do gráfico). */
  descricaoValor: string;
  serie: PontoSerie[];
  totalSessoes: number;
  primeiroValor: number | null;
  ultimoValor: number | null;
  ultimaMedicaoEm: string | null;
  variacaoAbsoluta: number | null;
  variacaoPercentual: number | null;
  /** Variação média por medição — dá pra estimar o ritmo de desgaste. */
  variacaoPorMedicao: number | null;
  /** null = essa ficha não tem uma regra de tolerância aplicável (ex.: desgaste). */
  foraToleranciaPct: number | null;
  foraToleranciaContagem: number;
  medicoesTolerancia: number;
  /** Pior ponto individual já registrado (não é média) — o Nº CAD mais crítico. */
  piorPonto: PontoExtremo | null;
  /** true quando a última medição já está fora da tolerância agora. */
  foraToleranciaAgora: boolean;
  /** Limite de tolerância usado nesse combo (mm), ou null se a ficha não tem regra. */
  toleranciaMm: number | null;
  /** Classificação simples da tendência, considerando o ritmo por medição. */
  tendencia: "piorando" | "melhorando" | "estavel" | null;
  /** Intervalo médio (em dias) observado entre as medições reais desse combo. */
  intervaloMedioDias: number | null;
  /**
   * Quantas medições, no ritmo atual, faltam pra esse equipamento passar da
   * tolerância (a partir do último valor). null quando não dá pra estimar
   * (sem tolerância definida, sem ritmo, já fora, ou melhorando).
   */
  medicoesAteForaTolerancia: number | null;
  /** A mesma estimativa acima, convertida em dias usando o intervalo médio real. */
  diasAteForaTolerancia: number | null;
  /** Quantos dias já se passaram desde a última medição registrada. */
  diasDesdeUltimaMedicao: number | null;
  /** Positivo = atrasado (dias além do prazo esperado); negativo = ainda dentro do prazo. */
  diasAtraso: number | null;
  /** Detalhe por Nº CAD (posição física), ordenado pelo número — pra achar onde exatamente está o problema. */
  detalhePorNCad: DetalheNCad[];
}

interface SessaoLeve {
  id: string;
  tipoFicha: TipoFicha;
  maquina: Maquina;
  veio: Veio;
  data: string;
}

interface AgregadoNCad {
  ultimoValor: number;
  ultimaData: string;
  piorValor: number;
  piorData: string;
}

interface AgregadoCombo {
  serie: PontoSerie[];
  foraTotal: number;
  medicoesTolerancia: number;
  pior: PontoExtremo | null;
  ultimaDataVista: string | null;
  foraToleranciaAgora: boolean;
  /** Soma e contagem pra calcular a tolerância média usada (GAP varia por linha). */
  somaTolerancia: number;
  contagemTolerancia: number;
  porNCad: Map<number, AgregadoNCad>;
}

function novoAgregado(): AgregadoCombo {
  return {
    serie: [],
    foraTotal: 0,
    medicoesTolerancia: 0,
    pior: null,
    ultimaDataVista: null,
    foraToleranciaAgora: false,
    somaTolerancia: 0,
    contagemTolerancia: 0,
    porNCad: new Map(),
  };
}

/** Mesma lógica de "pior" do `atualizarPior`, mas guardando também o último valor visto por Nº CAD. */
function atualizarNCad(
  agregado: AgregadoCombo,
  nCad: number,
  valor: number,
  data: string,
  piorEhMenor: boolean
) {
  const atual = agregado.porNCad.get(nCad);
  if (!atual) {
    agregado.porNCad.set(nCad, { ultimoValor: valor, ultimaData: data, piorValor: valor, piorData: data });
    return;
  }
  if (data >= atual.ultimaData) {
    atual.ultimoValor = valor;
    atual.ultimaData = data;
  }
  const critico = piorEhMenor ? valor < atual.piorValor : valor > atual.piorValor;
  if (critico) {
    atual.piorValor = valor;
    atual.piorData = data;
  }
}

/** Tolerância fixa por tipo de ficha (mm). GAP tem tolerância própria por linha (ver abaixo). */
const TOLERANCIA_FIXA_MM: Partial<Record<TipoFicha, number>> = {
  PASS_LINE_DESEMPENADEIRA: 0.5,
};

/** Atualiza o "pior ponto" de um combo, considerando se maior ou menor valor é o crítico. */
function atualizarPior(
  agregado: AgregadoCombo,
  candidato: PontoExtremo,
  piorEhMenor: boolean
) {
  if (!agregado.pior) {
    agregado.pior = candidato;
    return;
  }
  const critico = piorEhMenor
    ? candidato.valor < agregado.pior.valor
    : candidato.valor > agregado.pior.valor;
  if (critico) agregado.pior = candidato;
}

/**
 * Busca o histórico completo e calcula, por combo (ficha+máquina+veio):
 * - a série de valores ao longo do tempo (indicador de desgaste/variação)
 * - quanto variou do primeiro pro último registro, e o ritmo por medição
 * - o pior ponto individual já registrado (não só a média)
 * - % de medições fora da tolerância (quando a ficha tem regra de tolerância)
 * - se está fora da tolerância agora (última medição)
 */
export async function buscarAnaliseCombos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<AnaliseCombo[]> {
  const [{ data: sessoesRaw }, { data: passLine }, { data: gap }, { data: empeno }] =
    await Promise.all([
      supabase
        .from("sessoes_medicao")
        .select("id, tipo_ficha, maquina, veio, data")
        .order("data", { ascending: true }),
      supabase
        .from("linhas_pass_line_desempenadeira")
        .select("sessao_id, n_cad, oeste_ajuste, leste_ajuste"),
      supabase
        .from("linhas_gap")
        .select(
          "sessao_id, n_cad, gap_nominal, tolerancia_mm, primeira_acionado, primeira_centro, primeira_nao_acionado, segunda_acionado, segunda_centro, segunda_nao_acionado"
        ),
      supabase
        .from("linhas_empeno_desgaste")
        .select("sessao_id, n_cad, desgaste_superior, desgaste_inferior, desgaste_par"),
    ]);

  const sessoes: SessaoLeve[] = (sessoesRaw ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    tipoFicha: s.tipo_ficha as TipoFicha,
    maquina: s.maquina as Maquina,
    veio: s.veio as Veio,
    data: s.data as string,
  }));
  const sessaoPorId = new Map(sessoes.map((s) => [s.id, s]));

  // sessaoId -> { valorSessao (média), foraCount, totalCount }
  const agregadoPorSessao = new Map<
    string,
    { valor: number | null; fora: number; total: number }
  >();
  const porCombo = new Map<string, AgregadoCombo>();

  function comboDaSessao(sessao: SessaoLeve) {
    const chave = `${sessao.tipoFicha}|${sessao.maquina}|${sessao.veio}`;
    const atual = porCombo.get(chave) ?? novoAgregado();
    porCombo.set(chave, atual);
    return atual;
  }

  for (const linha of passLine ?? []) {
    const sessaoId = linha.sessao_id as string;
    const sessao = sessaoPorId.get(sessaoId);
    if (!sessao) continue;
    const nCad = Number(linha.n_cad);
    const comboAgregado = comboDaSessao(sessao);
    const valores: { lado: string; valor: number }[] = [];
    if (linha.oeste_ajuste !== null && linha.oeste_ajuste !== undefined) {
      valores.push({ lado: "oeste", valor: Math.abs(Number(linha.oeste_ajuste)) });
    }
    if (linha.leste_ajuste !== null && linha.leste_ajuste !== undefined) {
      valores.push({ lado: "leste", valor: Math.abs(Number(linha.leste_ajuste)) });
    }
    if (valores.length === 0) continue;
    for (const v of valores) {
      atualizarPior(comboAgregado, { nCad, valor: v.valor, data: sessao.data }, false);
      atualizarNCad(comboAgregado, nCad, v.valor, sessao.data, false);
    }
    const atual = agregadoPorSessao.get(sessaoId) ?? { valor: null, fora: 0, total: 0 };
    const somaAnterior = (atual.valor ?? 0) * atual.total;
    const novoTotal = atual.total + valores.length;
    const novaSoma = somaAnterior + valores.reduce((a, b) => a + b.valor, 0);
    const foraAqui = valores.filter((v) => v.valor > 0.5).length;
    agregadoPorSessao.set(sessaoId, {
      valor: novaSoma / novoTotal,
      fora: atual.fora + foraAqui,
      total: novoTotal,
    });
  }

  for (const linha of gap ?? []) {
    const sessaoId = linha.sessao_id as string;
    const sessao = sessaoPorId.get(sessaoId);
    if (!sessao) continue;
    const nCad = Number(linha.n_cad);
    const nominal = Number(linha.gap_nominal);
    const tolerancia = Number(linha.tolerancia_mm);
    const comboAgregado = comboDaSessao(sessao);
    const medidos = [
      linha.primeira_acionado,
      linha.primeira_centro,
      linha.primeira_nao_acionado,
      linha.segunda_acionado,
      linha.segunda_centro,
      linha.segunda_nao_acionado,
    ]
      .filter((v) => v !== null && v !== undefined)
      .map((v) => Math.abs(Number(v) - nominal));
    if (medidos.length === 0) continue;
    for (const valor of medidos) {
      atualizarPior(comboAgregado, { nCad, valor, data: sessao.data }, false);
      atualizarNCad(comboAgregado, nCad, valor, sessao.data, false);
    }
    if (Number.isFinite(tolerancia)) {
      comboAgregado.somaTolerancia += tolerancia;
      comboAgregado.contagemTolerancia += 1;
    }
    const atual = agregadoPorSessao.get(sessaoId) ?? { valor: null, fora: 0, total: 0 };
    const somaAnterior = (atual.valor ?? 0) * atual.total;
    const novoTotal = atual.total + medidos.length;
    const novaSoma = somaAnterior + medidos.reduce((a, b) => a + b, 0);
    const foraAqui = medidos.filter((v) => v > tolerancia).length;
    agregadoPorSessao.set(sessaoId, {
      valor: novaSoma / novoTotal,
      fora: atual.fora + foraAqui,
      total: novoTotal,
    });
  }

  // Empeno e Desgaste não tem regra de tolerância cadastrada (é só o
  // diâmetro bruto do rolo) — acompanha a média do diâmetro como indicador
  // de desgaste (diâmetro caindo ao longo do tempo = rolo gastando). Aqui
  // o "pior ponto" é o MENOR diâmetro (mais gasto), não o maior.
  for (const linha of empeno ?? []) {
    const sessaoId = linha.sessao_id as string;
    const sessao = sessaoPorId.get(sessaoId);
    if (!sessao) continue;
    const nCad = Number(linha.n_cad);
    const comboAgregado = comboDaSessao(sessao);
    const diametros = [linha.desgaste_superior, linha.desgaste_inferior, linha.desgaste_par]
      .filter((v) => v !== null && v !== undefined)
      .map((v) => Number(v));
    if (diametros.length === 0) continue;
    for (const valor of diametros) {
      atualizarPior(comboAgregado, { nCad, valor, data: sessao.data }, true);
      atualizarNCad(comboAgregado, nCad, valor, sessao.data, true);
    }
    const atual = agregadoPorSessao.get(sessaoId) ?? { valor: null, fora: 0, total: 0 };
    const somaAnterior = (atual.valor ?? 0) * atual.total;
    const novoTotal = atual.total + diametros.length;
    const novaSoma = somaAnterior + diametros.reduce((a, b) => a + b, 0);
    agregadoPorSessao.set(sessaoId, {
      valor: novaSoma / novoTotal,
      fora: atual.fora, // sem regra de tolerância pra desgaste
      total: novoTotal,
    });
  }

  for (const [sessaoId, agregado] of agregadoPorSessao) {
    const sessao = sessaoPorId.get(sessaoId);
    if (!sessao || agregado.valor === null) continue;
    const comboAgregado = comboDaSessao(sessao);
    comboAgregado.serie.push({ data: sessao.data, valor: agregado.valor });
    comboAgregado.foraTotal += agregado.fora;
    comboAgregado.medicoesTolerancia += agregado.total;
    if (!comboAgregado.ultimaDataVista || sessao.data >= comboAgregado.ultimaDataVista) {
      comboAgregado.ultimaDataVista = sessao.data;
      comboAgregado.foraToleranciaAgora = agregado.fora > 0;
    }
  }

  const resultado: AnaliseCombo[] = [];
  for (const combo of todosOsCombosAnalise()) {
    const chave = `${combo.tipoFicha}|${combo.maquina}|${combo.veio}`;
    const agregado = porCombo.get(chave);
    const temToleranciaDefinida = combo.tipoFicha !== "EMPENO_DESGASTE";
    if (!agregado || agregado.serie.length === 0) {
      resultado.push({
        ...combo,
        label: comboLabel(combo),
        unidade: "mm",
        descricaoValor: descricaoDoValor(combo.tipoFicha),
        serie: [],
        totalSessoes: 0,
        primeiroValor: null,
        ultimoValor: null,
        ultimaMedicaoEm: null,
        variacaoAbsoluta: null,
        variacaoPercentual: null,
        variacaoPorMedicao: null,
        foraToleranciaPct: null,
        foraToleranciaContagem: 0,
        medicoesTolerancia: 0,
        piorPonto: null,
        foraToleranciaAgora: false,
        toleranciaMm: null,
        tendencia: null,
        intervaloMedioDias: null,
        medicoesAteForaTolerancia: null,
        diasAteForaTolerancia: null,
        diasDesdeUltimaMedicao: null,
        diasAtraso: null,
        detalhePorNCad: [],
      });
      continue;
    }
    agregado.serie.sort((a, b) => a.data.localeCompare(b.data));
    const primeiroValor = agregado.serie[0].valor;
    const ultimoValor = agregado.serie[agregado.serie.length - 1].valor;
    const ultimaMedicaoEm = agregado.serie[agregado.serie.length - 1].data;
    const variacaoAbsoluta = ultimoValor - primeiroValor;
    const variacaoPercentual = primeiroValor !== 0 ? (variacaoAbsoluta / primeiroValor) * 100 : null;
    const variacaoPorMedicao =
      agregado.serie.length > 1 ? variacaoAbsoluta / (agregado.serie.length - 1) : null;

    const toleranciaMm = !temToleranciaDefinida
      ? null
      : TOLERANCIA_FIXA_MM[combo.tipoFicha] ??
        (agregado.contagemTolerancia > 0 ? agregado.somaTolerancia / agregado.contagemTolerancia : null);

    const LIMIAR_ESTAVEL = 0.0005; // mm por medição — abaixo disso, considera "estável"
    const tendencia: AnaliseCombo["tendencia"] =
      variacaoPorMedicao === null
        ? null
        : Math.abs(variacaoPorMedicao) < LIMIAR_ESTAVEL
          ? "estavel"
          : combo.tipoFicha === "EMPENO_DESGASTE"
            ? variacaoPorMedicao < 0
              ? "piorando"
              : "melhorando"
            : variacaoPorMedicao > 0
              ? "piorando"
              : "melhorando";

    let intervaloMedioDias: number | null = null;
    if (agregado.serie.length > 1) {
      const primeiraData = new Date(`${agregado.serie[0].data}T00:00:00Z`).getTime();
      const ultimaData = new Date(
        `${agregado.serie[agregado.serie.length - 1].data}T00:00:00Z`
      ).getTime();
      const diasTotais = (ultimaData - primeiraData) / 86_400_000;
      intervaloMedioDias = diasTotais / (agregado.serie.length - 1);
    }

    // Estimativa de quantas medições faltam pra sair da tolerância, seguindo
    // o ritmo médio observado — só faz sentido quando a tendência é de
    // piora, o combo tem tolerância definida, e ainda não está fora dela.
    let medicoesAteForaTolerancia: number | null = null;
    let diasAteForaTolerancia: number | null = null;
    if (
      toleranciaMm !== null &&
      variacaoPorMedicao !== null &&
      ultimoValor !== null &&
      tendencia === "piorando" &&
      !(temToleranciaDefinida && agregado.foraToleranciaAgora)
    ) {
      const distanciaAtual =
        combo.tipoFicha === "EMPENO_DESGASTE" ? ultimoValor : toleranciaMm - ultimoValor;
      const ritmo = Math.abs(variacaoPorMedicao);
      if (distanciaAtual > 0 && ritmo > 0) {
        medicoesAteForaTolerancia = Math.ceil(distanciaAtual / ritmo);
        if (intervaloMedioDias !== null) {
          diasAteForaTolerancia = Math.round(medicoesAteForaTolerancia * intervaloMedioDias);
        }
      }
    }

    const hojeIso = new Date().toISOString().slice(0, 10);
    const diasDesdeUltimaMedicao = Math.round(
      (new Date(`${hojeIso}T00:00:00Z`).getTime() -
        new Date(`${ultimaMedicaoEm}T00:00:00Z`).getTime()) /
        86_400_000
    );
    const prazoDias = intervaloDias(combo.tipoFicha, combo.maquina);
    const diasAtraso = diasDesdeUltimaMedicao - prazoDias;

    const detalhePorNCad: DetalheNCad[] = Array.from(agregado.porNCad.entries())
      .map(([nCad, d]) => ({
        nCad,
        ultimoValor: d.ultimoValor,
        ultimaData: d.ultimaData,
        piorValor: d.piorValor,
        piorData: d.piorData,
      }))
      .sort((a, b) => a.nCad - b.nCad);

    resultado.push({
      ...combo,
      label: comboLabel(combo),
      unidade: "mm",
      descricaoValor: descricaoDoValor(combo.tipoFicha),
      serie: agregado.serie,
      totalSessoes: agregado.serie.length,
      primeiroValor,
      ultimoValor,
      ultimaMedicaoEm,
      variacaoAbsoluta,
      variacaoPercentual,
      variacaoPorMedicao,
      foraToleranciaPct:
        temToleranciaDefinida && agregado.medicoesTolerancia > 0
          ? (agregado.foraTotal / agregado.medicoesTolerancia) * 100
          : null,
      foraToleranciaContagem: agregado.foraTotal,
      medicoesTolerancia: agregado.medicoesTolerancia,
      piorPonto: agregado.pior,
      foraToleranciaAgora: temToleranciaDefinida && agregado.foraToleranciaAgora,
      toleranciaMm,
      tendencia,
      intervaloMedioDias,
      medicoesAteForaTolerancia,
      diasAteForaTolerancia,
      diasDesdeUltimaMedicao,
      diasAtraso,
      detalhePorNCad,
    });
  }

  return resultado;
}

function descricaoDoValor(tipoFicha: TipoFicha): string {
  switch (tipoFicha) {
    case "PASS_LINE_DESEMPENADEIRA":
      return "Ajuste médio aplicado";
    case "GAP":
      return "Desvio médio do GAP nominal";
    case "EMPENO_DESGASTE":
      return "Diâmetro médio do rolo";
    default:
      return "Valor médio";
  }
}
