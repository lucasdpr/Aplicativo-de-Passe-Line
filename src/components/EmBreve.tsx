"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";

export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <AuthGuard>
      <StatusBar />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">
        <h1 className="text-lg font-semibold">{titulo}</h1>
        <p className="text-sm text-slate-400">
          Este formulário ainda está sendo construído. Ele vai seguir o mesmo
          padrão do formulário de Pass-Line (Desempenadeira): cabeçalho da
          sessão, tabela offline e salvamento local com sync automático.
        </p>
        <Link href="/" className="text-sky-400 underline">
          Voltar
        </Link>
      </main>
    </AuthGuard>
  );
}
