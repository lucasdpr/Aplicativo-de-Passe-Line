"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLiveQuery } from "dexie-react-hooks";
import { Wifi, WifiOff, UploadCloud, LogOut } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { useAuthStore } from "@/lib/auth";

/** Internet e medições esperando envio — o que o técnico precisa ver sempre. */
export function IndicadorConexao({ compacto = false }: { compacto?: boolean }) {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
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
    <div className="flex items-center gap-2">
      <span
        className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]"
        title={online ? "Com internet" : "Sem internet — as medições ficam guardadas no aparelho"}
      >
        {online ? (
          <Wifi size={13} className="text-[var(--success)]" />
        ) : (
          <WifiOff size={13} className="text-[var(--warning)]" />
        )}
        <span className={compacto ? "sr-only" : ""}>{online ? "Online" : "Offline"}</span>
      </span>
      {!!pendentes && pendentes > 0 && (
        <span className="badge badge-warning" title="Medições salvas esperando envio">
          <UploadCloud size={11} />
          {pendentes}
          <span className={compacto ? "sr-only" : ""}>
            {" "}
            pendente{pendentes > 1 ? "s" : ""}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Barra de status. Nas telas com o menu lateral, logo, nome e "Sair" ficam
 * no menu — aqui não se repetem, e no celular a barra do menu já mostra a
 * conexão, então esta some.
 */
export function StatusBar({ comMenu = false }: { comMenu?: boolean }) {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header
      className={`sticky top-0 z-20 items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur ${comMenu ? "hidden md:flex" : "flex"}`}
      style={{
        borderColor: "var(--border)",
        background: "rgba(10, 12, 15, 0.85)",
      }}
    >
      <div className="flex items-center gap-2.5">
        {!comMenu && (
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
            <Image src="/icons/logo-mark.png" alt="Pass-Line" width={28} height={28} />
          </div>
        )}
        <IndicadorConexao />
      </div>
      {tecnico && !comMenu && (
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-[var(--text-dim)] sm:inline">{tecnico.nome}</span>
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
