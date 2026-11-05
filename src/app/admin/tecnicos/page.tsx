"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2, Users, UserCheck, Radio } from "lucide-react";
import {
  useAuthStore,
  resetarPin,
  definirPapel,
  excluirTecnico,
  listarTecnicos,
  aprovarTecnico,
} from "@/lib/auth";
import { dataHora, estaOnline, haQuantoTempo, usePresencas } from "@/lib/presenca";
import type { PapelTecnico, Tecnico } from "@/types";

const NOME_PAPEL: Record<PapelTecnico, string> = {
  TECNICO: "Técnico",
  VISUALIZADOR: "Visualizador",
  ADMIN: "Admin",
};

export default function AdminTecnicosPage() {
  const router = useRouter();
  const tecnico = useAuthStore((s) => s.tecnicoLogado);
  const ehAdmin = tecnico?.papel === "ADMIN";

  const [tecnicos, setTecnicos] = useState<Omit<Tecnico, "pin">[] | null>(null);
  const [resetandoId, setResetandoId] = useState<string | null>(null);
  const { presencas, agora } = usePresencas(ehAdmin);

  const recarregarTecnicos = useCallback(() => {
    listarTecnicos().then(setTecnicos);
  }, []);

  useEffect(() => {
    // Gestão de técnicos (aprovar, trocar papel, resetar PIN, excluir) é
    // coisa de admin — visualizador não tem o que fazer aqui.
    if (tecnico && !ehAdmin) router.replace("/admin");
  }, [tecnico, ehAdmin, router]);

  useEffect(() => {
    recarregarTecnicos();
  }, [recarregarTecnicos]);

  if (tecnico && !ehAdmin) return null;

  async function handleResetarPin(id: string, nome: string) {
    const novoPin = window.prompt(
      `Novo PIN para ${nome} (de 4 a 8 números):`
    );
    if (!novoPin) return;
    if (!/^\d{4,8}$/.test(novoPin)) {
      alert("O PIN precisa ter de 4 a 8 números.");
      return;
    }
    setResetandoId(id);
    try {
      await resetarPin(id, novoPin);
      alert("PIN redefinido com sucesso.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setResetandoId(null);
    }
  }

  async function handleAprovarTecnico(id: string, nome: string) {
    const confirmado = window.confirm(
      `Confirmar que ${nome} é realmente um técnico da equipe e liberar o acesso dele?`
    );
    if (!confirmado) return;
    try {
      await aprovarTecnico(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    recarregarTecnicos();
  }

  async function handleDefinirPapel(id: string, nome: string, papel: PapelTecnico) {
    const confirmado = window.confirm(`Definir ${nome} como "${NOME_PAPEL[papel]}"?`);
    if (!confirmado) return;
    try {
      await definirPapel(id, papel);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    recarregarTecnicos();
  }

  async function handleExcluirTecnico(id: string, nome: string) {
    const confirmado = window.confirm(
      `Excluir o cadastro de ${nome}? As medições que ele já registrou continuam no histórico — só o acesso de login é removido. Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    try {
      await excluirTecnico(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    recarregarTecnicos();
  }

  const pendentes = tecnicos?.filter((t) => !t.aprovado) ?? [];
  const aprovados = (tecnicos?.filter((t) => t.aprovado) ?? []).sort(
    // Quem está online primeiro; depois quem entrou mais recentemente.
    (a, b) =>
      Number(estaOnline(presencas?.get(b.id), agora)) - Number(estaOnline(presencas?.get(a.id), agora)) ||
      new Date(presencas?.get(b.id)?.vistoEm ?? 0).getTime() -
        new Date(presencas?.get(a.id)?.vistoEm ?? 0).getTime()
  );
  const onlineAgora = aprovados.filter((t) => estaOnline(presencas?.get(t.id), agora));

  return (
    <>
      {ehAdmin && pendentes.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
            <UserCheck size={15} /> Cadastros pendentes de aprovação (
            {pendentes.length})
          </h2>
          <div className="space-y-2">
            {pendentes.map((t) => (
              <div
                key={t.id}
                className="surface flex flex-col gap-3 p-3"
                style={{ border: "1px solid var(--warning)" }}
              >
                <div className="min-w-0">
                  <span className="font-medium break-words">{t.nome}</span>
                  <div className="text-xs text-[var(--text-faint)]">
                    Matr. {t.matricula} · {t.funcao} · cadastrado em{" "}
                    {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAprovarTecnico(t.id, t.nome)}
                    className="btn-primary !w-auto px-4"
                  >
                    <UserCheck size={12} /> Confirmar que é técnico e liberar acesso
                  </button>
                  <button
                    onClick={() => handleExcluirTecnico(t.id, t.nome)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--danger-soft)",
                      color: "#fca5a5",
                    }}
                  >
                    <Trash2 size={12} /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {ehAdmin && presencas && (
        <section aria-label="Quem está online">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
            <Radio size={15} /> Online agora ({onlineAgora.length})
          </h2>
          <div className="surface p-3 text-sm">
            {onlineAgora.length === 0 ? (
              <span className="text-[var(--text-faint)]">Ninguém com o app aberto neste momento.</span>
            ) : (
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                {onlineAgora.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="ponto-estado" data-estado="em_dia" aria-hidden />
                    {t.nome}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Conta quem está com o app aberto e com internet. Quem está sem sinal (offline) não aparece,
              mesmo que esteja medindo.
            </p>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-dim)]">
          <Users size={15} /> Técnicos cadastrados ({aprovados.length})
        </h2>
        <div className="space-y-2">
          {aprovados.map((t) => (
            <div key={t.id} className="surface flex flex-col gap-3 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-words">{t.nome}</span>
                  <span
                    className={`badge ${t.papel === "ADMIN" ? "badge-success" : "badge-warning"}`}
                  >
                    {NOME_PAPEL[t.papel]}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  Matr. {t.matricula} · {t.funcao} · cadastrado em{" "}
                  {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                </div>
                {ehAdmin && presencas && <LinhaPresenca p={presencas.get(t.id)} agora={agora} />}
              </div>
              {ehAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input !w-auto py-1.5 text-xs"
                    value={t.papel}
                    onChange={(e) =>
                      handleDefinirPapel(
                        t.id,
                        t.nome,
                        e.target.value as PapelTecnico
                      )
                    }
                  >
                    <option value="TECNICO">Técnico</option>
                    <option value="VISUALIZADOR">Visualizador</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    onClick={() => handleResetarPin(t.id, t.nome)}
                    disabled={resetandoId === t.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--surface-raised)",
                      color: "var(--text-dim)",
                    }}
                  >
                    <KeyRound size={12} /> Resetar PIN
                  </button>
                  <button
                    onClick={() => handleExcluirTecnico(t.id, t.nome)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "var(--danger-soft)",
                      color: "#fca5a5",
                    }}
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function LinhaPresenca({ p, agora }: { p?: import("@/lib/presenca").Presenca; agora: number }) {
  if (!p) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
        <span className="ponto-estado" aria-hidden /> Nunca usou o app depois desta atualização
      </div>
    );
  }
  const online = estaOnline(p, agora);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span className="flex items-center gap-1.5" style={{ color: online ? "var(--success)" : "var(--text-dim)" }}>
        <span className="ponto-estado" data-estado={online ? "em_dia" : undefined} aria-hidden />
        {online ? "Online agora" : `Visto ${haQuantoTempo(p.vistoEm, agora)}`}
      </span>
      {p.ultimoLoginEm && (
        <span className="text-[var(--text-faint)]">Último login: {dataHora(p.ultimoLoginEm)}</span>
      )}
    </div>
  );
}
