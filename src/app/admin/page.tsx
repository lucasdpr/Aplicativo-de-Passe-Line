"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { PainelPrazos } from "@/components/admin/PainelPrazos";
import { useAuthStore } from "@/lib/auth";
import {
  suportaPush,
  statusInscricaoPush,
  inscreverPush,
  cancelarPush,
} from "@/lib/push";

export default function AdminPrazosPage() {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const ehAdmin = tecnico?.papel === "ADMIN";
  const [statusPush, setStatusPush] = useState<
    "inativo" | "ativo" | "negado" | "carregando"
  >(() => (suportaPush() ? "carregando" : "inativo"));

  useEffect(() => {
    if (!suportaPush()) return;
    statusInscricaoPush().then(setStatusPush);
  }, []);

  async function handleAtivarNotificacoes() {
    if (!tecnico) return;
    setStatusPush("carregando");
    const resultado = await inscreverPush(tecnico.id, tecnico.nome);
    setStatusPush(resultado === "erro" ? "inativo" : resultado);
  }

  async function handleDesativarNotificacoes() {
    setStatusPush("carregando");
    await cancelarPush();
    setStatusPush("inativo");
  }

  return (
    <>
      <PainelPrazos />

      {ehAdmin && (
        <div className="surface flex items-center gap-3 p-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--primary-soft)" }}
          >
            {statusPush === "ativo" ? (
              <Bell size={16} style={{ color: "var(--primary-strong)" }} />
            ) : (
              <BellOff size={16} style={{ color: "var(--text-faint)" }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Notificações neste celular</div>
            <div className="text-xs text-[var(--text-dim)]">
              {statusPush === "ativo" &&
                "Ativas — você recebe um aviso quando um técnico concluir uma medição"}
              {statusPush === "inativo" &&
                "Desativadas — ative para ser avisado quando alguém concluir uma medição"}
              {statusPush === "negado" &&
                "Bloqueadas no navegador — permita notificações nas configurações do site"}
              {statusPush === "carregando" && "Verificando..."}
            </div>
          </div>
          {statusPush === "inativo" && (
            <button
              onClick={handleAtivarNotificacoes}
              className="btn-primary !w-auto shrink-0 px-4"
            >
              Ativar
            </button>
          )}
          {statusPush === "ativo" && (
            <button
              onClick={handleDesativarNotificacoes}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-dim)",
              }}
            >
              Desativar
            </button>
          )}
        </div>
      )}
    </>
  );
}
