"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuthStore } from "@/lib/auth";
import { puxarAtualizacoes } from "@/lib/db/sync";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // A Análise usa lista + detalhe lado a lado e precisa de mais largura.
  const largura = usePathname() === "/admin/analise" ? "max-w-7xl" : "max-w-4xl";
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  // Técnico e visualizador também podem ver — é tudo leitura (prazos,
  // análise, histórico). Só a gestão de técnicos fica restrita a admin.
  const podeVer = !!tecnico;

  useEffect(() => {
    puxarAtualizacoes().catch(() => {});
  }, []);

  if (tecnico && !podeVer) {
    return (
      <AuthGuard>
        <StatusBar />
        <main className="mx-auto w-full max-w-2xl flex-1 p-4">
          <div className="surface p-8 text-center text-sm text-[var(--text-dim)]">
            Esta área é restrita a administradores e visualizadores.
          </div>
        </main>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col md:flex-row">
        <AppSidebar papel={tecnico?.papel} />
        <div className="min-w-0 flex-1">
          <StatusBar comMenu />
          <main className={`mx-auto w-full ${largura} flex-1 space-y-8 p-4 md:p-6`}>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
