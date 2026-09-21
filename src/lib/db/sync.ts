import { db } from "@/lib/db/dexie";
import { supabase } from "@/lib/supabase";
import type { SessaoMedicao, TipoFicha } from "@/types";

const TABELA_POR_TIPO: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "linhas_pass_line_desempenadeira",
  GAP: "linhas_gap",
  EMPENO_DESGASTE: "linhas_empeno_desgaste",
  PASS_LINE_SEGMENTOS: "leituras_segmentos",
};

const TABELA_LOCAL_POR_TIPO = {
  PASS_LINE_DESEMPENADEIRA: db.linhasPassLineDesempenadeira,
  GAP: db.linhasGap,
  EMPENO_DESGASTE: db.linhasEmpenoDesgaste,
  PASS_LINE_SEGMENTOS: db.leiturasSegmentos,
} as const;

const NOMES_FICHA: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "Pass-Line (Desempenadeira)",
  GAP: "GAP",
  EMPENO_DESGASTE: "Empeno e Desgaste",
  PASS_LINE_SEGMENTOS: "Pass-Line dos Segmentos",
};

function notificarConclusao(sessao: SessaoMedicao) {
  fetch("/api/notificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titulo: "Pass-Line concluído",
      corpo: `${sessao.tecnicoNome} concluiu ${NOMES_FICHA[sessao.tipoFicha]} — ${sessao.maquina} veio ${sessao.veio}`,
      urlDestino: "/historico",
    }),
  }).catch(() => {});
}

/** Tries to push every PENDENTE_SYNC session to Supabase. Safe to call repeatedly. */
export async function sincronizarPendentes(): Promise<{
  enviados: number;
  falhas: number;
}> {
  if (!supabase || !navigator.onLine) return { enviados: 0, falhas: 0 };

  const pendentes = await db.sessoes
    .where("status")
    .equals("PENDENTE_SYNC")
    .toArray();

  let enviados = 0;
  let falhas = 0;

  for (const sessao of pendentes) {
    try {
      const primeiraVez = !sessao.sincronizadoEm;
      await enviarSessao(sessao);
      await db.sessoes.update(sessao.id, {
        status: "SINCRONIZADO",
        sincronizadoEm: new Date().toISOString(),
      });
      if (primeiraVez) notificarConclusao(sessao);
      enviados++;
    } catch (err) {
      console.error("Falha ao sincronizar sessão", sessao.id, err);
      falhas++;
    }
  }

  return { enviados, falhas };
}

async function enviarSessao(sessao: SessaoMedicao) {
  if (!supabase) throw new Error("Supabase não configurado");

  const { error: sessaoError } = await supabase.from("sessoes_medicao").upsert({
    id: sessao.id,
    tipo_ficha: sessao.tipoFicha,
    maquina: sessao.maquina,
    veio: sessao.veio,
    data: sessao.data,
    tecnico_id: sessao.tecnicoId,
    tecnico_nome: sessao.tecnicoNome,
    tecnico_matricula: sessao.tecnicoMatricula,
    tecnico_funcao: sessao.tecnicoFuncao,
    observacao: sessao.observacao,
    inspecionado_por: sessao.inspecionadoPor,
    liberado_por: sessao.liberadoPor,
    criado_em: sessao.criadoEm,
  });
  if (sessaoError) throw sessaoError;

  // Remove as linhas remotas antigas antes de reenviar: cobre tanto o
  // primeiro envio (não-op) quanto o reenvio de uma sessão editada, que
  // senão duplicaria as linhas no Supabase.
  const { error: deleteError } = await supabase
    .from(TABELA_POR_TIPO[sessao.tipoFicha])
    .delete()
    .eq("sessao_id", sessao.id);
  if (deleteError) throw deleteError;

  const linhasTable = TABELA_LOCAL_POR_TIPO[sessao.tipoFicha];
  const linhas = await linhasTable.where("sessaoId").equals(sessao.id).toArray();
  if (linhas.length === 0) return;

  const linhasRemotas = linhas.map((linha) => {
    const { id, sessaoId, ...resto } = linha;
    void id;
    return { sessao_id: sessaoId, ...toSnakeCase(resto) };
  });

  const { error: linhasError } = await supabase
    .from(TABELA_POR_TIPO[sessao.tipoFicha])
    .insert(linhasRemotas);
  if (linhasError) throw linhasError;
}

function toSnakeCase(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snake = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    out[snake] = value;
  }
  return out;
}

function fromSnakeCase<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = value;
  }
  return out as T;
}

/**
 * Busca no Supabase as medições sincronizadas por qualquer dispositivo e
 * traz para o banco local, para que apareçam no histórico/admin mesmo
 * quando foram registradas em outro celular/tablet/PC.
 */
export async function puxarAtualizacoes(): Promise<{ recebidos: number }> {
  if (!supabase || !navigator.onLine) return { recebidos: 0 };

  const { data: sessoesRemotas, error } = await supabase
    .from("sessoes_medicao")
    .select("*");
  if (error || !sessoesRemotas) return { recebidos: 0 };

  let recebidos = 0;

  for (const row of sessoesRemotas) {
    const remota = fromSnakeCase<SessaoMedicao>(row);
    const local = await db.sessoes.get(remota.id);

    // Nunca sobrescreve uma edição feita neste dispositivo que ainda não subiu.
    if (local && local.status === "PENDENTE_SYNC") continue;

    await db.sessoes.put({
      ...remota,
      status: "SINCRONIZADO",
      sincronizadoEm: local?.sincronizadoEm ?? new Date().toISOString(),
    });

    const linhasTable = TABELA_LOCAL_POR_TIPO[remota.tipoFicha];
    const { data: linhasRemotas } = await supabase
      .from(TABELA_POR_TIPO[remota.tipoFicha])
      .select("*")
      .eq("sessao_id", remota.id);

    if (linhasRemotas) {
      await linhasTable.where("sessaoId").equals(remota.id).delete();
      const novasLinhas = linhasRemotas.map((linha) => {
        const { sessao_id, id, ...resto } = linha;
        void id;
        return { ...fromSnakeCase<Record<string, unknown>>(resto), sessaoId: sessao_id };
      });
      await (linhasTable as unknown as { bulkAdd: (items: unknown[]) => Promise<unknown> }).bulkAdd(
        novasLinhas
      );
    }

    recebidos++;
  }

  return { recebidos };
}
