"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const router = useRouter();

  useEffect(() => {
    if (!tecnico) router.replace("/login");
  }, [tecnico, router]);

  if (!tecnico) return null;
  return <>{children}</>;
}
