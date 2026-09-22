"use client";

import { useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { SidebarAdmin } from "@/components/admin/SidebarAdmin";
import { useAuthStore } from "@/lib/auth";
import { puxarAtualizacoes } from "@/lib/db/sync";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const ehAdmin = tecnico?.papel === "ADMIN";
  const podeVer = tecnico?.papel === "ADMIN" || tecnico?.papel === "VISUALIZADOR";

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
        <SidebarAdmin ehAdmin={ehAdmin} nomeTecnico={tecnico?.nome ?? ""} />
        <div className="min-w-0 flex-1">
          <StatusBar />
          <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
