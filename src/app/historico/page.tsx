"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { db } from "@/lib/db/dexie";

const NOMES_FICHA: Record<string, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

export default function HistoricoPage() {
  const sessoes = useLiveQuery(
    () => db.sessoes.orderBy("criadoEm").reverse().toArray(),
    []
  );

  return (
    <AuthGuard>
      <StatusBar />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-3">
        <h1 className="text-lg font-semibold">Histórico de medições</h1>

        {sessoes?.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma medição registrada ainda.</p>
        )}

        {sessoes?.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{NOMES_FICHA[s.tipoFicha]}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  s.status === "SINCRONIZADO"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {s.status === "SINCRONIZADO" ? "Sincronizado" : "Pendente"}
              </span>
            </div>
            <div className="mt-1 text-slate-400">
              {s.maquina} · Veio {s.veio} · {s.data}
            </div>
            <div className="text-slate-400">
              {s.tecnicoNome} — matr. {s.tecnicoMatricula} ({s.tecnicoFuncao})
            </div>
          </div>
        ))}
      </main>
    </AuthGuard>
  );
}
