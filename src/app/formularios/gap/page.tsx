"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, MoveHorizontal } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import {
  SessaoHeader,
  novaSessaoHeader,
  type SessaoHeaderValue,
} from "@/components/forms/SessaoHeader";
import { db } from "@/lib/db/dexie";
import { sincronizarPendentes, houveConflitoDeEdicao } from "@/lib/db/sync";
import { diffObjetos, diffLinhas, registrarEdicao } from "@/lib/db/edicoes";
import { useAuthStore } from "@/lib/auth";
import { N_CAD_RANGE, type LinhaGap, type SessaoMedicao } from "@/types";
import {
  agruparCampos,
  clamparNumero,
  estiloColuna,
  processarEntradaPontoFixo,
} from "@/lib/tabelaCampos";
import { carregarRascunho, limparRascunho, salvarRascunho } from "@/lib/rascunho";

interface RascunhoGap {
  header: SessaoHeaderValue;
  linhas: LinhaGap[];
}

const DIGITOS_INTEIROS_GAP = 3;
const CASAS_DECIMAIS_GAP = 1;

const TOLERANCIA_PADRAO = 0.5;

/**
 * GAP nominal por Nº CAD, conforme o histórico real de medições (MCC's #2 e
 * #3) — o valor vai diminuindo em faixas de Nº CAD, não é o mesmo pra todo
 * mundo. Faixas confirmadas cruzando com sessões históricas já registradas
 * (Nº CAD → GAP nominal, mm):
 * 43: 260,5 · 44–45: 260,0 · 46–50: 259,5 · 51–54: 259,0 · 55–58: 258,5 ·
 * 59–62: 258,0 · 63–66: 257,5 · 67–70: 257,0 · 71–74: 256,5 · 75+: 256,0
 */
const GAP_NOMINAL_POR_N_CAD: Record<number, number> = {
  43: 260.5,
  44: 260.0,
  45: 260.0,
  46: 259.5,
  47: 259.5,
  48: 259.5,
  49: 259.5,
  50: 259.5,
  51: 259.0,
  52: 259.0,
  53: 259.0,
  54: 259.0,
  55: 258.5,
  56: 258.5,
  57: 258.5,
  58: 258.5,
  59: 258.0,
  60: 258.0,
  61: 258.0,
  62: 258.0,
  63: 257.5,
  64: 257.5,
  65: 257.5,
  66: 257.5,
  67: 257.0,
  68: 257.0,
  69: 257.0,
  70: 257.0,
  71: 256.5,
  72: 256.5,
  73: 256.5,
  74: 256.5,
  75: 256.0,
};

function gapNominalPadrao(nCad: number): number {
  // A ficha impressa mostrada vai até o Nº CAD 75 — pros CADs seguintes
  // (76–79), usa o último valor confirmado até a ficha completa ser
  // conferida (é só um ponto de partida, dá pra ajustar linha a linha).
  return GAP_NOMINAL_POR_N_CAD[nCad] ?? 256.0;
}

function linhasIniciais(): LinhaGap[] {
  const linhas: LinhaGap[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({
      nCad: n,
      gapNominal: gapNominalPadrao(n),
      toleranciaMm: TOLERANCIA_PADRAO,
    });
  }
  return linhas;
}

const CAMPOS_MEDIDA: { key: keyof LinhaGap; label: string; grupo: string }[] = [
  { key: "primeiraAcionado", label: "Acionado", grupo: "1ª Medição" },
  { key: "primeiraCentro", label: "Centro", grupo: "1ª Medição" },
  { key: "primeiraNaoAcionado", label: "Não Acionado", grupo: "1ª Medição" },
  { key: "ajusteAcionado", label: "Acionado", grupo: "Ajuste" },
  { key: "ajusteNaoAcionado", label: "Não Acionado", grupo: "Ajuste" },
  { key: "segundaAcionado", label: "Acionado", grupo: "2ª Medição" },
  { key: "segundaCentro", label: "Centro", grupo: "2ª Medição" },
  { key: "segundaNaoAcionado", label: "Não Acionado", grupo: "2ª Medição" },
];

