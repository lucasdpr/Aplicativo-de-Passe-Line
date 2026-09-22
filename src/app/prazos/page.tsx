"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { AppSidebar } from "@/components/AppSidebar";
import { PainelPrazos } from "@/components/admin/PainelPrazos";
import { useAuthStore } from "@/lib/auth";

export default function PrazosPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col md:flex-row">
        <AppSidebar papel={tecnico?.papel} />
        <div className="min-w-0 flex-1">
          <StatusBar />
          <main className="mx-auto w-full max-w-2xl flex-1 p-4">
            <p className="mb-4 mt-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
              Olá, {tecnico?.nome?.split(" ")[0] ?? "técnico"}
            </p>
            <PainelPrazos />
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
