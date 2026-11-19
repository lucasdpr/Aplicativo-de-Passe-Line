"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, Layers } from "lucide-react";
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
  carregarRascunho,
  chaveRascunho as criarChaveRascunho,
  infoRascunho,
  limparRascunho,
  limparRascunhosAntigos,
  salvarRascunho,
} from "@/lib/rascunho";
import { verificarDuplicidade } from "@/lib/duplicidade";
import {
  JUNCOES_MCC4,
  POSICAO_ENTRADA,
  POSICAO_SAIDA,
  SEGMENTO_BENDER,
  TOLERANCIA_DENTE_MCC4,
  calcularDente,
  denteFora,
} from "@/lib/passLineMcc4";
import {
  EMENDAS_MCC23,
  LADOS_MCC23,
  TOLERANCIA_SEGMENTOS_MCC23,
  leituraForaMcc23,
  leiturasIniciaisMcc23,
  posicaoMcc23,
  rotuloRolo,
  type EmendaMcc23,
} from "@/lib/passLineMcc23";
import { AvisoRascunho } from "@/components/forms/AvisoRascunho";
import {
  SEGMENTOS_MCC4,
  type LadoSegmento,
  type LeituraSegmento,
  type Maquina,
  type SessaoMedicao,
} from "@/types";

interface RascunhoPassLineSegmentos {
  header: SessaoHeaderValue;
  leituras: LeituraSegmento[];
}

const LADOS: { key: LadoSegmento; label: string }[] = [
  { key: "ACIONADO", label: "Lado Acionado" },
  { key: "NAO_ACIONADO", label: "Lado Não Acionado" },
];

