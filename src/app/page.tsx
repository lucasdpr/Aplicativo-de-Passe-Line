"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";

const FICHAS = [
  {
    href: "/formularios/pass-line-desempenadeira",
    titulo: "Pass-Line (Desempenadeira)",
    sub: "MCC's #2 e #3 — tolerância ±0,50mm",
  },
  {
    href: "/formularios/gap",
    titulo: "Medição e Ajuste de GAP",
    sub: "MCC's #2 e #3",
  },
  {
    href: "/formularios/empeno-desgaste",
    titulo: "Empeno e Desgaste (Desempenadeira)",
    sub: "MCC's #2 e #3 — tolerância ±2,00mm",
  },
  {
    href: "/formularios/pass-line-segmentos",
    titulo: "Pass-Line dos Segmentos",
    sub: "MCC's #2 e #3 — tolerância ±1,00mm",
  },
];

export default function Home() {
  return (
    <AuthGuard>
      <StatusBar />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <h1 className="text-lg font-semibold mb-4">Selecione a ficha</h1>
        <div className="grid gap-3">
          {FICHAS.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="block rounded-xl border border-slate-800 bg-slate-900 p-4 active:bg-slate-800"
            >
              <div className="font-medium">{f.titulo}</div>
              <div className="text-sm text-slate-400">{f.sub}</div>
            </Link>
          ))}
        </div>

        <Link
          href="/historico"
          className="mt-6 block rounded-xl border border-slate-700 bg-slate-950 p-4 text-center text-sky-400"
        >
          Ver histórico de medições
        </Link>
      </main>
    </AuthGuard>
  );
}
