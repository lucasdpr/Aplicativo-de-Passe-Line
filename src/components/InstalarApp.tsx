"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function jaInstalado() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error -- iOS Safari only
    window.navigator.standalone === true
  );
}

export function InstalarApp() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarInstrucaoIos, setMostrarInstrucaoIos] = useState(false);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (jaInstalado()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Detecção de iOS só é possível no cliente; feita após a montagem para
    // não divergir da renderização inicial do servidor (hidratação).
    const id = window.setTimeout(() => setMostrarInstrucaoIos(isIos()), 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(id);
    };
  }, []);

  if (fechado || (!promptEvent && !mostrarInstrucaoIos)) return null;

  async function instalar() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setPromptEvent(null);
  }

  return (
    <div
      className="mx-4 mb-3 flex items-center gap-3 rounded-xl p-3 text-sm"
      style={{
        background: "var(--primary-soft)",
        border: "1px solid var(--border-strong)",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--surface)" }}
      >
        {mostrarInstrucaoIos ? (
          <Share size={16} style={{ color: "var(--primary-strong)" }} />
        ) : (
          <Download size={16} style={{ color: "var(--primary-strong)" }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {mostrarInstrucaoIos ? (
          <p className="text-[var(--text)]">
            Toque em <strong>Compartilhar</strong> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong> para instalar o app.
          </p>
        ) : (
          <p className="text-[var(--text)]">
            Instale o app para usar em tela cheia e funcionar melhor offline.
          </p>
        )}
      </div>
      {!mostrarInstrucaoIos && (
        <button onClick={instalar} className="btn-primary !w-auto px-4">
          Instalar
        </button>
      )}
      <button
        onClick={() => setFechado(true)}
        aria-label="Fechar"
        className="shrink-0 text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}
