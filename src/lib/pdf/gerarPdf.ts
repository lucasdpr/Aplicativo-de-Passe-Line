import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type {
  SessaoMedicao,
  LinhaPassLineDesempenadeira,
  LinhaGap,
  LinhaEmpenoDesgaste,
  LeituraSegmento,
  TipoFicha,
} from "@/types";

const TITULOS: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA:
    "MEDIÇÃO E AJUSTE DE PASS-LINE (DESEMPENADEIRA) MCC'S #2 E 3",
  GAP: "MEDIÇÃO E AJUSTE DE GAP MCC'S #2 E 3",
  EMPENO_DESGASTE: "MEDIÇÃO DE EMPENO E DESGASTE (DESEMPENADEIRA) MCC'S #2 E 3",
  PASS_LINE_SEGMENTOS: "MEDIÇÃO E AJUSTE DE PASS-LINE DOS SEGMENTOS MCC'S #2 E 3",
};

const TOLERANCIAS: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "TOLERÂNCIA ENTRE ROLO E RÉGUA +/- 0,50",
  GAP: "",
  EMPENO_DESGASTE: "EMPENO/MAXIMO 2mm",
  PASS_LINE_SEGMENTOS: "TOLERÂNCIA: +/- 1,00mm",
};

type LinhasPorTipo = {
  PASS_LINE_DESEMPENADEIRA: LinhaPassLineDesempenadeira[];
  GAP: LinhaGap[];
  EMPENO_DESGASTE: LinhaEmpenoDesgaste[];
  PASS_LINE_SEGMENTOS: LeituraSegmento[];
};

const PAGE_W = 841.89; // A4 landscape
const PAGE_H = 595.28;
const MARGIN = 28;

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return v.toFixed(2).replace(".", ",");
}

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function novaPagina(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_W, PAGE_H]);
}

