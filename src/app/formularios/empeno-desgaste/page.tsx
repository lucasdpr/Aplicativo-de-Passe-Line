"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { sincronizarPendentes } from "@/lib/db/sync";
import { useAuthStore } from "@/lib/auth";
import {
  N_CAD_RANGE,
  TOLERANCIAS,
  type LinhaEmpenoDesgaste,
} from "@/types";

const TOLERANCIA = TOLERANCIAS.EMPENO_DESGASTE;

function linhasIniciais(): LinhaEmpenoDesgaste[] {
  const linhas: LinhaEmpenoDesgaste[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({ nCad: n });
  }
  return linhas;
}

const CAMPOS: { key: keyof LinhaEmpenoDesgaste; label: string }[] = [
  { key: "empenoSuperior", label: "Empeno Superior" },
  { key: "empenoInferior", label: "Empeno Inferior" },
  { key: "empenoPar", label: "Empeno Par" },
  { key: "desgasteSuperior", label: "Desgaste Superior" },
  { key: "desgasteInferior", label: "Desgaste Inferior" },
  { key: "desgastePar", label: "Desgaste Par" },
];

function foraDaTolerancia(valor: number | undefined) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  return Math.abs(valor) > TOLERANCIA;
}

export default function EmpenoDesgastePage() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [linhas, setLinhas] = useState<LinhaEmpenoDesgaste[]>(
    linhasIniciais()
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function setValor(
    nCad: number,
    campo: keyof LinhaEmpenoDesgaste,
    valorTexto: string
  ) {
    const valor = valorTexto === "" ? undefined : Number(valorTexto);
    setLinhas((prev) =>
      prev.map((l) => (l.nCad === nCad ? { ...l, [campo]: valor } : l))
    );
    setSalvo(false);
  }

  async function salvar() {
    if (!tecnico) return;
    setSalvando(true);
    try {
      const sessaoId = uuid();
      await db.sessoes.add({
        id: sessaoId,
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
        linhasPreenchidas.map((l) => ({ ...l, sessaoId }))
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
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4">
        <Link
          href="/"
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
              Empeno e Desgaste (Desempenadeira)
            </h1>
            <p className="text-sm text-[var(--text-dim)]">
              Empeno/Desgaste máximo: ±{TOLERANCIA.toFixed(2)}mm
            </p>
          </div>
        </div>

        <SessaoHeader value={header} onChange={setHeader} />

        <div className="surface scrollbar-thin max-h-[60vh] overflow-auto">
          <table className="table-industrial min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Nº CAD</th>
                {CAMPOS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nCad}>
                  <td className="n-cad-cell">{l.nCad}</td>
                  {CAMPOS.map((c) => {
                    const valor = l[c.key] as number | undefined;
                    const fora = foraDaTolerancia(valor);
                    return (
                      <td key={c.key}>
                        <input
                          type="number"
                          step="0.01"
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
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={salvar} disabled={salvando} className="btn-primary">
          {salvando ? "Salvando..." : salvo ? "Salvo ✓" : "Salvar medição"}
        </button>
      </main>
    </AuthGuard>
  );
}
