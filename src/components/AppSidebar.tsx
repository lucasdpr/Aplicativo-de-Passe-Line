"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlarmClock,
  ClipboardPlus,
  FolderClock,
  History,
  LineChart,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";
import type { PapelTecnico } from "@/types";
import { listarTecnicos, useAuthStore } from "@/lib/auth";
import { BotaoNotificacoes } from "@/components/BotaoNotificacoes";
import { IndicadorConexao } from "@/components/StatusBar";
import { usePrazosLocais } from "@/lib/usePrazosLocais";

interface ItemNav {
  href: string;
  label: string;
  icon: typeof History;
  /** Outras rotas que também deixam este item ativo. */
  tambem?: string[];
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

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** Menu único do app — o mesmo em todas as telas, pra ninguém se perder. */
export function AppSidebar({ papel }: { papel?: PapelTecnico }) {
  const pathname = usePathname();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const logout = useAuthStore((s) => s.logout);
  const [abertoMobile, setAbertoMobile] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const resumo = usePrazosLocais();
  const papelAtual = papel ?? tecnico?.papel ?? "TECNICO";
  const ehAdmin = papelAtual === "ADMIN";
  const podeMedir = papelAtual !== "VISUALIZADOR";

  useEffect(() => {
    if (!ehAdmin) return;
    listarTecnicos()
      .then((lista) => setPendentes(lista.filter((t) => !t.aprovado).length))
      .catch(() => {});
  }, [ehAdmin]);

  useEffect(() => {
    if (!abertoMobile) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAbertoMobile(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [abertoMobile]);

  const grupos: Grupo[] = [
    {
      titulo: "Acompanhar",
      itens: [
        { href: "/prazos", label: "Prazos", icon: AlarmClock, tambem: ["/admin"] },
        { href: "/admin/analise", label: "Análise e variação", icon: LineChart },
        { href: "/historico", label: "Histórico", icon: History },
      ],
    },
    ...(ehAdmin
      ? [
          {
            titulo: "Administração",
            itens: [
              { href: "/admin/historico", label: "Histórico completo", icon: FolderClock },
              { href: "/admin/tecnicos", label: "Técnicos", icon: Users, contador: pendentes },
            ],
          },
        ]
      : []),
  ];

  const ativo = (item: ItemNav) =>
    pathname === item.href || (item.tambem ?? []).includes(pathname);
  const medindo = pathname === "/" || pathname.startsWith("/formularios");

  const conteudo = (
    <div className="flex h-full w-full min-w-0 flex-col">
      <Link href="/" className="sidebar-marca" onClick={() => setAbertoMobile(false)}>
        <Image
          src="/icons/logo-mark.png"
          alt=""
          width={36}
          height={36}
          className="rounded-[10px]"
        />
        <span className="min-w-0">
          <span className="block truncate font-display text-[0.95rem] font-semibold tracking-tight">
            CSN Pass-Line
          </span>
          <span className="block truncate text-xs text-[var(--text-faint)]">
            Medição e ajuste
          </span>
        </span>
      </Link>

      {podeMedir && (
        <div className="px-3 pb-5">
          <Link
            href="/"
            onClick={() => setAbertoMobile(false)}
            aria-current={medindo ? "page" : undefined}
            className="sidebar-acao"
          >
            <ClipboardPlus size={17} strokeWidth={2} />
            Fazer medição
          </Link>
        </div>
      )}

      <nav aria-label="Menu principal" className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <div className="sidebar-grupo">{grupo.titulo}</div>
            <ul className="space-y-0.5">
              {grupo.itens.map((item) => {
                const Icon = item.icon;
                const estaAtivo = ativo(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setAbertoMobile(false)}
                      aria-current={estaAtivo ? "page" : undefined}
                      className="sidebar-item"
                    >
                      <Icon size={17} strokeWidth={1.8} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!item.contador && (
                        <span
                          className="sidebar-contador"
                          title={`${item.contador} cadastro(s) aguardando aprovação`}
                        >
                          {item.contador}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {resumo && resumo.prazos.length > 0 && (
        <Link
          href="/prazos"
          onClick={() => setAbertoMobile(false)}
          className="mx-3 mb-3 block rounded-xl border p-3 transition hover:border-[var(--border-strong)]"
          style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.015)" }}
          aria-label={`Prazos: ${resumo.atrasados} atrasadas, ${resumo.vencendo} vencendo, ${resumo.emDia} em dia`}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium text-[var(--text-dim)]">Situação dos prazos</span>
            <span className="font-mono text-[0.7rem] text-[var(--text-faint)]">
              {resumo.prazos.length} fichas
            </span>
          </div>
          <div className="medidor" aria-hidden>
            {[
              { n: resumo.atrasados, cor: "var(--danger)" },
              { n: resumo.vencendo, cor: "var(--warning)" },
              { n: resumo.emDia, cor: "var(--success)" },
            ]
              .filter((x) => x.n > 0)
              .map((x) => (
                <span key={x.cor} style={{ flexGrow: x.n, background: x.cor }} />
              ))}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1 text-[0.7rem]">
            {[
              { n: resumo.atrasados, rotulo: "atrasadas", estado: "atrasado" },
              { n: resumo.vencendo, rotulo: "vencendo", estado: "vencendo" },
              { n: resumo.emDia, rotulo: "em dia", estado: "em_dia" },
            ].map((x) => (
              <span key={x.estado} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-[var(--text)]">
                  <span className="ponto-estado" data-estado={x.estado} />
                  {x.n}
                </span>
                <span className="text-[var(--text-faint)]">{x.rotulo}</span>
              </span>
            ))}
          </div>
        </Link>
      )}

      <div className="space-y-2 border-t p-3" style={{ borderColor: "var(--border)" }}>
        <BotaoNotificacoes />
        {tecnico && (
          <div className="sidebar-usuario">
            <span className="sidebar-avatar" aria-hidden>
              {iniciais(tecnico.nome)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--text)]">
                {tecnico.nome}
              </span>
              <span className="block truncate text-xs text-[var(--text-faint)]">
                {ROTULO_PAPEL[papelAtual]} · matr. {tecnico.matricula}
              </span>
            </span>
            <button
              type="button"
              onClick={logout}
              className="sidebar-sair"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-hidden md:flex"
        style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {conteudo}
      </aside>

      {/* Celular: barra com o menu e o atalho principal */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b px-4 py-2.5 md:hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2.5">
          <Image src="/icons/logo-mark.png" alt="CSN Pass-Line" width={28} height={28} className="rounded-md" />
          <button
            type="button"
            onClick={() => setAbertoMobile(true)}
            className="sidebar-botao-menu"
            aria-label="Abrir menu"
            aria-expanded={abertoMobile}
          >
            <Menu size={18} />
            Menu
          </button>
          <IndicadorConexao compacto />
        </div>
        {podeMedir && !medindo && (
          <Link href="/" className="sidebar-acao !w-auto !py-1.5 !text-sm">
            <ClipboardPlus size={15} /> Fazer medição
          </Link>
        )}
      </div>

      {abertoMobile && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setAbertoMobile(false)}
          />
          <div
            className="sidebar-gaveta absolute left-0 top-0 h-dvh w-72 max-w-[85vw]"
            style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setAbertoMobile(false)}
              className="sidebar-sair absolute right-3 top-4"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
            {conteudo}
          </div>
        </div>
      )}
    </>
  );
}
