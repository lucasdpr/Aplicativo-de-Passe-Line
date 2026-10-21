"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitCompareArrows,
  Layers,
  MoveHorizontal,
  Ruler,
  UploadCloud,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuthStore } from "@/lib/auth";
import { db } from "@/lib/db/dexie";
import { chaveCombo } from "@/lib/prazos";
import { estadoDoPrazo, usePrazosLocais, type ResumoPrazos } from "@/lib/usePrazosLocais";
import type { Maquina, TipoFicha, Veio } from "@/types";

interface Ficha {
  href: string;
  sigla: string;
  titulo: string;
  sub: string;
  tolerancia: string;
  icon: typeof Ruler;
  cor: string;
  /** Ficha que entra no controle de prazo (pra mostrar os veios). */
  tipoFicha?: TipoFicha;
}

interface Grupo {
  titulo: string;
  maquinas: { maquina: Maquina; veios: Veio[] }[];
  fichas: Ficha[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: "MCC2 · MCC3",
    maquinas: [
      { maquina: "MCC2", veios: ["C", "D"] },
      { maquina: "MCC3", veios: ["E", "F"] },
    ],
    fichas: [
      {
        href: "/formularios/pass-line-desempenadeira",
        sigla: "PL-D",
        titulo: "Pass-Line da Desempenadeira",
        sub: "Folga entre rolo e régua, oeste e leste",
        tolerancia: "±0,50 mm",
        icon: Ruler,
        cor: "var(--primary-strong)",
        tipoFicha: "PASS_LINE_DESEMPENADEIRA",
      },
      {
        href: "/formularios/gap",
        sigla: "GAP",
        titulo: "Medição e ajuste de GAP",
        sub: "Acionado, centro e não acionado por Nº CAD",
        tolerancia: "nominal ±0,50 mm",
        icon: MoveHorizontal,
        cor: "var(--accent-steel)",
        tipoFicha: "GAP",
      },
      {
        href: "/formularios/empeno-desgaste",
        sigla: "E/D",
        titulo: "Empeno e desgaste",
        sub: "Diâmetro superior, inferior e par",
        tolerancia: "empeno máx. 2,00 mm",
        icon: GitCompareArrows,
        cor: "var(--accent-ember)",
        tipoFicha: "EMPENO_DESGASTE",
      },
      {
        href: "/formularios/pass-line-segmentos",
        sigla: "PL-S",
        titulo: "Pass-Line dos segmentos",
        sub: "Segmentos 0 a 6 e D",
        tolerancia: "±1,00 mm",
        icon: Layers,
        cor: "var(--accent-slate)",
      },
    ],
  },
  {
    titulo: "MCC4",
    maquinas: [{ maquina: "MCC4", veios: ["G", "H"] }],
    fichas: [
      {
        href: "/formularios/pass-line-segmentos",
        sigla: "PL-S",
        titulo: "Pass-Line dos segmentos",
        sub: "Dente entre segmentos, Bender a 17",
        tolerancia: "dente ±0,50 mm",
        icon: Layers,
        cor: "var(--accent-slate)",
        tipoFicha: "PASS_LINE_SEGMENTOS",
      },
      {
        href: "/formularios/gap-mcc4",
        sigla: "GAP",
        titulo: "Medição e ajuste de GAP",
        sub: "Segmentos 1 a 17, entrada e saída",
        tolerancia: "255,00 ±0,50 mm",
        icon: MoveHorizontal,
        cor: "var(--accent-steel)",
        tipoFicha: "GAP_MCC4",
      },
    ],
  },
];

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function dataPorExtenso() {
  const t = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function primeiroNome(nome?: string) {
  const p = nome?.trim().split(/\s+/)[0];
  if (!p) return "técnico";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function textoPrazo(dias: number) {
  if (dias < 0) return `atrasado ${-dias}d`;
  if (dias === 0) return "vence hoje";
  return `vence em ${dias}d`;
}

export default function Home() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const hidratado = useAuthStore((s) => s.hidratado);
  const ehVisualizador = tecnico?.papel === "VISUALIZADOR";
  const resumo = usePrazosLocais();
  const pendentes = useLiveQuery(
    () => db.sessoes.where("status").equals("PENDENTE_SYNC").count(),
    []
  );

  useEffect(() => {
    // Visualizador não faz medição — a tela inicial dele é a Análise.
    if (hidratado && ehVisualizador) router.replace("/admin/analise");
  }, [hidratado, ehVisualizador, router]);

  if (ehVisualizador) return null;

  return (
    <AuthGuard>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <AppSidebar papel={tecnico?.papel} />
        <div className="min-w-0 flex-1">
          <StatusBar comMenu />
          <main className="mx-auto w-full max-w-5xl space-y-9 px-4 pb-12 pt-6 md:px-8 md:pt-10">
            <header className="entrar">
              <p className="rotulo-secao">{dataPorExtenso()}</p>
              <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-[2.4rem]">
                {saudacao()}, {primeiroNome(tecnico?.nome)}
              </h1>
              <p className="mt-2 max-w-xl text-[0.95rem] text-[var(--text-dim)]">
                Escolha a ficha para começar. Os prazos abaixo usam as medições deste
                aparelho, então funcionam mesmo sem internet.
              </p>
            </header>

            <ResumoTurno resumo={resumo} pendentes={pendentes ?? 0} />

            {GRUPOS.map((grupo, gi) => (
              <section
                key={grupo.titulo}
                className="entrar"
                style={{ animationDelay: `${120 + gi * 80}ms` }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold tracking-tight">
                    {grupo.titulo}
                  </h2>
                  <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                  <span className="text-xs text-[var(--text-faint)]">
                    Veios {grupo.maquinas.flatMap((m) => m.veios).join(" · ")}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {grupo.fichas.map((f) => (
                    <CartaoFicha key={f.href} ficha={f} grupo={grupo} resumo={resumo} />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

function ResumoTurno({ resumo, pendentes }: { resumo?: ResumoPrazos; pendentes: number }) {
  const tiles = [
    {
      href: "/prazos",
      label: "Atrasadas",
      valor: resumo?.atrasados,
      nota: "passaram do prazo",
      icon: AlertTriangle,
      cor: "var(--danger)",
    },
    {
      href: "/prazos",
      label: "Vencendo",
      valor: resumo?.vencendo,
      nota: "nos próximos 7 dias",
      icon: Clock,
      cor: "var(--warning)",
    },
    {
      href: "/prazos",
      label: "Em dia",
      valor: resumo?.emDia,
      nota: "dentro do prazo",
      icon: CheckCircle2,
      cor: "var(--success)",
    },
    {
      href: "/historico",
      label: "A enviar",
      valor: pendentes,
      nota: pendentes ? "salvas, esperando internet" : "tudo sincronizado",
      icon: UploadCloud,
      cor: pendentes ? "var(--warning)" : "var(--border-strong)",
    },
  ];
  return (
    <section
      aria-label="Resumo dos prazos"
      className="entrar grid grid-cols-2 gap-3 md:grid-cols-4"
      style={{ animationDelay: "60ms" }}
    >
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.label}
            href={t.href}
            className="stat-tile"
            style={{ "--cor-estado": t.cor } as React.CSSProperties}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-dim)]">
              <Icon size={13} style={{ color: t.cor }} />
              {t.label}
            </span>
            <span className="stat-valor">{t.valor ?? "–"}</span>
            <span className="text-xs text-[var(--text-faint)]">{t.nota}</span>
          </Link>
        );
      })}
    </section>
  );
}

function CartaoFicha({
  ficha: f,
  grupo,
  resumo,
}: {
  ficha: Ficha;
  grupo: Grupo;
  resumo?: ResumoPrazos;
}) {
  const Icon = f.icon;
  const veios = grupo.maquinas.flatMap((m) => m.veios.map((veio) => ({ maquina: m.maquina, veio })));
  return (
    <Link href={f.href} className="cartao-ficha group" style={{ "--cor": f.cor } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${f.cor} 14%, transparent)` }}
        >
          <Icon size={19} style={{ color: f.cor }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="sigla-ficha">{f.sigla}</span>
            <span className="font-mono text-[0.7rem] text-[var(--text-faint)]">{f.tolerancia}</span>
          </span>
          <span className="mt-1.5 block font-display text-[1.02rem] font-semibold leading-snug tracking-tight">
            {f.titulo}
          </span>
          <span className="mt-0.5 block text-sm text-[var(--text-dim)]">{f.sub}</span>
        </span>
        <ArrowUpRight
          size={18}
          className="shrink-0 text-[var(--text-faint)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--text)]"
        />
      </div>

      {f.tipoFicha ? (
        <div className="flex flex-wrap gap-1.5">
          {veios.map(({ maquina, veio }) => {
            const p = resumo?.porChave.get(chaveCombo({ tipoFicha: f.tipoFicha!, maquina, veio }));
            const estado = p ? estadoDoPrazo(p.diasRestantes) : undefined;
            return (
              <span
                key={maquina + veio}
                className="pilula-veio"
                title={
                  p
                    ? `Última medição: ${p.ultimaMedicaoEm.split("-").reverse().join("/")}`
                    : "Sem medição registrada"
                }
              >
                <span className="ponto-estado" data-estado={estado} aria-hidden />
                <span className="veio">{veio}</span>
                <span>{p ? textoPrazo(p.diasRestantes) : "sem registro"}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <span className="text-xs text-[var(--text-faint)]">Sem controle de prazo nestas máquinas</span>
      )}
    </Link>
  );
}
