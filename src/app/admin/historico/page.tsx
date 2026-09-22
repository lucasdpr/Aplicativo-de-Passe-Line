"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, ChevronDown, History, Pencil, Trash2 } from "lucide-react";
import { useAuthStore, listarTecnicos } from "@/lib/auth";
import { db } from "@/lib/db/dexie";
import { excluirSessao } from "@/lib/db/sync";
import { CalendarioMes } from "@/components/CalendarioMes";
import type { Edicao, SessaoMedicao, Tecnico, TipoFicha } from "@/types";

const NOMES_FICHA: Record<string, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

const SLUG_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "pass-line-desempenadeira",
  GAP: "gap",
  EMPENO_DESGASTE: "empeno-desgaste",
  PASS_LINE_SEGMENTOS: "pass-line-segmentos",
};

export default function AdminHistoricoPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const ehAdmin = tecnico?.papel === "ADMIN";

  const [tecnicos, setTecnicos] = useState<Omit<Tecnico, "pin">[] | null>(null);
  const sessoes = useLiveQuery(
    () => db.sessoes.orderBy("criadoEm").reverse().toArray(),
    []
  );
  const edicoes = useLiveQuery(() => db.edicoes.toArray(), []);
  const [filtroTecnico, setFiltroTecnico] = useState<string>("TODOS");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  useEffect(() => {
    listarTecnicos().then(setTecnicos);
  }, []);

  async function handleExcluirSessao(sessao: SessaoMedicao) {
    const confirmado = window.confirm(
      `Excluir esta medição de ${NOMES_FICHA[sessao.tipoFicha]} (${sessao.tecnicoNome}, ${sessao.data})? Essa ação não pode ser desfeita e remove também do banco na nuvem.`
    );
    if (!confirmado) return;
    try {
      await excluirSessao(sessao);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  const edicoesPorSessao = new Map<string, Edicao[]>();
  for (const e of edicoes ?? []) {
    const lista = edicoesPorSessao.get(e.sessaoId) ?? [];
    lista.push(e);
    edicoesPorSessao.set(e.sessaoId, lista);
  }

  const sessoesPorTecnico =
    filtroTecnico === "TODOS"
      ? sessoes
      : sessoes?.filter((s) => s.tecnicoId === filtroTecnico);

  const diasComMedicao = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessoesPorTecnico ?? []) set.add(s.data);
    return set;
  }, [sessoesPorTecnico]);

  const sessoesFiltradas = diaSelecionado
    ? sessoesPorTecnico?.filter((s) => s.data === diaSelecionado)
    : sessoesPorTecnico;

  const gruposPorDia = useMemo(() => {
    const mapa = new Map<string, SessaoMedicao[]>();
    for (const s of sessoesFiltradas ?? []) {
      const lista = mapa.get(s.data) ?? [];
      lista.push(s);
      mapa.set(s.data, lista);
    }
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sessoesFiltradas]);

  function formatarDia(data: string) {
    const d = new Date(`${data}T00:00:00`);
    const texto = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
          <History size={15} /> Histórico completo
        </h2>
        <button
          onClick={() => setMostrarCalendario((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{
            background: mostrarCalendario ? "var(--primary-soft)" : "var(--surface-raised)",
            color: mostrarCalendario ? "var(--primary-strong)" : "var(--text-dim)",
          }}
        >
          <CalendarDays size={13} />
          Calendário
        </button>
      </div>

      <select
        className="input mb-3"
        value={filtroTecnico}
        onChange={(e) => {
          setFiltroTecnico(e.target.value);
          setDiaSelecionado(null);
        }}
      >
        <option value="TODOS">Todos os técnicos</option>
        {tecnicos?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>

      {mostrarCalendario && (
        <div className="mb-4">
          <CalendarioMes
            diasComMedicao={diasComMedicao}
            diaSelecionado={diaSelecionado}
            onSelecionarDia={setDiaSelecionado}
          />
        </div>
      )}

      <div className="space-y-5">
        {gruposPorDia.length === 0 && (
          <div className="surface p-6 text-center text-sm text-[var(--text-dim)]">
            Nenhuma medição encontrada.
          </div>
        )}

        {gruposPorDia.map(([data, sessoesDoDia]) => (
          <div key={data}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold">{formatarDia(data)}</h3>
              <span className="badge">{sessoesDoDia.length}</span>
            </div>
            <div className="space-y-2">
              {sessoesDoDia.map((s) => {
                const historicoEdicoes = edicoesPorSessao.get(s.id) ?? [];
                const aberto = expandido === s.id;
                return (
                  <div key={s.id} className="surface p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium break-words">
                        {NOMES_FICHA[s.tipoFicha]}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`badge ${s.status === "SINCRONIZADO" ? "badge-success" : "badge-warning"}`}
                        >
                          {s.status === "SINCRONIZADO" ? "Sincronizado" : "Pendente"}
                        </span>
                        {ehAdmin && (
                          <>
                            <Link
                              href={`/formularios/${SLUG_POR_TIPO[s.tipoFicha]}?sessaoId=${s.id}`}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                              style={{
                                background: "var(--surface-raised)",
                                color: "var(--text-dim)",
                              }}
                            >
                              <Pencil size={11} /> Editar
                            </Link>
                            <button
                              onClick={() => handleExcluirSessao(s)}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                              style={{
                                background: "var(--danger-soft)",
                                color: "#fca5a5",
                              }}
                            >
                              <Trash2 size={11} /> Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-[var(--text-dim)]">
                      {s.maquina} · Veio {s.veio}
                    </div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {s.tecnicoNome} — matr. {s.tecnicoMatricula}
                    </div>
                    {s.editadoPorNome && (
                      <div className="mt-1 text-xs text-[var(--text-faint)]">
                        Editado por {s.editadoPorNome} em{" "}
                        {s.editadoEm && new Date(s.editadoEm).toLocaleString("pt-BR")}
                      </div>
                    )}

                    {historicoEdicoes.length > 0 && (
                      <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                        <button
                          onClick={() => setExpandido(aberto ? null : s.id)}
                          className="flex items-center gap-1 text-xs text-[var(--primary-strong)]"
                        >
                          <ChevronDown size={12} className={aberto ? "rotate-180" : ""} />
                          {historicoEdicoes.length} alteração
                          {historicoEdicoes.length > 1 ? "ões" : ""}
                        </button>
                        {aberto && (
                          <div className="mt-2 space-y-2">
                            {historicoEdicoes.map((e, i) => (
                              <div
                                key={i}
                                className="rounded-lg p-2 text-xs"
                                style={{ background: "var(--surface-raised)" }}
                              >
                                <div className="mb-1 text-[var(--text-faint)]">
                                  {e.editadoPorNome} em{" "}
                                  {new Date(e.editadoEm).toLocaleString("pt-BR")}
                                </div>
                                {[...e.mudancasHeader, ...e.mudancasLinhas].map((m, j) => (
                                  <div key={j} className="text-[var(--text)]">
                                    <span className="text-[var(--text-faint)]">
                                      {m.linhaChave !== "header" ? `[${m.linhaChave}] ` : ""}
                                      {m.campo}:
                                    </span>{" "}
                                    <span className="text-[#fca5a5] line-through">{m.de}</span>{" "}
                                    →{" "}
                                    <span className="text-[var(--success)]">{m.para}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
