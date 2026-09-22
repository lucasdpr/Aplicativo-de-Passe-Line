"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";

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

  useEffect(() => {
    if (hidratado && !tecnico) router.replace("/login");
    else if (hidratado && semAcesso) router.replace("/");
  }, [hidratado, tecnico, semAcesso, router]);

  if (!hidratado) return null;
  if (!tecnico) return null;
  if (semAcesso) return null;
  return <>{children}</>;
}
