"use client";

import type { Maquina, Veio } from "@/types";
import { hojeIso } from "@/lib/datas";

const VEIOS_POR_MAQUINA: Record<Maquina, Veio[]> = {
  MCC2: ["C", "D"],
  MCC3: ["E", "F"],
  MCC4: ["G", "H"],
};

export interface SessaoHeaderValue {
  maquina: Maquina;
  veio: Veio;
  data: string;
  observacao: string;
  inspecionadoPor: string;
  liberadoPor: string;
}

const TODAS_MAQUINAS: Maquina[] = ["MCC2", "MCC3", "MCC4"];

export function SessaoHeader({
  value,
  onChange,
  maquinas = TODAS_MAQUINAS,
}: {
  value: SessaoHeaderValue;
  onChange: (v: SessaoHeaderValue) => void;
  /** Máquinas que têm essa ficha (ex.: GAP não existe na MCC4). */
  maquinas?: Maquina[];
}) {
  function set<K extends keyof SessaoHeaderValue>(
    key: K,
    val: SessaoHeaderValue[K]
  ) {
    const next = { ...value, [key]: val };
    if (key === "maquina") {
      next.veio = VEIOS_POR_MAQUINA[val as Maquina][0];
    }
    onChange(next);
  }

  return (
    <div className="surface grid grid-cols-2 gap-3 p-4">
      <Campo label="Máquina">
        <select
          className="input"
          value={value.maquina}
          onChange={(e) => set("maquina", e.target.value as Maquina)}
        >
          {maquinas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Veio">
        <select
          className="input"
          value={value.veio}
          onChange={(e) => set("veio", e.target.value as Veio)}
        >
          {VEIOS_POR_MAQUINA[value.maquina].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Campo>

      <div className="col-span-2">
        <Campo label="Data">
          <input
            type="date"
            className="input"
            value={value.data}
            onChange={(e) => set("data", e.target.value)}
          />
        </Campo>
      </div>

      <div className="col-span-2">
        <Campo label="Observação">
          <textarea
            className="input"
            rows={2}
            value={value.observacao}
            onChange={(e) => set("observacao", e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Inspecionado por">
        <input
          className="input uppercase"
          value={value.inspecionadoPor}
          onChange={(e) => set("inspecionadoPor", e.target.value.toUpperCase())}
        />
      </Campo>

      <Campo label="Liberado por">
        <input
          className="input uppercase"
          value={value.liberadoPor}
          onChange={(e) => set("liberadoPor", e.target.value.toUpperCase())}
        />
      </Campo>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-dim)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export function novaSessaoHeader(): SessaoHeaderValue {
  return {
    maquina: "MCC2",
    veio: "C",
    data: hojeIso(),
    observacao: "",
    inspecionadoPor: "",
    liberadoPor: "",
  };
}