const GRUPOS_CAMPOS_MEDIDA = agruparCampos(CAMPOS_MEDIDA);

// "Ajuste" na ficha de papel é "OK" (sem ajuste) ou uma marcação de nota —
// não é um valor em mm, por isso é texto livre, não número.
const CAMPOS_TEXTO = new Set<keyof LinhaGap>(["ajusteAcionado", "ajusteNaoAcionado"]);

function foraDaTolerancia(
  campo: string,
  valor: number | undefined,
  gapNominal: number,
  tolerancia: number
) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  if (campo.toLowerCase().includes("ajuste")) return false; // ajuste é texto, não medida
  return Math.abs(valor - gapNominal) > tolerancia;
}

function headerDeSessao(s: SessaoMedicao): SessaoHeaderValue {
  return {
    maquina: s.maquina,
    veio: s.veio,
    data: s.data,
    observacao: s.observacao ?? "",
    inspecionadoPor: s.inspecionadoPor ?? "",
    liberadoPor: s.liberadoPor ?? "",
  };
}

function GapForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoId = searchParams.get("sessaoId");
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const chaveRascunho = `gap:${sessaoId ?? "novo"}`;
  const [header, setHeader] = useState<SessaoHeaderValue>(
    () => carregarRascunho<RascunhoGap>(chaveRascunho)?.header ?? novaSessaoHeader()
  );
  const [linhas, setLinhas] = useState<LinhaGap[]>(
    () => carregarRascunho<RascunhoGap>(chaveRascunho)?.linhas ?? linhasIniciais()
  );
  const [carregando, setCarregando] = useState(!!sessaoId);
  const [headerOriginal, setHeaderOriginal] =
    useState<SessaoHeaderValue | null>(null);
  const [sincronizadoEmOriginal, setSincronizadoEmOriginal] = useState<
    string | undefined
  >(undefined);
  const [linhasOriginais, setLinhasOriginais] = useState<LinhaGap[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  // Guarda o texto exatamente como foi digitado em cada campo numérico —
  // não dá pra recalcular isso a partir do número salvo (ver processarEntradaPontoFixo).
  const [textoDigitado, setTextoDigitado] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!sessaoId) return;
    (async () => {
      const sessao = await db.sessoes.get(sessaoId);
      const linhasSalvas = await db.linhasGap
        .where("sessaoId")
        .equals(sessaoId)
        .toArray();
      if (sessao) {
        setHeaderOriginal(headerDeSessao(sessao));
        setSincronizadoEmOriginal(sessao.sincronizadoEm);
      }
      const base = linhasIniciais();
      const mesclado = base.map((l) => {
        const salva = linhasSalvas.find((x) => x.nCad === l.nCad);
        return salva ? { ...l, ...salva } : l;
      });
      setLinhasOriginais(mesclado.map((l) => ({ ...l })));

      // Se tiver um rascunho local (edição que não chegou a ser salva),
      // ele tem prioridade sobre o que está gravado — é o mais recente.
      const rascunho = carregarRascunho<RascunhoGap>(chaveRascunho);
      if (rascunho) {
        setHeader(rascunho.header);
        setLinhas(rascunho.linhas);
      } else if (sessao) {
        setHeader(headerDeSessao(sessao));
        setLinhas(mesclado);
      }
      setTextoDigitado(new Map());
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId]);

  function chaveCelula(nCad: number, campo: keyof LinhaGap) {
    return `${nCad}|${campo}`;
  }

  function handleHeaderChange(novoHeader: SessaoHeaderValue) {
    setHeader(novoHeader);
    salvarRascunho<RascunhoGap>(chaveRascunho, { header: novoHeader, linhas });
  }

  function setValor(nCad: number, campo: keyof LinhaGap, valorTexto: string) {
    if (CAMPOS_TEXTO.has(campo)) {
      const valor = valorTexto === "" ? undefined : valorTexto;
      const novasLinhas = linhas.map((l) =>
        l.nCad === nCad ? { ...l, [campo]: valor } : l
      );
      setLinhas(novasLinhas);
      salvarRascunho<RascunhoGap>(chaveRascunho, { header, linhas: novasLinhas });
      setSalvo(false);
      return;
    }

    const { texto, numero } = processarEntradaPontoFixo(
      valorTexto,
      DIGITOS_INTEIROS_GAP,
      CASAS_DECIMAIS_GAP
    );
    const chave = chaveCelula(nCad, campo);
    setTextoDigitado((prev) => {
      const novo = new Map(prev);
      if (texto === "") novo.delete(chave);
      else novo.set(chave, texto);
      return novo;
    });

    let valor: number | undefined = numero;
    if (typeof valor === "number") {
      valor = clamparNumero(valor, 0, 999.99);
    }
    const novasLinhas = linhas.map((l) =>
      l.nCad === nCad ? { ...l, [campo]: valor } : l
    );
    setLinhas(novasLinhas);
    salvarRascunho<RascunhoGap>(chaveRascunho, { header, linhas: novasLinhas });
    setSalvo(false);
  }

  async function salvar() {
    if (!tecnico) return;
    setSalvando(true);
    try {
      if (sessaoId && headerOriginal) {
        if (await houveConflitoDeEdicao(sessaoId, sincronizadoEmOriginal)) {
          const continuar = window.confirm(
            "Outra pessoa já sincronizou uma versão mais nova desta medição. Se continuar, sua edição vai sobrescrever a dela. Continuar mesmo assim?"
          );
          if (!continuar) {
            setSalvando(false);
            return;
          }
        }
        const mudancasHeader = diffObjetos("header", headerOriginal, header);
        const mudancasLinhas = diffLinhas(
          linhasOriginais,
          linhas,
          (l) => String(l.nCad)
        );

        await db.sessoes.update(sessaoId, {
          maquina: header.maquina,
          veio: header.veio,
          data: header.data,
          observacao: header.observacao,
          inspecionadoPor: header.inspecionadoPor,
          liberadoPor: header.liberadoPor,
        });
        await db.linhasGap.where("sessaoId").equals(sessaoId).delete();
        const linhasPreenchidas = linhas.filter((l) =>
          CAMPOS_MEDIDA.some((c) => l[c.key] !== undefined)
        );
        await db.linhasGap.bulkAdd(
          linhasPreenchidas.map((l) => ({ ...l, sessaoId }))
        );
        await registrarEdicao(
          sessaoId,
          tecnico.id,
          tecnico.nome,
          mudancasHeader,
          mudancasLinhas
        );
      } else {
        const novoId = uuid();
        await db.sessoes.add({
          id: novoId,
          tipoFicha: "GAP",
          maquina: header.maquina,
          veio: header.veio,
          data: header.data,
          tecnicoId: tecnico.id,
          tecnicoNome: tecnico.nome,
          tecnicoMatricula: tecnico.matricula,
          tecnicoFuncao: tecnico.funcao,
          observacao: header.observacao,
          inspecionadoPor: header.inspecionadoPor,
          liberadoPor: header.liberadoPor,
          criadoEm: new Date().toISOString(),
          status: "PENDENTE_SYNC",
        });

        const linhasPreenchidas = linhas.filter((l) =>
          CAMPOS_MEDIDA.some((c) => l[c.key] !== undefined)
        );
        await db.linhasGap.bulkAdd(
          linhasPreenchidas.map((l) => ({ ...l, sessaoId: novoId }))
        );
      }

      limparRascunho(chaveRascunho);
      setSalvo(true);
      sincronizarPendentes().catch(() => {});
      setTimeout(() => router.push("/historico"), 900);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-4">
        <p className="text-sm text-[var(--text-dim)]">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4">
      <Link
        href={sessaoId ? "/admin" : "/"}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--primary-soft)" }}
        >
          <MoveHorizontal
            size={18}
            style={{ color: "var(--primary-strong)" }}
          />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            {sessaoId ? "Editar" : ""} Medição e Ajuste de GAP
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            GAP nominal já vem preenchido conforme a ficha impressa, por Nº CAD
          </p>
        </div>
      </div>

      <SessaoHeader value={header} onChange={handleHeaderChange} />

      <p
        className="rounded-lg px-3 py-2 text-xs"
        style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
      >
        Nas colunas <strong>Ajuste</strong>: escreva <strong>OK</strong> se não precisou
        ajustar, ou anote o que foi feito. Não é campo de número.
      </p>

      <div className="surface scrollbar-thin max-h-[60vh] overflow-auto">
        <table className="table-industrial min-w-full text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="n-cad-header text-left align-bottom">Nº CAD</th>
              <th rowSpan={2} className="align-bottom">GAP nominal</th>
              <th rowSpan={2} className="align-bottom">Tolerância (±mm)</th>
              {GRUPOS_CAMPOS_MEDIDA.map((g) => (
                <th
                  key={g.nome}
                  colSpan={g.campos.length}
                  className="grupo-coluna-titulo"
                  style={estiloColuna(g.indice, true)}
                >
                  {g.nome}
                </th>
              ))}
            </tr>
            <tr>
              {GRUPOS_CAMPOS_MEDIDA.map((g) =>
                g.campos.map((c, i) => (
                  <th key={c.key} style={estiloColuna(g.indice, i === 0)}>
                    {c.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nCad}>
                <td className="n-cad-cell">{l.nCad}</td>
                <td className="text-center font-medium text-[var(--text-dim)]">
                  {l.gapNominal.toFixed(1)}
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-cell"
                    value={
                      textoDigitado.get(chaveCelula(l.nCad, "toleranciaMm")) ??
                      (l.toleranciaMm !== undefined ? String(l.toleranciaMm) : "")
                    }
                    onChange={(e) =>
                      setValor(l.nCad, "toleranciaMm", e.target.value)
                    }
                  />
                </td>
                {GRUPOS_CAMPOS_MEDIDA.map((g) =>
                  g.campos.map((c, i) => {
                    const ehTexto = CAMPOS_TEXTO.has(c.key);
                    const valor = l[c.key] as string | number | undefined;
                    const fora = ehTexto
                      ? false
                      : foraDaTolerancia(
                          c.key,
                          valor as number | undefined,
                          l.gapNominal,
                          l.toleranciaMm
                        );
                    return (
                      <td key={c.key} style={estiloColuna(g.indice, i === 0)}>
                        <input
                          type="text"
                          inputMode={ehTexto ? "text" : "decimal"}
                          placeholder="—"
                          className={`input-cell ${fora ? "input-fora-tolerancia" : ""}`}
                          value={
                            ehTexto
                              ? (valor as string | undefined) ?? ""
                              : textoDigitado.get(chaveCelula(l.nCad, c.key)) ??
                                (valor !== undefined ? String(valor) : "")
                          }
                          onChange={(e) =>
                            setValor(l.nCad, c.key, e.target.value)
                          }
                        />
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={salvar} disabled={salvando} className="btn-primary">
        {salvando
          ? "Salvando..."
          : salvo
            ? "Salvo ✓"
            : sessaoId
              ? "Salvar edição"
              : "Salvar medição"}
      </button>
    </main>
  );
}

export default function GapPage() {
  return (
    <AuthGuard bloquearVisualizador>
      <StatusBar />
      <Suspense fallback={null}>
        <GapForm />
      </Suspense>
    </AuthGuard>
  );
}
