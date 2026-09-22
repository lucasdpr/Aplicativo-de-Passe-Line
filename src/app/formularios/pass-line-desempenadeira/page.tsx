"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, Ruler } from "lucide-react";
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
import { agruparCampos, clamparNumero, estiloColuna } from "@/lib/tabelaCampos";
import {
  N_CAD_RANGE,
  TOLERANCIAS,
  type LinhaPassLineDesempenadeira,
  type SessaoMedicao,
} from "@/types";

const TOLERANCIA = TOLERANCIAS.PASS_LINE_DESEMPENADEIRA;

function linhasIniciais(): LinhaPassLineDesempenadeira[] {
  const linhas: LinhaPassLineDesempenadeira[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({ nCad: n });
  }
  return linhas;
}

const CAMPOS: { key: keyof LinhaPassLineDesempenadeira; label: string; grupo: string }[] = [
  { key: "oesteMedida", label: "Medida", grupo: "Oeste" },
  { key: "oesteAcionado", label: "Acionado", grupo: "Oeste" },
  { key: "oesteAjuste", label: "Ajuste", grupo: "Oeste" },
  { key: "lesteMedida", label: "Medida", grupo: "Leste" },
  { key: "lesteAcionado", label: "Acionado", grupo: "Leste" },
  { key: "lesteAjuste", label: "Ajuste", grupo: "Leste" },
];

const GRUPOS_CAMPOS = agruparCampos(CAMPOS);

function foraDaTolerancia(campo: string, valor: number | undefined) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  if (!campo.toLowerCase().includes("ajuste")) return false;
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

function PassLineDesempenadeiraForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoId = searchParams.get("sessaoId");
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [linhas, setLinhas] = useState<LinhaPassLineDesempenadeira[]>(
    linhasIniciais()
  );
  const [carregando, setCarregando] = useState(!!sessaoId);
  const [headerOriginal, setHeaderOriginal] =
    useState<SessaoHeaderValue | null>(null);
  const [sincronizadoEmOriginal, setSincronizadoEmOriginal] = useState<
    string | undefined
  >(undefined);
  const [linhasOriginais, setLinhasOriginais] = useState<
    LinhaPassLineDesempenadeira[]
  >([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!sessaoId) return;
    (async () => {
      const sessao = await db.sessoes.get(sessaoId);
      const linhasSalvas = await db.linhasPassLineDesempenadeira
        .where("sessaoId")
        .equals(sessaoId)
        .toArray();
      if (sessao) {
        setHeader(headerDeSessao(sessao));
        setHeaderOriginal(headerDeSessao(sessao));
        setSincronizadoEmOriginal(sessao.sincronizadoEm);
      }
      const base = linhasIniciais();
      const mesclado = base.map((l) => {
        const salva = linhasSalvas.find((x) => x.nCad === l.nCad);
        return salva ? { ...l, ...salva } : l;
      });
      setLinhas(mesclado);
      setLinhasOriginais(mesclado.map((l) => ({ ...l })));
      setCarregando(false);
    })();
  }, [sessaoId]);

  function setValor(
    nCad: number,
    campo: keyof LinhaPassLineDesempenadeira,
    valorTexto: string
  ) {
    let valor: number | undefined = valorTexto === "" ? undefined : Number(valorTexto);
    if (valor !== undefined) {
      const ehAjuste = campo.toLowerCase().includes("ajuste");
      valor = clamparNumero(valor, ehAjuste ? -9.99 : 0, ehAjuste ? 9.99 : 999.99);
    }
    setLinhas((prev) =>
      prev.map((l) => (l.nCad === nCad ? { ...l, [campo]: valor } : l))
    );
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
        const mudancasHeader = diffObjetos(
          "header",
          headerOriginal,
          header
        );
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
        await db.linhasPassLineDesempenadeira
          .where("sessaoId")
          .equals(sessaoId)
          .delete();
        const linhasPreenchidas = linhas.filter((l) =>
          CAMPOS.some((c) => l[c.key] !== undefined)
        );
        await db.linhasPassLineDesempenadeira.bulkAdd(
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
          tipoFicha: "PASS_LINE_DESEMPENADEIRA",
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
          CAMPOS.some((c) => l[c.key] !== undefined)
        );
        await db.linhasPassLineDesempenadeira.bulkAdd(
          linhasPreenchidas.map((l) => ({ ...l, sessaoId: novoId }))
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
          <Ruler size={18} style={{ color: "var(--primary-strong)" }} />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            {sessaoId ? "Editar" : ""} Pass-Line (Desempenadeira)
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            Tolerância entre rolo e régua: ±{TOLERANCIA.toFixed(2)}mm
          </p>
        </div>
      </div>

      <SessaoHeader value={header} onChange={setHeader} />

      <div className="surface scrollbar-thin max-h-[60vh] overflow-auto">
        <table className="table-industrial min-w-full text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="n-cad-header text-left align-bottom">Nº CAD</th>
              {GRUPOS_CAMPOS.map((g) => (
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
              {GRUPOS_CAMPOS.map((g) =>
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
                {GRUPOS_CAMPOS.map((g) =>
                  g.campos.map((c, i) => {
                    const valor = l[c.key] as number | undefined;
                    const fora = foraDaTolerancia(c.key, valor);
                    return (
                      <td key={c.key} style={estiloColuna(g.indice, i === 0)}>
                        <input
                          type="number"
                          step="0.01"
                          min={c.key.toLowerCase().includes("ajuste") ? -9.99 : 0}
                          max={c.key.toLowerCase().includes("ajuste") ? 9.99 : 999.99}
                          inputMode="decimal"
                          placeholder="—"
                          className={`input-cell ${fora ? "input-fora-tolerancia" : ""}`}
                          value={valor ?? ""}
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

export default function PassLineDesempenadeiraPage() {
  return (
    <AuthGuard bloquearVisualizador>
      <StatusBar />
      <Suspense fallback={null}>
        <PassLineDesempenadeiraForm />
      </Suspense>
    </AuthGuard>
  );
}
