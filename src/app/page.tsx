"use client";

import Link from "next/link";
import { ArrowRight, Eye, History, Ruler, MoveHorizontal, Layers, GitCompareArrows } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { AppSidebar } from "@/components/AppSidebar";
import { LembretePrazos } from "@/components/LembretePrazos";
import { useAuthStore } from "@/lib/auth";

const FICHAS = [
  {
    href: "/formularios/pass-line-desempenadeira",
    sigla: "PL-D",
    titulo: "Pass-Line (Desempenadeira)",
    sub: "Rolo e régua",
    tolerancia: "±0,50mm",
    icon: Ruler,
    cor: "var(--primary-strong)",
    fundo: "var(--primary-soft)",
  },
  {
    href: "/formularios/gap",
    sigla: "GAP",
    titulo: "Medição e Ajuste de GAP",
    sub: "Acionado / centro / não acionado",
    tolerancia: null,
    icon: MoveHorizontal,
    cor: "var(--accent-steel)",
    fundo: "var(--accent-steel-soft)",
  },
  {
    href: "/formularios/empeno-desgaste",
    sigla: "E/D",
    titulo: "Empeno e Desgaste",
    sub: "Superior / inferior / par",
    tolerancia: "±2,00mm",
    icon: GitCompareArrows,
    cor: "var(--accent-ember)",
    fundo: "var(--accent-ember-soft)",
  },
  {
    href: "/formularios/pass-line-segmentos",
    sigla: "PL-S",
    titulo: "Pass-Line dos Segmentos",
    sub: "Segmentos 0–6 e D",
    tolerancia: "±1,00mm",
    icon: Layers,
    cor: "var(--accent-slate)",
    fundo: "var(--accent-slate-soft)",
  },
];

export default function Home() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const ehVisualizador = tecnico?.papel === "VISUALIZADOR";

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col md:flex-row">
        <AppSidebar papel={tecnico?.papel} />
        <div className="min-w-0 flex-1">
          <StatusBar />
          {!ehVisualizador && <LembretePrazos />}
          <main className="mx-auto w-full max-w-2xl flex-1 p-4">
            <div className="mb-7 mt-2 border-b pb-5" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-faint)]">
                Olá, {tecnico?.nome?.split(" ")[0] ?? "técnico"}
              </p>
              <h1 className="font-display mt-1 text-[1.7rem] font-bold leading-tight tracking-tight">
                {ehVisualizador ? (
                  <>
                    Acesso de
                    <br />
                    visualização
                  </>
                ) : (
                  <>
                    Selecione a ficha
                    <br />
                    de medição
                  </>
                )}
              </h1>
            </div>

            {ehVisualizador && (
              <div className="grid gap-3">
                <Link
                  href="/historico"
                  className="group surface flex items-center gap-4 p-4 transition hover:border-[var(--border-strong)]"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--primary-soft)" }}
                  >
                    <History size={20} style={{ color: "var(--primary-strong)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Histórico de medições</div>
                    <div className="text-sm text-[var(--text-dim)]">
                      Acompanhar o que já foi registrado
                    </div>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-[var(--text-faint)]" />
                </Link>
                <div className="surface flex items-start gap-3 p-4 text-sm text-[var(--text-dim)]">
                  <Eye size={16} className="mt-0.5 shrink-0" style={{ color: "var(--text-faint)" }} />
                  <span>
                    Seu acesso é só de acompanhamento — quem faz e edita medições são os
                    técnicos. Use a barra lateral pra ver prazos e o painel completo.
                  </span>
                </div>
              </div>
            )}

            {!ehVisualizador && (
            <div className="grid gap-3">
              {FICHAS.map((f) => {
                const Icon = f.icon;
                return (
                  <Link
                    key={f.href}
                    href={f.href}
                    className="group surface relative flex items-center gap-4 overflow-hidden p-4 transition hover:border-[var(--border-strong)]"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[3px]"
                      style={{ background: f.cor }}
                    />
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: f.fundo }}
                    >
                      <Icon size={20} style={{ color: f.cor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="font-mono text-[0.65rem] font-semibold tracking-wide"
                          style={{ color: f.cor }}
                        >
                          {f.sigla}
                        </span>
                        <span className="truncate font-medium">{f.titulo}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--text-dim)]">
                        <span className="truncate">{f.sub}</span>
                        {f.tolerancia && (
                          <span className="font-mono text-xs text-[var(--text-faint)]">
                            {f.tolerancia}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight
                      size={18}
                      className="shrink-0 text-[var(--text-faint)] transition group-hover:translate-x-0.5"
                    />
                  </Link>
                );
              })}
            </div>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
