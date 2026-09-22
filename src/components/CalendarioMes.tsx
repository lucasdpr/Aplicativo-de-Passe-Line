"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function paraChaveData(d: Date) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function CalendarioMes({
  diasComMedicao,
  diaSelecionado,
  onSelecionarDia,
}: {
  diasComMedicao: Set<string>;
  diaSelecionado: string | null;
  onSelecionarDia: (dia: string | null) => void;
}) {
  const hoje = useMemo(() => new Date(), []);
  const chaveHoje = paraChaveData(hoje);

  const [mesVisivel, setMesVisivel] = useState(() => {
    const base = diaSelecionado ? new Date(`${diaSelecionado}T00:00:00`) : hoje;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const celulas = useMemo(() => {
    const primeiroDiaSemana = mesVisivel.getDay();
    const diasNoMes = new Date(
      mesVisivel.getFullYear(),
      mesVisivel.getMonth() + 1,
      0
    ).getDate();

    const lista: { chave: string; dia: number }[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      lista.push({ chave: "", dia: 0 });
    }
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const d = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), dia);
      lista.push({ chave: paraChaveData(d), dia });
    }
    return lista;
  }, [mesVisivel]);

  function irParaMes(delta: number) {
    setMesVisivel(
      (atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1)
    );
  }

  return (
    <div className="surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => irParaMes(-1)}
          className="rounded-lg p-1.5"
          style={{ color: "var(--text-dim)" }}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium">
          {MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => irParaMes(1)}
          className="rounded-lg p-1.5"
          style={{ color: "var(--text-dim)" }}
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--text-faint)]">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {celulas.map((c, i) => {
          if (!c.chave) return <div key={`vazio-${i}`} />;
          const temMedicao = diasComMedicao.has(c.chave);
          const selecionado = diaSelecionado === c.chave;
          const ehHoje = c.chave === chaveHoje;
          return (
            <button
              key={c.chave}
              type="button"
              onClick={() => onSelecionarDia(selecionado ? null : c.chave)}
              disabled={!temMedicao}
              className="relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition disabled:cursor-not-allowed"
              style={{
                background: selecionado
                  ? "var(--primary)"
                  : temMedicao
                    ? "var(--primary-soft)"
                    : "transparent",
                color: selecionado
                  ? "#04201c"
                  : temMedicao
                    ? "var(--primary-strong)"
                    : "var(--text-faint)",
                fontWeight: ehHoje ? 700 : 400,
                border:
                  ehHoje && !selecionado
                    ? "1px solid var(--primary-strong)"
                    : undefined,
              }}
            >
              {c.dia}
            </button>
          );
        })}
      </div>

      {diaSelecionado && (
        <button
          type="button"
          onClick={() => onSelecionarDia(null)}
          className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-dim)",
          }}
        >
          Ver todos os dias
        </button>
      )}
    </div>
  );
}
