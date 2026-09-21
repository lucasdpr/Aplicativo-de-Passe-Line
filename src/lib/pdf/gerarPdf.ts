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
const MARGIN = 32;

const COR_PRIMARIA = rgb(0.02, 0.42, 0.38); // teal escuro (marca do app)
const COR_PRIMARIA_CLARA = rgb(0.88, 0.95, 0.94);
const COR_TEXTO = rgb(0.09, 0.11, 0.13);
const COR_TEXTO_SUAVE = rgb(0.42, 0.46, 0.5);
const COR_LINHA = rgb(0.82, 0.84, 0.86);
const COR_ZEBRA = rgb(0.965, 0.97, 0.975);
const BRANCO = rgb(1, 1, 1);

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
  const faixaAltura = 40;

  // Faixa superior colorida com o título (identidade visual do app)
  page.drawRectangle({
    x: MARGIN,
    y: top - faixaAltura,
    width: PAGE_W - MARGIN * 2,
    height: faixaAltura,
    color: COR_PRIMARIA,
  });
  page.drawText(TITULOS[sessao.tipoFicha], {
    x: MARGIN + 14,
    y: top - faixaAltura / 2 - 4,
    size: 12,
    font: bold,
    color: BRANCO,
  });

  const selo = "CSN";
  const seloLargura = bold.widthOfTextAtSize(selo, 13) + 20;
  page.drawRectangle({
    x: PAGE_W - MARGIN - seloLargura,
    y: top - faixaAltura + 6,
    width: seloLargura,
    height: faixaAltura - 12,
    color: BRANCO,
  });
  page.drawText(selo, {
    x: PAGE_W - MARGIN - seloLargura + 10,
    y: top - faixaAltura / 2 - 4,
    size: 13,
    font: bold,
    color: COR_PRIMARIA,
  });

  // Faixa de metadados da sessão
  const metaTop = top - faixaAltura;
  const metaAltura = 34;
  page.drawRectangle({
    x: MARGIN,
    y: metaTop - metaAltura,
    width: PAGE_W - MARGIN * 2,
    height: metaAltura,
    color: COR_PRIMARIA_CLARA,
  });

  const campos: [string, string][] = [
    ["MÁQUINA", sessao.maquina],
    ["VEIO", sessao.veio],
    ["DATA", new Date(sessao.data + "T00:00:00").toLocaleDateString("pt-BR")],
    [
      "RESPONSÁVEL / MATR.",
      `${sessao.tecnicoNome} / ${sessao.tecnicoMatricula}`,
    ],
  ];
  const larguras = [90, 70, 100, 300];
  let x = MARGIN + 14;
  campos.forEach(([label, valor], i) => {
    page.drawText(label, {
      x,
      y: metaTop - 14,
      size: 6.5,
      font: bold,
      color: COR_TEXTO_SUAVE,
    });
    page.drawText(valor, {
      x,
      y: metaTop - 26,
      size: 9,
      font,
      color: COR_TEXTO,
    });
    x += larguras[i];
  });

  ctx.y = metaTop - metaAltura - 8;

  const tolerancia = TOLERANCIAS[sessao.tipoFicha];
  if (tolerancia) {
    page.drawText(tolerancia, {
      x: MARGIN,
      y: ctx.y,
      size: 8,
      font: bold,
      color: COR_PRIMARIA,
    });
    ctx.y -= 16;
  }
}

function linhaAssinatura(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  largura: number,
  label: string,
  valor: string
) {
  page.drawLine({
    start: { x, y },
    end: { x: x + largura, y },
    thickness: 0.75,
    color: COR_TEXTO_SUAVE,
  });
  if (valor) {
    page.drawText(valor, { x, y: y + 3, size: 9, font, color: COR_TEXTO });
  }
  page.drawText(label, {
    x,
    y: y - 10,
    size: 6.5,
    font: bold,
    color: COR_TEXTO_SUAVE,
  });
}

