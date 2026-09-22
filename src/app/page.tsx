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
import { LembretePrazos } from "@/components/LembretePrazos";
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
      <LembretePrazos />
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

        <p className="mb-2 mt-7 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Atalhos
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/historico"
            className="group surface flex items-center gap-3 p-4 transition hover:border-[var(--primary-strong)]"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--primary-soft)" }}
            >
              <History size={18} style={{ color: "var(--primary-strong)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">Histórico</div>
              <div className="truncate text-xs text-[var(--text-dim)]">
                Medições já registradas
              </div>
            </div>
            <ArrowRight
              size={16}
              className="shrink-0 text-[var(--text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary-strong)]"
            />
          </Link>

          {(tecnico?.papel === "ADMIN" || tecnico?.papel === "VISUALIZADOR") && (
            <Link
              href="/admin"
              className="group surface flex items-center gap-3 p-4 transition hover:border-[var(--border-strong)]"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)" }}
              >
                <ShieldCheck size={18} style={{ color: "var(--text-dim)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {tecnico?.papel === "ADMIN" ? "Painel admin" : "Visualização"}
                </div>
                <div className="truncate text-xs text-[var(--text-dim)]">
                  {tecnico?.papel === "ADMIN"
                    ? "Prazos, técnicos e mais"
                    : "Acompanhar sem editar"}
                </div>
              </div>
              <ArrowRight
                size={16}
                className="shrink-0 text-[var(--text-faint)] transition group-hover:translate-x-0.5"
              />
            </Link>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
