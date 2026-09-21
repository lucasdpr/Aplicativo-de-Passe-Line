"use client";

import Link from "next/link";
import {
  ArrowRight,
  History,
  Ruler,
  MoveHorizontal,
  Layers,
  GitCompareArrows,
  ShieldCheck,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { useAuthStore } from "@/lib/auth";

const FICHAS = [
  {
    href: "/formularios/pass-line-desempenadeira",
    titulo: "Pass-Line (Desempenadeira)",
    sub: "Rolo e régua — ±0,50mm",
    icon: Ruler,
  },
  {
    href: "/formularios/gap",
    titulo: "Medição e Ajuste de GAP",
    sub: "Acionado / centro / não acionado",
    icon: MoveHorizontal,
  },
  {
    href: "/formularios/empeno-desgaste",
    titulo: "Empeno e Desgaste",
    sub: "Superior / inferior / par — ±2,00mm",
    icon: GitCompareArrows,
  },
  {
    href: "/formularios/pass-line-segmentos",
    titulo: "Pass-Line dos Segmentos",
    sub: "Segmentos 0–6 e D — ±1,00mm",
    icon: Layers,
  },
];

export default function Home() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);

  return (
    <AuthGuard>
      <StatusBar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">
        <div className="mb-6 mt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Olá, {tecnico?.nome?.split(" ")[0] ?? "técnico"}
          </p>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Selecione a ficha de medição
          </h1>
        </div>

        <div className="grid gap-3">
          {FICHAS.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.href}
                href={f.href}
                className="group surface flex items-center gap-4 p-4 transition hover:border-[var(--primary-strong)]"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)" }}
                >
                  <Icon size={20} style={{ color: "var(--primary-strong)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.titulo}</div>
                  <div className="truncate text-sm text-[var(--text-dim)]">
                    {f.sub}
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-[var(--text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary-strong)]"
                />
              </Link>
            );
          })}
        </div>

        <Link
          href="/historico"
          className="surface mt-4 flex items-center justify-center gap-2 p-4 text-sm font-medium text-[var(--primary-strong)] transition hover:border-[var(--primary-strong)]"
        >
          <History size={16} />
          Ver histórico de medições
        </Link>

        {tecnico?.isAdmin && (
          <Link
            href="/admin"
            className="surface mt-3 flex items-center justify-center gap-2 p-4 text-sm font-medium transition hover:border-[var(--border-strong)]"
            style={{ color: "var(--text-dim)" }}
          >
            <ShieldCheck size={16} />
            Painel do administrador
          </Link>
        )}
      </main>
    </AuthGuard>
  );
}
