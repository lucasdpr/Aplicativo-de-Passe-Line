"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
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
import { processarEntradaPontoFixo } from "@/lib/tabelaCampos";
import {
  carregarRascunho,
  chaveRascunho as criarChaveRascunho,
  infoRascunho,
  limparRascunho,
  limparRascunhosAntigos,
  salvarRascunho,
} from "@/lib/rascunho";
import { verificarDuplicidade } from "@/lib/duplicidade";
import { AvisoRascunho } from "@/components/forms/AvisoRascunho";
import {
  GAP_MCC4,
  foraGapMcc4,
  type LadoSegmento,
  type LinhaGapMcc4,
  type PontoGapMcc4,
  type SessaoMedicao,
} from "@/types";

interface RascunhoGapMcc4 {
  header: SessaoHeaderValue;
  linhas: LinhaGapMcc4[];
}

type Campo = "medicao" | "ajuste";

const PONTOS: { ponto: PontoGapMcc4; label: string }[] = [
  { ponto: "ENTRADA", label: "ENTRADA" },
  { ponto: "SAIDA", label: "SAÍDA" },
];
const LADOS: { lado: LadoSegmento; label: string }[] = [
  { lado: "ACIONADO", label: "Acionado" },
  { lado: "NAO_ACIONADO", label: "Não acionado" },
];
const SEGMENTOS = Array.from({ length: GAP_MCC4.segmentos }, (_, i) => i + 1);

function headerInicial(): SessaoHeaderValue {
  return { ...novaSessaoHeader(), maquina: "MCC4", veio: "G" };
}

function estadoInicial(): LinhaGapMcc4[] {
  return SEGMENTOS.flatMap((segmento) =>
    PONTOS.flatMap(({ ponto }) => LADOS.map(({ lado }) => ({ segmento, ponto, lado })))
  );
}

function chave(l: { segmento: number; ponto: PontoGapMcc4; lado: LadoSegmento }) {
  return `${l.segmento}|${l.ponto}|${l.lado}`;
}

