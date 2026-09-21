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
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        <h1 className="text-lg font-semibold">
          Medição de Empeno e Desgaste (Desempenadeira)
        </h1>
        <p className="text-sm text-slate-400">
          Empeno/Desgaste máximo: ±{TOLERANCIA.toFixed(2)}mm
        </p>

        <SessaoHeader value={header} onChange={setHeader} />

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 sticky top-0">
              <tr>
                <th className="p-2 text-left">Nº CAD</th>
                {CAMPOS.map((c) => (
                  <th key={c.key} className="p-2 text-left whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nCad} className="odd:bg-slate-950 even:bg-slate-900">
                  <td className="p-2 font-medium">{l.nCad}</td>
                  {CAMPOS.map((c) => {
                    const valor = l[c.key] as number | undefined;
                    const fora = foraDaTolerancia(valor);
                    return (
                      <td key={c.key} className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          className={`input w-24 ${fora ? "input-fora-tolerancia" : ""}`}
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
