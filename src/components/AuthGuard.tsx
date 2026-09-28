"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { conferirSessaoServidor, useAuthStore } from "@/lib/auth";

export function AuthGuard({
  children,
  bloquearVisualizador = false,
}: {
  children: React.ReactNode;
  /** Fichas de medição e outras telas de edição — visualizador só acompanha. */
  bloquearVisualizador?: boolean;
}) {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const hidratado = useAuthStore((s) => s.hidratado);
  const router = useRouter();
  const semAcesso = bloquearVisualizador && tecnico?.papel === "VISUALIZADOR";

  // Com internet, confere se a sessão do servidor bate com quem está logado
  // aqui (o login offline só existe no aparelho). Se não bater, pede pra
  // entrar de novo — sem isso nada consegue sincronizar nem ser salvo.
  const tecnicoId = tecnico?.id;
  const sessaoInvalida = useRef(false);
  useEffect(() => {
    if (!hidratado || !tecnicoId || !navigator.onLine) return;
    let cancelado = false;
    conferirSessaoServidor(tecnicoId).then((r) => {
      if (cancelado) return;
      const { login, logout, tecnicoLogado } = useAuthStore.getState();
      if (r.estado === "invalida") {
        // O redirecionamento sai do efeito de baixo, que roda quando o
        // técnico vira null — com o motivo, pra tela de login explicar.
        sessaoInvalida.current = true;
        logout();
      } else if (
        r.estado === "ok" &&
        tecnicoLogado &&
        (tecnicoLogado.papel !== r.tecnico.papel || tecnicoLogado.nome !== r.tecnico.nome)
      ) {
        login({ ...tecnicoLogado, papel: r.tecnico.papel, nome: r.tecnico.nome });
      }
    });
    return () => {
      cancelado = true;
    };
  }, [hidratado, tecnicoId, router]);

  useEffect(() => {
    if (hidratado && !tecnico) {
      router.replace(sessaoInvalida.current ? "/login?motivo=sessao" : "/login");
    }
    else if (hidratado && semAcesso) router.replace("/");
  }, [hidratado, tecnico, semAcesso, router]);

  if (!hidratado) return null;
  if (!tecnico) return null;
  if (semAcesso) return null;
  return <>{children}</>;
}
