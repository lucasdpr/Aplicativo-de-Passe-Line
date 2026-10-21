"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlarmClock,
  ClipboardList,
  Eye,
  History,
  LineChart,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { listarTecnicos } from "@/lib/auth";
import type { PapelTecnico } from "@/types";
import { BotaoNotificacoes } from "@/components/BotaoNotificacoes";

interface ItemNav {
  href: string;
  label: string;
  icon: typeof Users;
  contador?: number;
}

interface Grupo {
  titulo: string;
  itens: ItemNav[];
}

const ROTULO_PAPEL: Record<PapelTecnico, string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
  VISUALIZADOR: "Visualizador",
};

export function SidebarAdmin({
  papel,
  nomeTecnico,
}: {
  papel: PapelTecnico;
  nomeTecnico: string;
}) {
  const pathname = usePathname();
  const [abertoMobile, setAbertoMobile] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const ehAdmin = papel === "ADMIN";
  const podeMedir = papel !== "VISUALIZADOR";

  useEffect(() => {
    if (!ehAdmin) return;
    listarTecnicos().then((tecnicos) => {
      setPendentes(tecnicos.filter((t) => !t.aprovado).length);
    });
  }, [ehAdmin]);

  const grupos: Grupo[] = [
    {
      titulo: "Acompanhar",
      itens: [
        { href: "/admin", label: "Prazos", icon: AlarmClock },
        { href: "/admin/analise", label: "Análise e variação", icon: LineChart },
        { href: "/admin/historico", label: "Histórico", icon: History },
      ],
    },
    ...(ehAdmin
      ? [
          {
            titulo: "Administração",
            itens: [
              {
                href: "/admin/tecnicos",
                label: "Técnicos",
                icon: Users,
                contador: pendentes,
              },
            ],
          },
        ]
      : []),
  ];

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 p-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--primary-soft)" }}
        >
          {ehAdmin ? (
            <ShieldCheck size={19} style={{ color: "var(--primary-strong)" }} />
          ) : (
            <Eye size={19} style={{ color: "var(--primary-strong)" }} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-bold tracking-tight">
            CSN Pass-Line
          </div>
          <div className="truncate text-xs text-[var(--text-faint)]">
            {ehAdmin ? "Área do administrador" : "Acompanhamento"}
          </div>
        </div>
      </div>

      {podeMedir && (
        <div className="px-3 pb-4">
          <Link
            href="/"
            onClick={() => setAbertoMobile(false)}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
            style={{ background: "var(--primary)", color: "#04201c" }}
          >
            <ClipboardList size={16} /> Fazer medição
          </Link>
        </div>
      )}

      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <div className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[var(--text-faint)]">
              {grupo.titulo}
            </div>
            <div className="space-y-1">
              {grupo.itens.map((s) => {
                const Icon = s.icon;
                const ativo = pathname === s.href;
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={() => setAbertoMobile(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-[var(--surface-raised)]"
                    style={
                      ativo
                        ? { background: "var(--primary-soft)", color: "var(--primary-strong)" }
                        : { color: "var(--text-dim)" }
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {!!s.contador && (
                      <span
                        className="badge badge-warning shrink-0"
                        title="Cadastros aguardando aprovação"
                      >
                        {s.contador} aguardando
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 p-3">
        <BotaoNotificacoes />
        <div
          className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
          style={{ background: "var(--surface-raised)", color: "var(--text-faint)" }}
        >
          <div className="truncate font-medium text-[var(--text-dim)]">{nomeTecnico}</div>
          <div>{ROTULO_PAPEL[papel]}</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: coluna fixa */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 md:flex md:w-64"
        style={{
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        {conteudo}
      </aside>

      {/* Mobile: menu + atalho para medir */}
      <div className="flex items-center justify-between gap-2 p-4 md:hidden">
        <button
          onClick={() => setAbertoMobile(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
        >
          <Menu size={16} />
          Menu
        </button>
        {podeMedir && (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
            style={{ background: "var(--primary)", color: "#04201c" }}
          >
            <ClipboardList size={14} /> Fazer medição
          </Link>
        )}
      </div>

      {abertoMobile && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setAbertoMobile(false)}
          />
          <div
            className="absolute left-0 top-0 h-full w-72 max-w-[80vw]"
            style={{ background: "var(--surface)" }}
          >
            <button
              onClick={() => setAbertoMobile(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5"
              style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
            >
              <X size={16} />
            </button>
            {conteudo}
          </div>
        </div>
      )}
    </>
  );
}
