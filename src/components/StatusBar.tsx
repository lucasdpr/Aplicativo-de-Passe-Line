"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Wifi, WifiOff, UploadCloud, LogOut } from "lucide-react";
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
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur"
      style={{
        borderColor: "var(--border)",
        background: "rgba(10, 12, 15, 0.85)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md font-display text-xs font-bold"
          style={{
            background: "var(--primary-soft)",
            color: "var(--primary-strong)",
          }}
        >
          PL
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
          {online ? (
            <Wifi size={13} className="text-[var(--success)]" />
          ) : (
            <WifiOff size={13} className="text-[var(--warning)]" />
          )}
          <span>{online ? "Online" : "Offline"}</span>
        </div>
        {!!pendentes && pendentes > 0 && (
          <span className="badge badge-warning">
            <UploadCloud size={11} />
            {pendentes} pendente{pendentes > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {tecnico && (
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-[var(--text-dim)] sm:inline">
            {tecnico.nome}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[var(--text-dim)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      )}
    </header>
  );
}
