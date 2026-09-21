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
import { N_CAD_RANGE, type LinhaGap } from "@/types";

const GAP_NOMINAL_PADRAO = 258.0;
const TOLERANCIA_PADRAO = 0.5;

function linhasIniciais(): LinhaGap[] {
  const linhas: LinhaGap[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({
      nCad: n,
      gapNominal: GAP_NOMINAL_PADRAO,
      toleranciaMm: TOLERANCIA_PADRAO,
    });
  }
  return linhas;
}

const CAMPOS_MEDIDA: { key: keyof LinhaGap; label: string }[] = [
  { key: "primeiraAcionado", label: "1ª Acionado" },
  { key: "primeiraCentro", label: "1ª Centro" },
  { key: "primeiraNaoAcionado", label: "1ª Não Acionado" },
  { key: "ajusteAcionado", label: "Ajuste Acionado" },
  { key: "ajusteNaoAcionado", label: "Ajuste Não Acionado" },
  { key: "segundaAcionado", label: "2ª Acionado" },
  { key: "segundaCentro", label: "2ª Centro" },
  { key: "segundaNaoAcionado", label: "2ª Não Acionado" },
];

function foraDaTolerancia(
  campo: string,
  valor: number | undefined,
  gapNominal: number,
  tolerancia: number
) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  if (campo.toLowerCase().includes("ajuste")) return false; // ajuste é delta, não medida absoluta
  return Math.abs(valor - gapNominal) > tolerancia;
}

export default function GapPage() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [linhas, setLinhas] = useState<LinhaGap[]>(linhasIniciais());
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function setValor(nCad: number, campo: keyof LinhaGap, valorTexto: string) {
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
        <h1 className="text-lg font-semibold">Medição e Ajuste de GAP</h1>
        <p className="text-sm text-slate-400">
          Ajuste o GAP nominal por Nº CAD se divergir do padrão da planilha
          impressa.
        </p>

        <SessaoHeader value={header} onChange={setHeader} />

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 sticky top-0">
              <tr>
                <th className="p-2 text-left">Nº CAD</th>
                <th className="p-2 text-left whitespace-nowrap">
                  GAP nominal
                </th>
                <th className="p-2 text-left whitespace-nowrap">
                  Tolerância (±mm)
                </th>
                {CAMPOS_MEDIDA.map((c) => (
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
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      className="input w-24"
                      value={l.gapNominal}
                      onChange={(e) =>
                        setValor(l.nCad, "gapNominal", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      className="input w-20"
                      value={l.toleranciaMm}
                      onChange={(e) =>
                        setValor(l.nCad, "toleranciaMm", e.target.value)
                      }
                    />
                  </td>
                  {CAMPOS_MEDIDA.map((c) => {
                    const valor = l[c.key] as number | undefined;
                    const fora = foraDaTolerancia(
                      c.key,
                      valor,
                      l.gapNominal,
                      l.toleranciaMm
                    );
                    return (
                      <td key={c.key} className="p-1">
                        <input
                          type="number"
                          step="0.1"
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
