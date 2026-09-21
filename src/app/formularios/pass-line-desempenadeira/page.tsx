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
  type LinhaPassLineDesempenadeira,
} from "@/types";

const TOLERANCIA = TOLERANCIAS.PASS_LINE_DESEMPENADEIRA;

function linhasIniciais(): LinhaPassLineDesempenadeira[] {
  const linhas: LinhaPassLineDesempenadeira[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({ nCad: n });
  }
  return linhas;
}

const CAMPOS: { key: keyof LinhaPassLineDesempenadeira; label: string }[] = [
  { key: "oesteMedida", label: "Oeste Medida" },
  { key: "oesteAcionado", label: "Oeste Acionado" },
  { key: "oesteAjuste", label: "Oeste Ajuste" },
  { key: "lesteMedida", label: "Leste Medida" },
  { key: "lesteAcionado", label: "Leste Acionado" },
  { key: "lesteAjuste", label: "Leste Ajuste" },
];

function foraDaTolerancia(campo: string, valor: number | undefined) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  if (!campo.toLowerCase().includes("ajuste")) return false;
  return Math.abs(valor) > TOLERANCIA;
}

export default function PassLineDesempenadeiraPage() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [linhas, setLinhas] = useState<LinhaPassLineDesempenadeira[]>(
    linhasIniciais()
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function setValor(
    nCad: number,
    campo: keyof LinhaPassLineDesempenadeira,
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
          Medição e Ajuste de Pass-Line (Desempenadeira)
        </h1>
        <p className="text-sm text-slate-400">
          Tolerância entre rolo e régua: ±{TOLERANCIA.toFixed(2)}mm
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
                    const fora = foraDaTolerancia(c.key, valor);
                    return (
                      <td key={c.key} className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          className={`input w-20 ${fora ? "input-fora-tolerancia" : ""}`}
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
