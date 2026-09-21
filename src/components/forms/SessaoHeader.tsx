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
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <label className="col-span-1">
        <span className="mb-1 block text-xs text-slate-400">Máquina</span>
        <select
          className="input"
          value={value.maquina}
          onChange={(e) => set("maquina", e.target.value as Maquina)}
        >
          <option value="MCC2">MCC2</option>
          <option value="MCC3">MCC3</option>
        </select>
      </label>

      <label className="col-span-1">
        <span className="mb-1 block text-xs text-slate-400">Veio</span>
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
      </label>

      <label className="col-span-2">
        <span className="mb-1 block text-xs text-slate-400">Data</span>
        <input
          type="date"
          className="input"
          value={value.data}
          onChange={(e) => set("data", e.target.value)}
        />
      </label>

      <label className="col-span-2">
        <span className="mb-1 block text-xs text-slate-400">Observação</span>
        <textarea
          className="input"
          rows={2}
          value={value.observacao}
          onChange={(e) => set("observacao", e.target.value)}
        />
      </label>

      <label className="col-span-1">
        <span className="mb-1 block text-xs text-slate-400">
          Inspecionado por
        </span>
        <input
          className="input"
          value={value.inspecionadoPor}
          onChange={(e) => set("inspecionadoPor", e.target.value)}
        />
      </label>

      <label className="col-span-1">
        <span className="mb-1 block text-xs text-slate-400">
          Liberado por
        </span>
        <input
          className="input"
          value={value.liberadoPor}
          onChange={(e) => set("liberadoPor", e.target.value)}
        />
      </label>
    </div>
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
