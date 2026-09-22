"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlarmClock,
  ArrowLeft,
  ClipboardList,
  History,
  Menu,
  ShieldCheck,
  Users,
  X,
  Eye,
} from "lucide-react";

export interface SecaoNav {
  id: string;
  label: string;
  icon: typeof Users;
  contador?: number;
}

export function SidebarAdmin({
  ehAdmin,
  nomeTecnico,
  secoes,
}: {
  ehAdmin: boolean;
  nomeTecnico: string;
  secoes: SecaoNav[];
}) {
  const [abertoMobile, setAbertoMobile] = useState(false);

  function irPara(id: string) {
    setAbertoMobile(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
            {ehAdmin ? "Painel Admin" : "Painel de Visualização"}
          </div>
          <div className="truncate text-xs text-[var(--text-faint)]">
            CSN Pass-Line
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
          style={{ background: "var(--primary)", color: "#04201c" }}
        >
          <ClipboardList size={16} /> Fazer medição
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {secoes.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => irPara(s.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-dim)" }}
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1 truncate">{s.label}</span>
              {!!s.contador && (
                <span className="badge badge-warning shrink-0">{s.contador}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-2 p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-dim)" }}
        >
          <ArrowLeft size={16} /> Voltar ao app
        </Link>
        <div
          className="truncate rounded-xl px-3 py-2 text-xs"
          style={{ background: "var(--surface-raised)", color: "var(--text-faint)" }}
        >
          Logado como <span className="font-medium text-[var(--text-dim)]">{nomeTecnico}</span>
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

      {/* Mobile: botão + drawer */}
      <div className="flex items-center justify-between p-4 md:hidden">
        <button
          onClick={() => setAbertoMobile(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}
        >
          <Menu size={16} />
          {ehAdmin ? "Painel Admin" : "Painel de Visualização"}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ background: "var(--primary)", color: "#04201c" }}
        >
          <ClipboardList size={14} /> Fazer medição
        </Link>
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

export const ICONE_PRAZOS = AlarmClock;
export const ICONE_TECNICOS = Users;
export const ICONE_HISTORICO = History;