function cabecalho(ctx: Ctx, sessao: SessaoMedicao) {
  const { page, bold, font } = ctx;
  const top = PAGE_H - MARGIN;

  page.drawRectangle({
    x: MARGIN,
    y: top - 34,
    width: PAGE_W - MARGIN * 2,
    height: 34,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  page.drawText(TITULOS[sessao.tipoFicha], {
    x: MARGIN + 10,
    y: top - 22,
    size: 11,
    font: bold,
  });
  page.drawText(`${sessao.maquina}`, {
    x: PAGE_W - MARGIN - 90,
    y: top - 22,
    size: 11,
    font: bold,
  });
  page.drawRectangle({
    x: PAGE_W - MARGIN - 44,
    y: top - 30,
    width: 44,
    height: 26,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  page.drawText("CSN", {
    x: PAGE_W - MARGIN - 36,
    y: top - 22,
    size: 12,
    font: bold,
  });

  const linhaCampos = top - 34 - 18;
  const campos = [
    ["VEIO", sessao.veio],
    ["DATA", sessao.data],
    ["RESPONSÁVEL / MATR.", `${sessao.tecnicoNome} / ${sessao.tecnicoMatricula}`],
  ];
  let x = MARGIN;
  for (const [label, valor] of campos) {
    page.drawText(`${label}:`, { x, y: linhaCampos, size: 8, font: bold });
    page.drawText(valor, { x: x + 2, y: linhaCampos - 12, size: 9, font });
    x += 220;
  }

  const tolerancia = TOLERANCIAS[sessao.tipoFicha];
  if (tolerancia) {
    page.drawText(tolerancia, {
      x: MARGIN,
      y: linhaCampos - 28,
      size: 8,
      font: bold,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  ctx.y = linhaCampos - 44;
}

function rodape(ctx: Ctx, sessao: SessaoMedicao) {
  const { page, font, bold } = ctx;
  const y = MARGIN + 30;
  page.drawLine({
    start: { x: MARGIN, y: y + 14 },
    end: { x: PAGE_W - MARGIN, y: y + 14 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  const campos = [
    ["OBSERVAÇÃO", sessao.observacao ?? ""],
    ["INSPECIONADO POR", sessao.inspecionadoPor ?? ""],
    ["LIBERADO POR", sessao.liberadoPor ?? ""],
  ];
  let x = MARGIN;
  for (const [label, valor] of campos) {
    page.drawText(`${label}:`, { x, y, size: 7, font: bold });
    page.drawText(valor, { x, y: y - 11, size: 8, font });
    x += 260;
  }
}

function desenharTabela(
  ctx: Ctx,
  colunas: { header: string; width: number }[],
  linhas: string[][],
  alturaLinha = 13
) {
  const { page, font, bold } = ctx;
  const totalWidth = colunas.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN;
  let y = ctx.y;
  const headerY = y;

  page.drawRectangle({
    x: startX,
    y: headerY - alturaLinha,
    width: totalWidth,
    height: alturaLinha,
    color: rgb(0.92, 0.92, 0.92),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.75,
  });

  let x = startX;
  for (const col of colunas) {
    page.drawText(col.header, {
      x: x + 3,
      y: headerY - alturaLinha + 3,
      size: 6.5,
      font: bold,
    });
    page.drawLine({
      start: { x, y: headerY },
      end: { x, y: headerY - alturaLinha },
      thickness: 0.5,
    });
    x += col.width;
  }
  page.drawLine({
    start: { x, y: headerY },
    end: { x, y: headerY - alturaLinha },
    thickness: 0.75,
  });

  y = headerY - alturaLinha;

  for (const linha of linhas) {
    if (y - alturaLinha < MARGIN + 60) {
      ctx.page = novaPagina(ctx.doc);
      ctx.y = PAGE_H - MARGIN;
      y = ctx.y;
      x = startX;
      page.drawText("(continuação)", { x: startX, y: y - 10, size: 8, font });
      y -= 20;
    }
    x = startX;
    ctx.page.drawRectangle({
      x: startX,
      y: y - alturaLinha,
      width: totalWidth,
      height: alturaLinha,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
    });
    for (let i = 0; i < colunas.length; i++) {
      ctx.page.drawText(linha[i] ?? "", {
        x: x + 3,
        y: y - alturaLinha + 3,
        size: 7,
        font,
      });
      ctx.page.drawLine({
        start: { x, y },
        end: { x, y: y - alturaLinha },
        thickness: 0.4,
      });
      x += colunas[i].width;
    }
    ctx.page.drawLine({
      start: { x, y },
      end: { x, y: y - alturaLinha },
      thickness: 0.5,
    });
    y -= alturaLinha;
  }

  ctx.y = y - 10;
}

export async function gerarPdfSessao(
  sessao: SessaoMedicao,
  linhas: LinhasPorTipo[TipoFicha]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = novaPagina(doc);
  const ctx: Ctx = { doc, font, bold, page, y: PAGE_H - MARGIN };

  cabecalho(ctx, sessao);

  switch (sessao.tipoFicha) {
    case "PASS_LINE_DESEMPENADEIRA": {
      const dados = linhas as LinhaPassLineDesempenadeira[];
      desenharTabela(
        ctx,
        [
          { header: "Nº CAD", width: 45 },
          { header: "OESTE MEDIDA", width: 70 },
          { header: "OESTE ACIONADO", width: 70 },
          { header: "OESTE AJUSTE", width: 65 },
          { header: "LESTE MEDIDA", width: 70 },
          { header: "LESTE ACIONADO", width: 70 },
          { header: "LESTE AJUSTE", width: 65 },
        ],
        dados.map((l) => [
          String(l.nCad),
          fmt(l.oesteMedida),
          fmt(l.oesteAcionado),
          fmt(l.oesteAjuste),
          fmt(l.lesteMedida),
          fmt(l.lesteAcionado),
          fmt(l.lesteAjuste),
        ])
      );
      break;
    }
    case "GAP": {
      const dados = linhas as LinhaGap[];
      desenharTabela(
        ctx,
        [
          { header: "Nº CAD", width: 40 },
          { header: "GAP", width: 45 },
          { header: "TOL. ±", width: 40 },
          { header: "1ª ACIONADO", width: 60 },
          { header: "1ª CENTRO", width: 55 },
          { header: "1ª NÃO ACIO.", width: 60 },
          { header: "AJUSTE ACIO.", width: 60 },
          { header: "AJUSTE NÃO ACIO.", width: 65 },
          { header: "2ª ACIONADO", width: 60 },
          { header: "2ª CENTRO", width: 55 },
          { header: "2ª NÃO ACIO.", width: 60 },
        ],
        dados.map((l) => [
          String(l.nCad),
          fmt(l.gapNominal),
          fmt(l.toleranciaMm),
          fmt(l.primeiraAcionado),
          fmt(l.primeiraCentro),
          fmt(l.primeiraNaoAcionado),
          fmt(l.ajusteAcionado),
          fmt(l.ajusteNaoAcionado),
          fmt(l.segundaAcionado),
          fmt(l.segundaCentro),
          fmt(l.segundaNaoAcionado),
        ])
      );
      break;
    }
    case "EMPENO_DESGASTE": {
      const dados = linhas as LinhaEmpenoDesgaste[];
      desenharTabela(
        ctx,
        [
          { header: "Nº CAD", width: 50 },
          { header: "EMPENO SUPERIOR", width: 90 },
          { header: "EMPENO INFERIOR", width: 90 },
          { header: "EMPENO PAR", width: 80 },
          { header: "DESGASTE SUPERIOR", width: 95 },
          { header: "DESGASTE INFERIOR", width: 95 },
          { header: "DESGASTE PAR", width: 80 },
        ],
        dados.map((l) => [
          String(l.nCad),
          fmt(l.empenoSuperior),
          fmt(l.empenoInferior),
          fmt(l.empenoPar),
          fmt(l.desgasteSuperior),
          fmt(l.desgasteInferior),
          fmt(l.desgastePar),
        ])
      );
      break;
    }
    case "PASS_LINE_SEGMENTOS": {
      const dados = linhas as LeituraSegmento[];
      desenharTabela(
        ctx,
        [
          { header: "SEGMENTO", width: 70 },
          { header: "LADO", width: 90 },
          { header: "POSIÇÃO", width: 60 },
          { header: "VALOR", width: 70 },
        ],
        dados
          .sort((a, b) =>
            a.segmento === b.segmento
              ? a.posicao - b.posicao
              : a.segmento.localeCompare(b.segmento)
          )
          .map((l) => [
            l.segmento,
            l.lado === "ACIONADO" ? "Acionado" : "Não acionado",
            String(l.posicao),
            fmt(l.valor),
          ])
      );
      break;
    }
  }

  rodape(ctx, sessao);

  return doc.save();
}