function rodape(ctx: Ctx, sessao: SessaoMedicao, pagina: number) {
  const { page, font, bold } = ctx;
  const yAssinaturas = MARGIN + 34;
  const largura = 220;

  if (sessao.observacao) {
    page.drawText("OBSERVAÇÃO", {
      x: MARGIN,
      y: yAssinaturas + 28,
      size: 6.5,
      font: bold,
      color: COR_TEXTO_SUAVE,
    });
    page.drawText(sessao.observacao, {
      x: MARGIN,
      y: yAssinaturas + 16,
      size: 8.5,
      font,
      color: COR_TEXTO,
    });
  }

  linhaAssinatura(
    page,
    font,
    bold,
    MARGIN,
    yAssinaturas,
    largura,
    "INSPECIONADO POR",
    sessao.inspecionadoPor ?? ""
  );
  linhaAssinatura(
    page,
    font,
    bold,
    MARGIN + largura + 40,
    yAssinaturas,
    largura,
    "LIBERADO POR",
    sessao.liberadoPor ?? ""
  );

  const geradoEm = new Date().toLocaleString("pt-BR");
  page.drawText(`Gerado em ${geradoEm} · página ${pagina}`, {
    x: PAGE_W - MARGIN - 200,
    y: MARGIN,
    size: 7,
    font,
    color: COR_TEXTO_SUAVE,
  });
}

function desenharCabecalhoTabela(
  ctx: Ctx,
  colunas: { header: string; width: number }[],
  alturaLinha: number
) {
  const totalWidth = colunas.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN;
  const headerY = ctx.y;

  ctx.page.drawRectangle({
    x: startX,
    y: headerY - alturaLinha,
    width: totalWidth,
    height: alturaLinha,
    color: COR_PRIMARIA,
  });

  let x = startX;
  for (const col of colunas) {
    ctx.page.drawText(col.header, {
      x: x + 4,
      y: headerY - alturaLinha + 4,
      size: 6.5,
      font: ctx.bold,
      color: BRANCO,
    });
    x += col.width;
  }

  ctx.y = headerY - alturaLinha;
}

function desenharTabela(
  ctx: Ctx,
  colunas: { header: string; width: number }[],
  linhas: string[][],
  alturaLinha = 14
) {
  const totalWidth = colunas.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN;

  desenharCabecalhoTabela(ctx, colunas, alturaLinha);

  linhas.forEach((linha, idx) => {
    if (ctx.y - alturaLinha < MARGIN + 60) {
      ctx.page = novaPagina(ctx.doc);
      ctx.y = PAGE_H - MARGIN;
      ctx.page.drawText("(continuação)", {
        x: startX,
        y: ctx.y - 12,
        size: 8,
        font: ctx.font,
        color: COR_TEXTO_SUAVE,
      });
      ctx.y -= 24;
      desenharCabecalhoTabela(ctx, colunas, alturaLinha);
    }

    const y = ctx.y;
    if (idx % 2 === 1) {
      ctx.page.drawRectangle({
        x: startX,
        y: y - alturaLinha,
        width: totalWidth,
        height: alturaLinha,
        color: COR_ZEBRA,
      });
    }

    let x = startX;
    for (let i = 0; i < colunas.length; i++) {
      ctx.page.drawText(linha[i] ?? "", {
        x: x + 4,
        y: y - alturaLinha + 4,
        size: 7.5,
        font: ctx.font,
        color: COR_TEXTO,
      });
      x += colunas[i].width;
    }
    ctx.page.drawLine({
      start: { x: startX, y: y - alturaLinha },
      end: { x: startX + totalWidth, y: y - alturaLinha },
      thickness: 0.4,
      color: COR_LINHA,
    });

    ctx.y = y - alturaLinha;
  });

  ctx.page.drawRectangle({
    x: startX,
    y: ctx.y,
    width: totalWidth,
    height: 1,
    color: COR_TEXTO_SUAVE,
  });

  ctx.y -= 12;
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

  rodape(ctx, sessao, doc.getPageCount());

  return doc.save();
}
