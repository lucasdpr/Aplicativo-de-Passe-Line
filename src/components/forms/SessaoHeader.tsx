"use client";

import type { Maquina, Veio } from "@/types";

const VEIOS_POR_MAQUINA: Record<Maquina, Veio[]> = {
  MCC2: ["C", "D"],
  MCC3: ["E", "F"],
};

export interface SessaoHeaderValue {
  maquina: Maquina;
  veio: Veio;
  data: string;
  observacao: string;
  inspecionadoPor: string;
  liberadoPor: string;
}

export function SessaoHeader({
  value,
  onChange,
}: {
  value: SessaoHeaderValue;
  onChange: (v: SessaoHeaderValue) => void;
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
          <option value="MCC2">MCC2</option>
          <option value="MCC3">MCC3</option>
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
    data: new Date().toISOString().slice(0, 10),
    observacao: "",
    inspecionadoPor: "",
    liberadoPor: "",
  };
}
