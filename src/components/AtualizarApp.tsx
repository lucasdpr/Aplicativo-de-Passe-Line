"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function AtualizarApp() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null
  );
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    let registro: ServiceWorkerRegistration | null = null;

    function observarNovoWorker(reg: ServiceWorkerRegistration) {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        return;
      }
      reg.addEventListener("updatefound", () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener("statechange", () => {
          if (novo.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(novo);
          }
        });
      });
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      registro = reg;
      observarNovoWorker(reg);
      // checa por atualização assim que o app abre
      reg.update().catch(() => {});
    });

    let recarregouUmaVez = false;
    const aoTrocarController = () => {
      if (recarregouUmaVez) return;
      recarregouUmaVez = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      aoTrocarController
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        aoTrocarController
      );
      void registro;
    };
  }, []);

  if (!waitingWorker) return null;

  function atualizar() {
    setAtualizando(true);
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <div
      className="mx-4 mb-3 flex items-center gap-3 rounded-xl p-3 text-sm"
      style={{
        background: "var(--warning-soft)",
        border: "1px solid var(--border-strong)",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--surface)" }}
      >
        <RefreshCw
          size={16}
          className={atualizando ? "animate-spin" : ""}
          style={{ color: "var(--warning)" }}
        />
      </div>
      <p className="flex-1 text-[var(--text)]">
        Uma nova versão do app está disponível.
      </p>
      <button onClick={atualizar} disabled={atualizando} className="btn-primary !w-auto px-4">
        {atualizando ? "Atualizando..." : "Atualizar"}
      </button>
    </div>
  );
}
