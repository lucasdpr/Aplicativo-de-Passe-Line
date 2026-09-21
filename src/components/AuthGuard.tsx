"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const hidratado = useAuthStore((s) => s.hidratado);
  const router = useRouter();

  useEffect(() => {
    if (hidratado && !tecnico) router.replace("/login");
  }, [hidratado, tecnico, router]);

  if (!hidratado) return null;
  if (!tecnico) return null;
  return <>{children}</>;
}
