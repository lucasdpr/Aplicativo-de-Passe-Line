"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlarmClock,
  ClipboardList,
  History,
  LineChart,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import type { PapelTecnico } from "@/types";
import { BotaoNotificacoes } from "@/components/BotaoNotificacoes";

interface ItemNav {
  href: string;
  label: string;
  icon: typeof ClipboardList;
}

export function AppSidebar({ papel }: { papel?: PapelTecnico }) {
  const pathname = usePathname();
  const [abertoMobile, setAbertoMobile] = useState(false);
  const ehVisualizador = papel === "VISUALIZADOR";

  const itens: ItemNav[] = [
    ...(ehVisualizador ? [] : [{ href: "/", label: "Fazer medição", icon: ClipboardList }]),
    { href: "/historico", label: "Histórico", icon: History },
    { href: "/prazos", label: "Prazos", icon: AlarmClock },
    { href: "/admin/analise", label: "Análise e variação", icon: LineChart },
    ...(papel === "ADMIN"
      ? [{ href: "/admin", label: "Painel admin", icon: ShieldCheck }]
      : []),
  ];

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 p-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--primary-soft)" }}
        >
          <ClipboardList size={19} style={{ color: "var(--primary-strong)" }} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-bold tracking-tight">
            CSN Pass-Line
          </div>
          <div className="truncate text-xs text-[var(--text-faint)]">
            Medição e ajuste
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {itens.map((item) => {
          const Icon = item.icon;
          const ativo = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbertoMobile(false)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition"
              style={
                ativo
                  ? { background: "var(--primary-soft)", color: "var(--primary-strong)" }
                  : { color: "var(--text-dim)" }
              }
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <BotaoNotificacoes />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: coluna fixa */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 md:flex md:w-60"
        style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {conteudo}
      </aside>

      {/* Mobile: botão + drawer */}
      <div className="flex items-center p-4 md:hidden">
        <button
          onClick={() => setAbertoMobile(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
        >
          <Menu size={16} />
          Menu
        </button>
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
