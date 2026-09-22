"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
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
import { N_CAD_RANGE, type LinhaEmpenoDesgaste, type SessaoMedicao } from "@/types";
import { agruparCampos, clamparNumero, estiloColuna } from "@/lib/tabelaCampos";

function linhasIniciais(): LinhaEmpenoDesgaste[] {
  const linhas: LinhaEmpenoDesgaste[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({ nCad: n });
  }
  return linhas;
}

const CAMPOS_EMPENO: { key: keyof LinhaEmpenoDesgaste; label: string; grupo: string }[] = [
  { key: "empenoSuperior", label: "Superior", grupo: "Empeno" },
  { key: "empenoInferior", label: "Inferior", grupo: "Empeno" },
  { key: "empenoPar", label: "Par", grupo: "Empeno" },
];

const CAMPOS_DESGASTE: { key: keyof LinhaEmpenoDesgaste; label: string; grupo: string }[] = [
  { key: "desgasteSuperior", label: "Superior", grupo: "Desgaste" },
  { key: "desgasteInferior", label: "Inferior", grupo: "Desgaste" },
  { key: "desgastePar", label: "Par", grupo: "Desgaste" },
];

const CAMPOS = [...CAMPOS_EMPENO, ...CAMPOS_DESGASTE];
const CAMPOS_TEXTO = new Set(CAMPOS_EMPENO.map((c) => c.key));
const GRUPOS_CAMPOS = agruparCampos(CAMPOS);

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

function EmpenoDesgasteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoId = searchParams.get("sessaoId");
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [linhas, setLinhas] = useState<LinhaEmpenoDesgaste[]>(
    linhasIniciais()
  );
  const [carregando, setCarregando] = useState(!!sessaoId);
  const [headerOriginal, setHeaderOriginal] =
    useState<SessaoHeaderValue | null>(null);
  const [sincronizadoEmOriginal, setSincronizadoEmOriginal] = useState<
    string | undefined
  >(undefined);
  const [linhasOriginais, setLinhasOriginais] = useState<
    LinhaEmpenoDesgaste[]
  >([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!sessaoId) return;
    (async () => {
      const sessao = await db.sessoes.get(sessaoId);
      const linhasSalvas = await db.linhasEmpenoDesgaste
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
    campo: keyof LinhaEmpenoDesgaste,
    valorTexto: string
  ) {
    let valor: string | number | undefined =
      valorTexto === ""
        ? undefined
        : CAMPOS_TEXTO.has(campo)
          ? valorTexto
          : Number(valorTexto);
    if (typeof valor === "number") {
      valor = clamparNumero(valor, 0, 999.99);
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
        await db.linhasEmpenoDesgaste
          .where("sessaoId")
          .equals(sessaoId)
          .delete();
        const linhasPreenchidas = linhas.filter((l) =>
          CAMPOS.some((c) => l[c.key] !== undefined)
        );
        await db.linhasEmpenoDesgaste.bulkAdd(
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
          tipoFicha: "EMPENO_DESGASTE",
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
        await db.linhasEmpenoDesgaste.bulkAdd(
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
          <GitCompareArrows
            size={18}
            style={{ color: "var(--primary-strong)" }}
          />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            {sessaoId ? "Editar" : ""} Empeno e Desgaste (Desempenadeira)
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            Empeno: marcação (ex.: AC) · Desgaste: diâmetro medido do rolo (mm)
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
                    const ehTexto = CAMPOS_TEXTO.has(c.key);
                    const valor = l[c.key] as string | number | undefined;
                    return (
                      <td key={c.key} style={estiloColuna(g.indice, i === 0)}>
                        <input
                          type={ehTexto ? "text" : "number"}
                          step={ehTexto ? undefined : "0.01"}
                          min={ehTexto ? undefined : 0}
                          max={ehTexto ? undefined : 999.99}
                          inputMode={ehTexto ? "text" : "decimal"}
                          placeholder="—"
                          className="input-cell"
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

export default function EmpenoDesgastePage() {
  return (
    <AuthGuard bloquearVisualizador>
      <StatusBar />
      <Suspense fallback={null}>
        <EmpenoDesgasteForm />
      </Suspense>
    </AuthGuard>
  );
}