function estadoInicial(maquina: Maquina): LeituraSegmento[] {
  // MCC2/MCC3: a folha é por emenda, com dois desenhos por lado.
  if (maquina !== "MCC4") return leiturasIniciaisMcc23();
  // MCC4: Bender só tem saída; cada segmento 1–17 tem entrada (1) e saída (2).
  const leituras: LeituraSegmento[] = [];
  for (const { key: lado } of LADOS) {
    leituras.push({ segmento: SEGMENTO_BENDER, lado, posicao: POSICAO_SAIDA });
  }
  for (const segmento of SEGMENTOS_MCC4) {
    for (const { key: lado } of LADOS) {
      for (const posicao of [POSICAO_ENTRADA, POSICAO_SAIDA]) {
        leituras.push({ segmento, lado, posicao });
      }
    }
  }
  return leituras;
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
  const chaveRascunho = criarChaveRascunho("pass-line-segmentos", tecnico?.id, sessaoId);
  const [header, setHeader] = useState<SessaoHeaderValue>(
    () =>
      carregarRascunho<RascunhoPassLineSegmentos>(chaveRascunho)?.header ??
      novaSessaoHeader()
  );
  const [leituras, setLeituras] = useState<LeituraSegmento[]>(() => {
    const rascunho = carregarRascunho<RascunhoPassLineSegmentos>(chaveRascunho);
    return rascunho?.leituras ?? estadoInicial(rascunho?.header.maquina ?? "MCC2");
  });
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
  // Rascunho que já existia quando a tela abriu — mostra o aviso.
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(() => {
    limparRascunhosAntigos();
    return infoRascunho(chaveRascunho);
  });

  useEffect(() => {
    if (!sessaoId) return;
    (async () => {
      const sessao = await db.sessoes.get(sessaoId);
      const salvas = await db.leiturasSegmentos
        .where("sessaoId")
        .equals(sessaoId)
        .toArray();
      if (sessao) {
        setHeaderOriginal(headerDeSessao(sessao));
        setSincronizadoEmOriginal(sessao.sincronizadoEm);
      }
      const base = estadoInicial(sessao?.maquina ?? "MCC2");
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
      setLeiturasOriginais(final.map((l) => ({ ...l })));

      const rascunho = carregarRascunho<RascunhoPassLineSegmentos>(chaveRascunho);
      if (rascunho) {
        setHeader(rascunho.header);
        setLeituras(rascunho.leituras);
      } else if (sessao) {
        setHeader(headerDeSessao(sessao));
        setLeituras(final);
      }
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId]);

  // Sessão nova: a lista de segmentos depende da máquina (MCC4 é diferente
  // das demais) — reseta as leituras se o técnico trocar a máquina antes de
  // preencher. Não mexe numa sessão que já está sendo editada.
  function handleHeaderChange(novoHeader: SessaoHeaderValue) {
    let novasLeituras = leituras;
    if (!sessaoId && novoHeader.maquina !== header.maquina) {
      novasLeituras = estadoInicial(novoHeader.maquina);
      setLeituras(novasLeituras);
      setLeiturasOriginais(novasLeituras.map((l) => ({ ...l })));
    }
    setHeader(novoHeader);
    salvarRascunho<RascunhoPassLineSegmentos>(chaveRascunho, {
      header: novoHeader,
      leituras: novasLeituras,
    });
  }

  function setValor(
    segmento: string,
    lado: LadoSegmento,
    posicao: number,
    valorTexto: string
  ) {
    const valorDigitado = paraValorDigitado(valorTexto, 2);
    const valor =
      valorDigitado === undefined ? undefined : clamparNumero(valorDigitado, -9.99, 9.99);
    const novasLeituras = leituras.map((l) =>
      l.segmento === segmento && l.lado === lado && l.posicao === posicao
        ? { ...l, valor }
        : l
    );
    setLeituras(novasLeituras);
    salvarRascunho<RascunhoPassLineSegmentos>(chaveRascunho, { header, leituras: novasLeituras });
    setSalvo(false);
  }

  function descartarRascunho() {
    limparRascunho(chaveRascunho);
    setRascunhoRecuperado(null);
    if (sessaoId && headerOriginal) {
      setHeader(headerOriginal);
      setLeituras(leiturasOriginais.map((l) => ({ ...l })));
    } else {
      const novo = novaSessaoHeader();
      setHeader(novo);
      setLeituras(estadoInicial(novo.maquina));
    }
    setSalvo(false);
  }

  async function salvar() {
    if (!tecnico) return;
    setSalvando(true);
    try {
      const aviso = await verificarDuplicidade("PASS_LINE_SEGMENTOS", header, leituras, sessaoId);
      if (aviso && !window.confirm(aviso)) {
        setSalvando(false);
        return;
      }
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
            {header.maquina === "MCC4"
              ? `Tolerância do dente (saída de um segmento x entrada do seguinte): ±${TOLERANCIA_DENTE_MCC4.toFixed(2)}mm`
              : `Igual à folha: por emenda, dois desenhos por lado. Tolerância: ±${TOLERANCIA_SEGMENTOS_MCC23.toFixed(2)}mm por leitura`}
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

      <SessaoHeader value={header} onChange={handleHeaderChange} />

      {header.maquina === "MCC4" ? (
        <TabelaMcc4 leituras={leituras} onValor={setValor} />
      ) : (
        <FolhaMcc23 leituras={leituras} onValor={setValor} />
      )}

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

/** Igual à planilha da MCC #4: uma linha por emenda, saída x entrada, e o dente. */
function TabelaMcc4({
  leituras,
  onValor,
}: {
  leituras: LeituraSegmento[];
  onValor: (segmento: string, lado: LadoSegmento, posicao: number, texto: string) => void;
}) {
  const valor = (segmento: string, lado: LadoSegmento, posicao: number) =>
    leituras.find((l) => l.segmento === segmento && l.lado === lado && l.posicao === posicao)?.valor;
  const nome = (seg: string) => (seg === SEGMENTO_BENDER ? "Bender" : `Seg. ${seg}`);
  const ordem: { key: LadoSegmento; label: string }[] = [
    { key: "NAO_ACIONADO", label: "Lado não acionado" },
    { key: "ACIONADO", label: "Lado acionado" },
  ];
  return (
    <div className="surface overflow-x-auto p-0">
      <p className="p-3 text-xs text-[var(--text-dim)]">
        Em cada linha: a <b>saída</b> do segmento de cima e a <b>entrada</b> do de baixo. O
        resultado (dente) é a diferença entre as duas, calculada sozinha.
      </p>
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className="p-2 text-left font-medium text-[var(--text-dim)]">
              Emenda
            </th>
            {ordem.map(({ key, label }) => (
              <th
                key={key}
                colSpan={3}
                className="border-l p-2 font-semibold text-[var(--text-dim)]"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {label}
              </th>
            ))}
          </tr>
          <tr>
            {ordem.map(({ key }) => (
              <Fragment key={key}>
                <th className="border-l p-1.5 font-medium text-[var(--text-faint)]" style={{ borderColor: "var(--border-strong)" }}>
                  Saída (cima)
                </th>
                <th className="p-1.5 font-medium text-[var(--text-faint)]">Entrada (baixo)</th>
                <th className="p-1.5 font-medium text-[var(--text-faint)]">Dente</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {JUNCOES_MCC4.map((j) => (
            <tr key={j.indice} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="p-2 font-medium whitespace-nowrap">{j.rotulo}</td>
              {ordem.map(({ key: lado }) => {
                const saida = valor(j.de, lado, POSICAO_SAIDA);
                const entrada = valor(j.para, lado, POSICAO_ENTRADA);
                const dente = calcularDente(saida, entrada);
                const fora = denteFora(dente);
                return (
                  <Fragment key={lado}>
                    <td className="border-l p-1" style={{ borderColor: "var(--border-strong)" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${nome(j.de)} saída ${lado}`}
                        placeholder={nome(j.de)}
                        className="input-cell !w-20 text-center"
                        value={formatarValorDigitado(saida, 2)}
                        onChange={(e) => onValor(j.de, lado, POSICAO_SAIDA, e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${nome(j.para)} entrada ${lado}`}
                        placeholder={nome(j.para)}
                        className="input-cell !w-20 text-center"
                        value={formatarValorDigitado(entrada, 2)}
                        onChange={(e) => onValor(j.para, lado, POSICAO_ENTRADA, e.target.value)}
                      />
                    </td>
                    <td
                      className="p-1 text-center font-semibold"
                      style={{ color: fora ? "#fca5a5" : "var(--text-dim)", background: fora ? "var(--danger-soft)" : undefined }}
                    >
                      {dente === undefined ? "—" : dente.toFixed(2).replace(".", ",")}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * MCC2/MCC3, igual ao papel: cada emenda tem, em cada lado, dois desenhos com
 * um rolo por linha. A seta marca a mesma linha que a folha marca.
 */
function FolhaMcc23({
  leituras,
  onValor,
}: {
  leituras: LeituraSegmento[];
  onValor: (segmento: string, lado: LadoSegmento, posicao: number, texto: string) => void;
}) {
  const valor = (segmento: string, lado: LadoSegmento, posicao: number) =>
    leituras.find((l) => l.segmento === segmento && l.lado === lado && l.posicao === posicao)?.valor;
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-dim)]">
        Escreva a leitura na linha do rolo, como no papel (S = segmento, R = rolo; ▸ = linha da
        seta). Linha vazia fica em branco. Leitura acima de ±
        {TOLERANCIA_SEGMENTOS_MCC23.toFixed(2).replace(".", ",")} mm fica vermelha.
      </p>
      {EMENDAS_MCC23.map((emenda) => (
        <EmendaMcc23Cartao key={emenda.chave} emenda={emenda} valor={valor} onValor={onValor} />
      ))}
    </div>
  );
}

function EmendaMcc23Cartao({
  emenda,
  valor,
  onValor,
}: {
  emenda: EmendaMcc23;
  valor: (segmento: string, lado: LadoSegmento, posicao: number) => number | undefined;
  onValor: (segmento: string, lado: LadoSegmento, posicao: number, texto: string) => void;
}) {
  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="font-display rounded-lg px-2 py-1 text-xs font-bold"
          style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}
        >
          {emenda.rotulo}
        </span>
        <span className="text-sm font-medium text-[var(--text-dim)]">Emenda</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {LADOS_MCC23.map(({ key: lado, label }) => (
          <div key={lado}>
            <div className="mb-1.5 text-xs font-semibold text-[var(--text-dim)]">{label}</div>
            <div className="grid grid-cols-2 gap-2">
              {emenda.desenhos.map((rolos, i) => {
                const desenho = (i + 1) as 1 | 2;
                return (
                  <div
                    key={desenho}
                    className="rounded-lg border p-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="mb-1 text-[0.7rem] font-medium text-[var(--text-faint)]">
                      {desenho}º desenho
                    </div>
                    <div className="space-y-1">
                      {rolos.map((rolo, linha) => {
                        const posicao = posicaoMcc23(desenho, linha);
                        const v = valor(emenda.chave, lado, posicao);
                        const fora = leituraForaMcc23(v);
                        const seta = emenda.setas[i] === linha;
                        return (
                          <label key={posicao} className="flex items-center gap-1.5">
                            <span
                              className="min-w-0 flex-1 whitespace-nowrap font-mono text-[0.72rem] text-[var(--text-dim)]"
                              title={`${rotuloRolo(rolo)}${seta ? " (linha da seta no papel)" : ""}`}
                            >
                              {seta ? "▸" : "\u00a0"} S{rolo.segmento} · R{rolo.rolo}
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Emenda ${emenda.rotulo}, ${label}, ${desenho}º desenho, ${rotuloRolo(rolo)}`}
                              placeholder="—"
                              className={`input-cell !w-[4.25rem] shrink-0 text-center ${fora ? "input-fora-tolerancia" : ""}`}
                              value={formatarValorDigitado(v, 2)}
                              onChange={(e) => onValor(emenda.chave, lado, posicao, e.target.value)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
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