function preenchida(l: LinhaGapMcc4) {
  return l.aberto === true || l.medicao !== undefined || l.ajuste !== undefined;
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

function GapMcc4Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoId = searchParams.get("sessaoId");
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const chaveRascunho = criarChaveRascunho("gap-mcc4", tecnico?.id, sessaoId);
  const [header, setHeader] = useState<SessaoHeaderValue>(
    () => carregarRascunho<RascunhoGapMcc4>(chaveRascunho)?.header ?? headerInicial()
  );
  const [linhas, setLinhas] = useState<LinhaGapMcc4[]>(
    () => carregarRascunho<RascunhoGapMcc4>(chaveRascunho)?.linhas ?? estadoInicial()
  );
  // Texto exato digitado por célula: "255" e "255,0" são o mesmo número.
  const [textoDigitado, setTextoDigitado] = useState<Map<string, string>>(new Map());
  const [carregando, setCarregando] = useState(!!sessaoId);
  const [headerOriginal, setHeaderOriginal] = useState<SessaoHeaderValue | null>(null);
  const [sincronizadoEmOriginal, setSincronizadoEmOriginal] = useState<string | undefined>();
  const [linhasOriginais, setLinhasOriginais] = useState<LinhaGapMcc4[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(() => {
    limparRascunhosAntigos();
    return infoRascunho(chaveRascunho);
  });

  useEffect(() => {
    if (!sessaoId) return;
    (async () => {
      const sessao = await db.sessoes.get(sessaoId);
      const salvas = await db.linhasGapMcc4.where("sessaoId").equals(sessaoId).toArray();
      const porChave = new Map(salvas.map((l) => [chave(l), l]));
      const mescladas = estadoInicial().map((l) => {
        const s = porChave.get(chave(l));
        return s
          ? {
              ...l,
              medicao: s.medicao ?? undefined,
              ajuste: s.ajuste ?? undefined,
              aberto: s.aberto || undefined,
            }
          : l;
      });
      setLinhasOriginais(mescladas.map((l) => ({ ...l })));
      if (sessao) {
        setHeaderOriginal(headerDeSessao(sessao));
        setSincronizadoEmOriginal(sessao.sincronizadoEm);
      }
      const rascunho = carregarRascunho<RascunhoGapMcc4>(chaveRascunho);
      if (rascunho) {
        setHeader(rascunho.header);
        setLinhas(rascunho.linhas);
      } else if (sessao) {
        setHeader(headerDeSessao(sessao));
        setLinhas(mescladas);
      }
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId]);

  function gravar(novasLinhas: LinhaGapMcc4[], novoHeader = header) {
    setLinhas(novasLinhas);
    salvarRascunho<RascunhoGapMcc4>(chaveRascunho, { header: novoHeader, linhas: novasLinhas });
    setSalvo(false);
  }

  function handleHeaderChange(novoHeader: SessaoHeaderValue) {
    setHeader(novoHeader);
    salvarRascunho<RascunhoGapMcc4>(chaveRascunho, { header: novoHeader, linhas });
  }

  function setValor(alvo: LinhaGapMcc4, campo: Campo, valorTexto: string) {
    const { texto, numero } = processarEntradaPontoFixo(valorTexto, 3, 2);
    const k = `${chave(alvo)}|${campo}`;
    setTextoDigitado((prev) => {
      const novo = new Map(prev);
      if (texto === "") novo.delete(k);
      else novo.set(k, texto);
      return novo;
    });
    const valor = numero === undefined || Number.isNaN(numero) ? undefined : Math.min(999.99, Math.max(0, numero));
    gravar(linhas.map((l) => (chave(l) === chave(alvo) ? { ...l, [campo]: valor } : l)));
  }

  function alternarAberto(alvo: LinhaGapMcc4) {
    gravar(
      linhas.map((l) =>
        chave(l) === chave(alvo)
          ? l.aberto
            ? { ...l, aberto: undefined }
            : { ...l, aberto: true, medicao: undefined, ajuste: undefined }
          : l
      )
    );
  }

  function textoCelula(l: LinhaGapMcc4, campo: Campo) {
    const digitado = textoDigitado.get(`${chave(l)}|${campo}`);
    if (digitado !== undefined) return digitado;
    const v = l[campo];
    return v === undefined ? "" : v.toFixed(2);
  }

  function descartarRascunho() {
    limparRascunho(chaveRascunho);
    setRascunhoRecuperado(null);
    setTextoDigitado(new Map());
    if (sessaoId && headerOriginal) {
      setHeader(headerOriginal);
      setLinhas(linhasOriginais.map((l) => ({ ...l })));
    } else {
      setHeader(headerInicial());
      setLinhas(estadoInicial());
    }
    setSalvo(false);
  }

  async function salvar() {
    if (!tecnico) return;
    setSalvando(true);
    try {
      const paraGravar = linhas.filter(preenchida).map((l) => ({ ...l, aberto: l.aberto === true }));
      if (paraGravar.length === 0) {
        alert("Preencha pelo menos uma medição antes de salvar.");
        return;
      }
      const aviso = await verificarDuplicidade("GAP_MCC4", header, paraGravar, sessaoId);
      if (aviso && !window.confirm(aviso)) return;

      if (sessaoId && headerOriginal) {
        if (await houveConflitoDeEdicao(sessaoId, sincronizadoEmOriginal)) {
          const continuar = window.confirm(
            "Outra pessoa já sincronizou uma versão mais nova desta medição. Se continuar, sua edição vai sobrescrever a dela. Continuar mesmo assim?"
          );
          if (!continuar) return;
        }
        const mudancasHeader = diffObjetos("header", headerOriginal, header);
        const mudancasLinhas = diffLinhas(linhasOriginais, linhas, chave);
        await db.sessoes.update(sessaoId, {
          maquina: header.maquina,
          veio: header.veio,
          data: header.data,
          observacao: header.observacao,
          inspecionadoPor: header.inspecionadoPor,
          liberadoPor: header.liberadoPor,
        });
        await db.linhasGapMcc4.where("sessaoId").equals(sessaoId).delete();
        await db.linhasGapMcc4.bulkAdd(paraGravar.map((l) => ({ ...l, sessaoId })));
        await registrarEdicao(sessaoId, tecnico.id, tecnico.nome, mudancasHeader, mudancasLinhas);
      } else {
        const novoId = uuid();
        await db.sessoes.add({
          id: novoId,
          tipoFicha: "GAP_MCC4",
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
        await db.linhasGapMcc4.bulkAdd(paraGravar.map((l) => ({ ...l, sessaoId: novoId })));
      }

      limparRascunho(chaveRascunho);
      setRascunhoRecuperado(null);
      setSalvo(true);
      sincronizarPendentes().catch(() => {});
      setTimeout(() => router.push("/historico"), 900);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <p className="text-sm text-[var(--text-dim)]">Carregando...</p>
      </main>
    );
  }

  const porChave = new Map(linhas.map((l) => [chave(l), l]));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
      <Link
        href={sessaoId ? "/admin" : "/"}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-steel-soft)" }}
        >
          <MoveHorizontal size={18} style={{ color: "var(--accent-steel)" }} />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            {sessaoId ? "Editar " : ""}Medição e Ajuste de GAP — MCC4
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            GAP nominal {GAP_MCC4.nominal.toFixed(2).replace(".", ",")} mm · tolerância ±
            {GAP_MCC4.tolerancia.toFixed(2).replace(".", ",")} mm
          </p>
        </div>
      </div>

      {rascunhoRecuperado && (
        <AvisoRascunho
          salvoEm={rascunhoRecuperado.salvoEm}
          dataMedicao={header.data}
          editando={!!sessaoId}
          onDescartar={descartarRascunho}
        />
      )}

      <SessaoHeader value={header} onChange={handleHeaderChange} maquinas={["MCC4"]} />

      <div className="surface p-3 text-xs text-[var(--text-dim)]">
        Digite só os números: os 3 primeiros são os milímetros e o resto vira decimal
        (&quot;25510&quot; = 255,10). <b>Ajuste</b> é a medida depois de ajustar; deixe vazio
        se não precisou. Use <b>AB</b> quando o segmento estiver aberto.
      </div>

      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="p-2 text-left font-medium text-[var(--text-dim)]">
                Segmento
              </th>
              {PONTOS.map(({ ponto, label }) => (
                <th
                  key={ponto}
                  colSpan={4}
                  className="border-l p-2 font-semibold tracking-wide text-[var(--text-dim)]"
                  style={{ borderColor: "var(--border-strong)" }}
                >
                  {label}
                </th>
              ))}
            </tr>
            <tr>
              {PONTOS.map(({ ponto }) =>
                LADOS.map(({ lado, label }, i) => (
                  <Fragment key={`${ponto}${lado}`}>
                    <th
                      className={`p-1.5 font-medium text-[var(--text-faint)] ${i === 0 ? "border-l" : ""}`}
                      style={{ borderColor: "var(--border-strong)" }}
                    >
                      Medição {label.toLowerCase()}
                    </th>
                    <th className="p-1.5 font-medium text-[var(--text-faint)]">Ajuste</th>
                  </Fragment>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {SEGMENTOS.map((segmento) => (
              <tr key={segmento} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="p-2 font-medium whitespace-nowrap">Segmento {segmento}</td>
                {PONTOS.map(({ ponto }) =>
                  LADOS.map(({ lado }, i) => {
                    const l = porChave.get(chave({ segmento, ponto, lado }))!;
                    return (
                      <Fragment key={`${ponto}${lado}`}>
                        <td
                          className={`p-1 ${i === 0 ? "border-l" : ""}`}
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          <div className="flex items-center gap-1">
                            {l.aberto ? (
                              <span
                                className="input-cell input-fora-tolerancia flex items-center justify-center font-semibold"
                                style={{ minWidth: "4.5rem" }}
                              >
                                ABERTO
                              </span>
                            ) : (
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`Segmento ${segmento} ${ponto} ${lado} medição`}
                                className={`input-cell !w-[4.5rem] text-center ${foraGapMcc4(l.medicao) ? "input-fora-tolerancia" : ""}`}
                                value={textoCelula(l, "medicao")}
                                onChange={(e) => setValor(l, "medicao", e.target.value)}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => alternarAberto(l)}
                              title={l.aberto ? "Desmarcar aberto" : "Marcar como aberto"}
                              className="rounded px-1 py-0.5 text-[0.6rem] font-semibold"
                              style={{
                                background: l.aberto ? "var(--danger-soft)" : "var(--surface-raised)",
                                color: l.aberto ? "#fca5a5" : "var(--text-faint)",
                              }}
                            >
                              AB
                            </button>
                          </div>
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={l.aberto}
                            aria-label={`Segmento ${segmento} ${ponto} ${lado} ajuste`}
                            className={`input-cell !w-[4.5rem] text-center disabled:opacity-30 ${foraGapMcc4(l.ajuste) ? "input-fora-tolerancia" : ""}`}
                            value={l.aberto ? "" : textoCelula(l, "ajuste")}
                            onChange={(e) => setValor(l, "ajuste", e.target.value)}
                          />
                        </td>
                      </Fragment>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={salvar} disabled={salvando} className="btn-primary">
        {salvando ? "Salvando..." : salvo ? "Salvo ✓" : sessaoId ? "Salvar edição" : "Salvar medição"}
      </button>
    </main>
  );
}

export default function GapMcc4Page() {
  return (
    <AuthGuard bloquearVisualizador>
      <StatusBar />
      <Suspense fallback={null}>
        <GapMcc4Form />
      </Suspense>
    </AuthGuard>
  );
}
