import Dexie, { type Table } from "dexie";
import type {
  SessaoMedicao,
  LinhaPassLineDesempenadeira,
  LinhaGap,
  LinhaEmpenoDesgaste,
  LeituraSegmento,
  Tecnico,
  Edicao,
} from "@/types";

export class PassLineDB extends Dexie {
  tecnicos!: Table<Tecnico, string>;
  sessoes!: Table<SessaoMedicao, string>;
  linhasPassLineDesempenadeira!: Table<
    LinhaPassLineDesempenadeira & { sessaoId: string; id?: number },
    number
  >;
  linhasGap!: Table<LinhaGap & { sessaoId: string; id?: number }, number>;
  linhasEmpenoDesgaste!: Table<
    LinhaEmpenoDesgaste & { sessaoId: string; id?: number },
    number
  >;
  leiturasSegmentos!: Table<
    LeituraSegmento & { sessaoId: string; id?: number },
    number
  >;
  edicoes!: Table<Edicao, number>;

  constructor() {
    super("passline-csn");
    this.version(1).stores({
      tecnicos: "id, matricula",
      sessoes: "id, tipoFicha, maquina, veio, data, status, tecnicoId",
      linhasPassLineDesempenadeira: "++id, sessaoId, nCad",
      linhasGap: "++id, sessaoId, nCad",
      linhasEmpenoDesgaste: "++id, sessaoId, nCad",
      leiturasSegmentos: "++id, sessaoId, segmento, lado",
    });
    this.version(2).stores({
      tecnicos: "id, matricula",
      sessoes: "id, tipoFicha, maquina, veio, data, status, tecnicoId, criadoEm",
      linhasPassLineDesempenadeira: "++id, sessaoId, nCad",
      linhasGap: "++id, sessaoId, nCad",
      linhasEmpenoDesgaste: "++id, sessaoId, nCad",
      leiturasSegmentos: "++id, sessaoId, segmento, lado",
    });
    this.version(3).stores({
      tecnicos: "id, matricula, isAdmin",
      sessoes: "id, tipoFicha, maquina, veio, data, status, tecnicoId, criadoEm",
      linhasPassLineDesempenadeira: "++id, sessaoId, nCad",
      linhasGap: "++id, sessaoId, nCad",
      linhasEmpenoDesgaste: "++id, sessaoId, nCad",
      leiturasSegmentos: "++id, sessaoId, segmento, lado",
    });
    this.version(4).stores({
      tecnicos: "id, matricula, isAdmin",
      sessoes: "id, tipoFicha, maquina, veio, data, status, tecnicoId, criadoEm",
      linhasPassLineDesempenadeira: "++id, sessaoId, nCad",
      linhasGap: "++id, sessaoId, nCad",
      linhasEmpenoDesgaste: "++id, sessaoId, nCad",
      leiturasSegmentos: "++id, sessaoId, segmento, lado",
      edicoes: "++id, sessaoId, editadoEm",
    });
    this.version(5).stores({
      tecnicos: "id, matricula, papel, aprovado",
      sessoes: "id, tipoFicha, maquina, veio, data, status, tecnicoId, criadoEm",
      linhasPassLineDesempenadeira: "++id, sessaoId, nCad",
      linhasGap: "++id, sessaoId, nCad",
      linhasEmpenoDesgaste: "++id, sessaoId, nCad",
      leiturasSegmentos: "++id, sessaoId, segmento, lado",
      edicoes: "++id, sessaoId, editadoEm",
    });
  }
}

export const db = new PassLineDB();
