"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, MoveHorizontal } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { StatusBar } from "@/components/StatusBar";
import {
  SessaoHeader,
  novaSessaoHeader,
  type SessaoHeaderValue,
} from "@/components/forms/SessaoHeader";
import { db } from "@/lib/db/dexie";
import { sincronizarPendentes } from "@/lib/db/sync";
import { useAuthStore } from "@/lib/auth";
import { N_CAD_RANGE, type LinhaGap } from "@/types";

const GAP_NOMINAL_PADRAO = 258.0;
const TOLERANCIA_PADRAO = 0.5;

function linhasIniciais(): LinhaGap[] {
  const linhas: LinhaGap[] = [];
  for (let n = N_CAD_RANGE.min; n <= N_CAD_RANGE.max; n++) {
    linhas.push({
      nCad: n,
      gapNominal: GAP_NOMINAL_PADRAO,
      toleranciaMm: TOLERANCIA_PADRAO,
    });
  }
  return linhas;
}

const CAMPOS_MEDIDA: { key: keyof LinhaGap; label: string }[] = [
  { key: "primeiraAcionado", label: "1ª Acionado" },
  { key: "primeiraCentro", label: "1ª Centro" },
  { key: "primeiraNaoAcionado", label: "1ª Não Acionado" },
  { key: "ajusteAcionado", label: "Ajuste Acionado" },
  { key: "ajusteNaoAcionado", label: "Ajuste Não Acionado" },
  { key: "segundaAcionado", label: "2ª Acionado" },
  { key: "segundaCentro", label: "2ª Centro" },
  { key: "segundaNaoAcionado", label: "2ª Não Acionado" },
];

function foraDaTolerancia(
  campo: string,
  valor: number | undefined,
  gapNominal: number,
  tolerancia: number
) {
  if (valor === undefined || Number.isNaN(valor)) return false;
  if (campo.toLowerCase().includes("ajuste")) return false; // ajuste é delta, não medida absoluta
  return Math.abs(valor - gapNominal) > tolerancia;
}

export default function GapPage() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [header, setHeader] = useState<SessaoHeaderValue>(novaSessaoHeader());
  const [linhas, setLinhas] = useState<LinhaGap[]>(linhasIniciais());
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function setValor(nCad: number, campo: keyof LinhaGap, valorTexto: string) {
    const valor = valorTexto === "" ? undefined : Number(valorTexto);
    setLinhas((prev) =>
      prev.map((l) => (l.nCad === nCad ? { ...l, [campo]: valor } : l))
    );
    setSalvo(false);
  }

  async function salvar() {
    if (!tecnico) return;
    setSalvando(true);
    try {
      const sessaoId = uuid();
      await db.sessoes.add({
        id: sessaoId,
        tipoFicha: "GAP",
        maquina: header.maquina,
        veio: header.veio,
        data: header.data,
        tecnicoId: tecnico.id,
        tecnicoNome: tecnico.nome,
        tecnicoMatricula: tecnico.matricula,
        tecnicoFuncao: tecnico.funcao,
        observacao: header.observacao,
        inspecionadoPor: header.inspecionadoPor,
        liberadoPor: header.liberadoPor,
        criadoEm: new Date().toISOString(),
        status: "PENDENTE_SYNC",
      });

      const linhasPreenchidas = linhas.filter((l) =>
        CAMPOS_MEDIDA.some((c) => l[c.key] !== undefined)
      );
      await db.linhasGap.bulkAdd(
        linhasPreenchidas.map((l) => ({ ...l, sessaoId }))
      );

      setSalvo(true);
      sincronizarPendentes().catch(() => {});
      setTimeout(() => router.push("/"), 900);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AuthGuard>
      <StatusBar />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--primary-soft)" }}
          >
            <MoveHorizontal size={18} style={{ color: "var(--primary-strong)" }} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">
              Medição e Ajuste de GAP
            </h1>
            <p className="text-sm text-[var(--text-dim)]">
              Ajuste o GAP nominal por Nº CAD se divergir do padrão impresso
            </p>
          </div>
        </div>

        <SessaoHeader value={header} onChange={setHeader} />

        <div className="surface scrollbar-thin max-h-[60vh] overflow-auto">
          <table className="table-industrial min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Nº CAD</th>
                <th>GAP nominal</th>
                <th>Tolerância (±mm)</th>
                {CAMPOS_MEDIDA.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nCad}>
                  <td className="n-cad-cell">{l.nCad}</td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      className="input-cell"
                      value={l.gapNominal}
                      onChange={(e) =>
                        setValor(l.nCad, "gapNominal", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      className="input-cell"
                      value={l.toleranciaMm}
                      onChange={(e) =>
                        setValor(l.nCad, "toleranciaMm", e.target.value)
                      }
                    />
                  </td>
                  {CAMPOS_MEDIDA.map((c) => {
                    const valor = l[c.key] as number | undefined;
                    const fora = foraDaTolerancia(
                      c.key,
                      valor,
                      l.gapNominal,
                      l.toleranciaMm
                    );
                    return (
                      <td key={c.key}>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="—"
                          className={`input-cell ${fora ? "input-fora-tolerancia" : ""}`}
                          value={valor ?? ""}
                          onChange={(e) =>
                            setValor(l.nCad, c.key, e.target.value)
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={salvar} disabled={salvando} className="btn-primary">
          {salvando ? "Salvando..." : salvo ? "Salvo ✓" : "Salvar medição"}
        </button>
      </main>
    </AuthGuard>
  );
}
