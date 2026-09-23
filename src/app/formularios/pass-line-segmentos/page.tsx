"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, Layers, Plus, X } from "lucide-react";
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
import { clamparNumero, formatarValorDigitado, paraValorDigitado } from "@/lib/tabelaCampos";
import {
  SEGMENTOS_PADRAO,
  TOLERANCIAS,
  type LadoSegmento,
  type LeituraSegmento,
  type SessaoMedicao,
} from "@/types";

const TOLERANCIA = TOLERANCIAS.PASS_LINE_SEGMENTOS;
const POSICOES_INICIAIS = 4;
const LADOS: { key: LadoSegmento; label: string }[] = [
  { key: "ACIONADO", label: "Lado Acionado" },
  { key: "NAO_ACIONADO", label: "Lado Não Acionado" },
];

function estadoInicial(): LeituraSegmento[] {
  const leituras: LeituraSegmento[] = [];
  for (const segmento of SEGMENTOS_PADRAO) {
    for (const { key: lado } of LADOS) {
      for (let posicao = 1; posicao <= POSICOES_INICIAIS; posicao++) {
        leituras.push({ segmento, lado, posicao });
      }
    }
  }
  return leituras;
}

function foraDaTolerancia(valor: number | undefined) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  return Math.abs(valor) > TOLERANCIA;
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

function chaveLeitura(l: LeituraSegmento) {
  return `${l.segmento}|${l.lado}|${l.posicao}`;
}

function PassLineSegmentosForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoId = searchParams.get("sessaoId");
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [leituras, setLeituras] = useState<LeituraSegmento[]>(estadoInicial());
  const [carregando, setCarregando] = useState(!!sessaoId);
  const [headerOriginal, setHeaderOriginal] =
    useState<SessaoHeaderValue | null>(null);
  const [sincronizadoEmOriginal, setSincronizadoEmOriginal] = useState<
    string | undefined
  >(undefined);
  const [leiturasOriginais, setLeiturasOriginais] = useState<
    LeituraSegmento[]
  >([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!sessaoId) return;
    (async () => {
      const sessao = await db.sessoes.get(sessaoId);
      const salvas = await db.leiturasSegmentos
        .where("sessaoId")
        .equals(sessaoId)
        .toArray();
      if (sessao) {
        setHeader(headerDeSessao(sessao));
        setHeaderOriginal(headerDeSessao(sessao));
        setSincronizadoEmOriginal(sessao.sincronizadoEm);
      }
      const base = estadoInicial();
      const chavesBase = new Set(base.map(chaveLeitura));
      const extras = salvas.filter((l) => !chavesBase.has(chaveLeitura(l)));
      const mesclado = base.map((l) => {
        const salva = salvas.find(
          (x) =>
            x.segmento === l.segmento &&
            x.lado === l.lado &&
            x.posicao === l.posicao
        );
        return salva ? { ...l, valor: salva.valor } : l;
      });
      const final = [...mesclado, ...extras];
      setLeituras(final);
      setLeiturasOriginais(final.map((l) => ({ ...l })));
      setCarregando(false);
    })();
  }, [sessaoId]);

  function setValor(
    segmento: string,
    lado: LadoSegmento,
    posicao: number,
    valorTexto: string
  ) {
    const valorDigitado = paraValorDigitado(valorTexto, 2);
    const valor =
      valorDigitado === undefined ? undefined : clamparNumero(valorDigitado, -9.99, 9.99);
    setLeituras((prev) =>
      prev.map((l) =>
        l.segmento === segmento && l.lado === lado && l.posicao === posicao
          ? { ...l, valor }
          : l
      )
    );
    setSalvo(false);
  }

  function adicionarPosicao(segmento: string, lado: LadoSegmento) {
    setLeituras((prev) => {
      const existentes = prev.filter(
        (l) => l.segmento === segmento && l.lado === lado
      );
      const proximaPosicao =
        existentes.length > 0
          ? Math.max(...existentes.map((l) => l.posicao)) + 1
          : 1;
      return [...prev, { segmento, lado, posicao: proximaPosicao }];
    });
  }

  function removerPosicao(segmento: string, lado: LadoSegmento, posicao: number) {
    setLeituras((prev) =>
      prev.filter(
        (l) =>
          !(l.segmento === segmento && l.lado === lado && l.posicao === posicao)
      )
    );
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
          leiturasOriginais,
          leituras,
          chaveLeitura
        );

        await db.sessoes.update(sessaoId, {
          maquina: header.maquina,
          veio: header.veio,
          data: header.data,
          observacao: header.observacao,
          inspecionadoPor: header.inspecionadoPor,
          liberadoPor: header.liberadoPor,
        });
        await db.leiturasSegmentos
          .where("sessaoId")
          .equals(sessaoId)
          .delete();
        const leiturasPreenchidas = leituras.filter(
          (l) => l.valor !== undefined
        );
        await db.leiturasSegmentos.bulkAdd(
          leiturasPreenchidas.map((l) => ({ ...l, sessaoId }))
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
          tipoFicha: "PASS_LINE_SEGMENTOS",
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

        const leiturasPreenchidas = leituras.filter(
          (l) => l.valor !== undefined
        );
        await db.leiturasSegmentos.bulkAdd(
          leiturasPreenchidas.map((l) => ({ ...l, sessaoId: novoId }))
        );
      }

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
          <Layers size={18} style={{ color: "var(--primary-strong)" }} />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            {sessaoId ? "Editar" : ""} Pass-Line dos Segmentos
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            Tolerância: ±{TOLERANCIA.toFixed(2)}mm — o número de posições
            varia por segmento e veio
          </p>
        </div>
      </div>

      <SessaoHeader value={header} onChange={setHeader} />

      <div className="grid gap-3 sm:grid-cols-2">
        {SEGMENTOS_PADRAO.map((segmento) => (
          <div key={segmento} className="surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="font-display flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                style={{
                  background: "var(--primary-soft)",
                  color: "var(--primary-strong)",
                }}
              >
                {segmento}
              </span>
              <span className="text-sm font-medium text-[var(--text-dim)]">
                Segmento
              </span>
            </div>
            <div className="space-y-3">
              {LADOS.map(({ key: lado, label }) => {
                const posicoes = leituras
                  .filter((l) => l.segmento === segmento && l.lado === lado)
                  .sort((a, b) => a.posicao - b.posicao);
                return (
                  <div key={lado}>
                    <div className="mb-1.5 text-xs font-medium text-[var(--text-faint)]">
                      {label}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {posicoes.map((l) => {
                        const fora = foraDaTolerancia(l.valor);
                        return (
                          <div
                            key={l.posicao}
                            className="flex items-center overflow-hidden rounded-lg"
                            style={{
                              border: "1px solid var(--border)",
                              background: "var(--surface-raised)",
                            }}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={`P${l.posicao}`}
                              className={`input-cell !w-16 !rounded-none !border-0 !bg-transparent text-center ${fora ? "input-fora-tolerancia" : ""}`}
                              value={formatarValorDigitado(l.valor, 2)}
                              onChange={(e) =>
                                setValor(
                                  segmento,
                                  lado,
                                  l.posicao,
                                  e.target.value
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removerPosicao(segmento, lado, l.posicao)
                              }
                              className="flex h-full items-center px-1.5 text-[var(--text-faint)] hover:text-[var(--danger)]"
                              aria-label="Remover posição"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => adicionarPosicao(segmento, lado)}
                        className="flex items-center gap-1 rounded-lg border border-dashed px-2 py-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--primary-strong)]"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        <Plus size={12} /> posição
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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

export default function PassLineSegmentosPage() {
  return (
    <AuthGuard bloquearVisualizador>
      <StatusBar />
      <Suspense fallback={null}>
        <PassLineSegmentosForm />
      </Suspense>
    </AuthGuard>
  );
}
