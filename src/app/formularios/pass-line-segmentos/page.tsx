"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import {
  SessaoHeader,
  novaSessaoHeader,
  type SessaoHeaderValue,
} from "@/components/forms/SessaoHeader";
import { db } from "@/lib/db/dexie";
import { sincronizarPendentes } from "@/lib/db/sync";
import { useAuthStore } from "@/lib/auth";
import {
  SEGMENTOS_PADRAO,
  TOLERANCIAS,
  type LadoSegmento,
  type LeituraSegmento,
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

export default function PassLineSegmentosPage() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [leituras, setLeituras] = useState<LeituraSegmento[]>(estadoInicial());
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function setValor(
    segmento: string,
    lado: LadoSegmento,
    posicao: number,
    valorTexto: string
  ) {
    const valor = valorTexto === "" ? undefined : Number(valorTexto);
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
      const sessaoId = uuid();
      await db.sessoes.add({
        id: sessaoId,
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

      const leiturasPreenchidas = leituras.filter((l) => l.valor !== undefined);
      await db.leiturasSegmentos.bulkAdd(
        leiturasPreenchidas.map((l) => ({ ...l, sessaoId }))
      );

      setSalvo(true);
      sincronizarPendentes().catch(() => {});
      setTimeout(() => router.push("/"), 900);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AuthGuard>
      <StatusBar />
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        <h1 className="text-lg font-semibold">
          Medição e Ajuste de Pass-Line dos Segmentos
        </h1>
        <p className="text-sm text-slate-400">
          Tolerância: ±{TOLERANCIA.toFixed(2)}mm. O número de posições por
          segmento varia conforme o veio — use &quot;+ posição&quot; para
          adicionar ou o &quot;×&quot; para remover.
        </p>

        <SessaoHeader value={header} onChange={setHeader} />

        <div className="space-y-4">
          {SEGMENTOS_PADRAO.map((segmento) => (
            <div
              key={segmento}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <h2 className="mb-3 font-medium">Segmento {segmento}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {LADOS.map(({ key: lado, label }) => {
                  const posicoes = leituras
                    .filter((l) => l.segmento === segmento && l.lado === lado)
                    .sort((a, b) => a.posicao - b.posicao);
                  return (
                    <div key={lado}>
                      <div className="mb-2 text-xs text-slate-400">
                        {label}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {posicoes.map((l) => {
                          const fora = foraDaTolerancia(l.valor);
                          return (
                            <div
                              key={l.posicao}
                              className="flex items-center gap-1"
                            >
                              <input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                placeholder={`P${l.posicao}`}
                                className={`input w-20 ${fora ? "input-fora-tolerancia" : ""}`}
                                value={l.valor ?? ""}
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
                                className="text-slate-500 hover:text-red-400"
                                aria-label="Remover posição"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => adicionarPosicao(segmento, lado)}
                          className="rounded-lg border border-dashed border-slate-700 px-3 text-sm text-slate-400"
                        >
                          + posição
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full rounded-lg bg-sky-500 py-3 font-medium text-slate-950 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : salvo ? "Salvo ✓" : "Salvar medição"}
        </button>
      </main>
    </AuthGuard>
  );
}
