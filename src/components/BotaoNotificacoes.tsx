"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { suportaPush, statusInscricaoPush, inscreverPush, cancelarPush } from "@/lib/push";

/** Botão compacto pra barra lateral — liga/desliga notificações neste aparelho. */
export function BotaoNotificacoes() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const [status, setStatus] = useState<"inativo" | "ativo" | "negado" | "carregando">(() =>
    suportaPush() ? "carregando" : "inativo"
  );

  useEffect(() => {
    if (!suportaPush()) return;
    statusInscricaoPush().then(setStatus);
  }, []);

  if (!suportaPush() || status === "negado") return null;

  async function alternar() {
    if (status === "ativo") {
      setStatus("carregando");
      await cancelarPush();
      setStatus("inativo");
      return;
    }
    if (!tecnico) return;
    setStatus("carregando");
    const resultado = await inscreverPush(tecnico.id, tecnico.nome);
    setStatus(resultado === "erro" ? "inativo" : resultado);
  }

  return (
    <button
      onClick={alternar}
      disabled={status === "carregando"}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-[var(--surface-raised)]"
      style={{ color: status === "ativo" ? "var(--primary-strong)" : "var(--text-faint)" }}
    >
      {status === "ativo" ? <Bell size={14} /> : <BellOff size={14} />}
      <span className="flex-1 truncate">
        {status === "carregando"
          ? "Verificando notificações..."
          : status === "ativo"
            ? "Notificações ativas"
            : "Ativar notificações"}
      </span>
    </button>
  );
}
