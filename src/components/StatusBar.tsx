"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useAuthStore } from "@/lib/auth";

export function StatusBar() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const logout = useAuthStore((s) => s.logout);
  const pendentes = useLiveQuery(
    () => db.sessoes.where("status").equals("PENDENTE_SYNC").count(),
    []
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`}
        />
        <span className="text-slate-300">
          {online ? "Online" : "Offline — salvando local"}
        </span>
        {!!pendentes && pendentes > 0 && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
            {pendentes} pendente{pendentes > 1 ? "s" : ""} de sync
          </span>
        )}
      </div>
      {tecnico && (
        <div className="flex items-center gap-2 text-slate-400">
          <span>{tecnico.nome}</span>
          <button onClick={logout} className="text-sky-400 underline">
            sair
          </button>
        </div>
      )}
    </div>
  );
}
