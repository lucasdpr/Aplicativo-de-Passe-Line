import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
  type RGB,
} from "pdf-lib";
import type {
  SessaoMedicao,
  LinhaPassLineDesempenadeira,
  LinhaGap,
  LinhaEmpenoDesgaste,
  LeituraSegmento,
  TipoFicha,
} from "@/types";
import { TOLERANCIAS as TOLERANCIAS_MM } from "@/types";

const TITULOS: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "MEDIÇÃO E AJUSTE DE PASS-LINE (DESEMPENADEIRA)",
  GAP: "MEDIÇÃO E AJUSTE DE GAP",
  EMPENO_DESGASTE: "MEDIÇÃO DE EMPENO E DESGASTE (DESEMPENADEIRA)",
  PASS_LINE_SEGMENTOS: "MEDIÇÃO E AJUSTE DE PASS-LINE DOS SEGMENTOS",
};

/**
 * Título com a máquina certa: as fichas de papel das MCC's #2 e 3 são as
 * mesmas; a MCC4 tem a dela. (Antes todo PDF saía "MCC'S #2 E 3", inclusive
 * os da MCC4.)
 */
function tituloDaFicha(sessao: SessaoMedicao) {
  const maquinas = sessao.maquina === "MCC4" ? "MCC #4" : "MCC'S #2 E 3";
  return `${TITULOS[sessao.tipoFicha]} ${maquinas}`;
}

/** Tolerância do Pass-Line dos Segmentos: ±1,00 nas MCC's #2 e 3, ±0,50 na MCC4. */
function toleranciaSegmentos(sessao: SessaoMedicao) {
  return sessao.maquina === "MCC4"
    ? TOLERANCIAS_MM.PASS_LINE_SEGMENTOS_MCC4
    : TOLERANCIAS_MM.PASS_LINE_SEGMENTOS;
}

function textoTolerancia(sessao: SessaoMedicao) {
  if (sessao.tipoFicha === "PASS_LINE_SEGMENTOS") {
    return `TOLERÂNCIA: +/- ${fmt(toleranciaSegmentos(sessao))}mm`;
  }
  return TOLERANCIAS[sessao.tipoFicha];
}

const TOLERANCIAS: Record<TipoFicha, string> = {
  PASS_LINE_DESEMPENADEIRA: "TOLERÂNCIA ENTRE ROLO E RÉGUA +/- 0,50",
  GAP: "",
  EMPENO_DESGASTE: "EMPENO/MAXIMO 2mm",
  PASS_LINE_SEGMENTOS: "",
};

type LinhasPorTipo = {
  PASS_LINE_DESEMPENADEIRA: LinhaPassLineDesempenadeira[];
  GAP: LinhaGap[];
  EMPENO_DESGASTE: LinhaEmpenoDesgaste[];
  PASS_LINE_SEGMENTOS: LeituraSegmento[];
};

const PAGE_W = 595.28; // A4 retrato (em pé) — do jeito que é impresso
const PAGE_H = 841.89;
const MARGIN = 32;

const COR_PRIMARIA = rgb(0.06, 0.25, 0.5); // azul escuro
const COR_PRIMARIA_MEDIA = rgb(0.13, 0.35, 0.62);
const COR_PRIMARIA_CLARA = rgb(0.88, 0.92, 0.97);
const COR_TEXTO = rgb(0.09, 0.11, 0.13);
const COR_TEXTO_SUAVE = rgb(0.42, 0.46, 0.5);
const COR_LINHA = rgb(0.82, 0.84, 0.86);
const COR_ZEBRA = rgb(0.965, 0.97, 0.975);
const BRANCO = rgb(1, 1, 1);

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return v.toFixed(2).replace(".", ",");
}

function fmtTexto(v: string | null | undefined) {
  return sanitizarTexto(v ?? "");
}

/**
 * A fonte padrão do PDF (WinAnsi) só desenha caracteres Latin-1. Texto vindo
 * do banco (ex.: nomes copiados de planilhas antigas com encoding quebrado)
 * pode ter caracteres fora disso, o que derruba a geração inteira do PDF.
 * Troca qualquer caractere não suportado por "?" em vez de falhar.
 */
function sanitizarTexto(v: string): string {
  return v.replace(/[^\x00-\xFF]/g, "?");
}

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

/** Abaixo disso fica a área de observação + assinaturas + rodapé. */
const LIMITE_INFERIOR = MARGIN + 70;

function novaPagina(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_W, PAGE_H]);
}

function cabecalho(ctx: Ctx, sessao: SessaoMedicao, versao?: string) {
  const { page, bold, font } = ctx;
  const top = PAGE_H - MARGIN;
  const faixaAltura = 32;

  // Faixa superior colorida com o título (identidade visual do app)
  page.drawRectangle({
    x: MARGIN,
    y: top - faixaAltura,
    width: PAGE_W - MARGIN * 2,
    height: faixaAltura,
    color: COR_PRIMARIA,
  });
  const selo = "CSN";
  const seloLargura = bold.widthOfTextAtSize(selo, 13) + 20;
  const seloX = PAGE_W - MARGIN - 8 - seloLargura;
  page.drawRectangle({
    x: seloX,
    y: top - faixaAltura + 6,
    width: seloLargura,
    height: faixaAltura - 12,
    color: BRANCO,
  });
  page.drawText(selo, {
    x: seloX + 10,
    y: top - faixaAltura / 2 - 4,
    size: 13,
    font: bold,
    color: COR_PRIMARIA,
  });

  let limiteTitulo = seloX - 10;
  if (versao) {
    const tamanho = 7.5;
    const largura = bold.widthOfTextAtSize(versao, tamanho) + 16;
    const x = seloX - 10 - largura;
    limiteTitulo = x - 10;
    page.drawRectangle({
      x,
      y: top - faixaAltura + 9,
      width: largura,
      height: faixaAltura - 18,
      borderColor: BRANCO,
      borderWidth: 0.8,
      color: COR_PRIMARIA,
    });
    page.drawText(versao, {
      x: x + 8,
      y: top - faixaAltura / 2 - 2.6,
      size: tamanho,
      font: bold,
      color: BRANCO,
    });
  }

  // Título encolhe se não couber (a página em pé é mais estreita)
  const titulo = tituloDaFicha(sessao);
  const larguraTitulo = limiteTitulo - (MARGIN + 14);
  const tamanhoTitulo = Math.min(12, (12 * larguraTitulo) / bold.widthOfTextAtSize(titulo, 12));
  page.drawText(titulo, {
    x: MARGIN + 14,
    y: top - faixaAltura / 2 - tamanhoTitulo / 3,
    size: tamanhoTitulo,
    font: bold,
    color: BRANCO,
  });

  // Faixa de metadados da sessão
  const metaTop = top - faixaAltura;
  const metaAltura = 30;
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
      sanitizarTexto(`${sessao.tecnicoNome} / ${sessao.tecnicoMatricula}`),
    ],
  ];
  const larguras = [80, 55, 85, 300];
  let x = MARGIN + 14;
  campos.forEach(([label, valor], i) => {
    page.drawText(label, {
      x,
      y: metaTop - 12,
      size: 6.5,
      font: bold,
      color: COR_TEXTO_SUAVE,
    });
    page.drawText(valor, {
      x,
      y: metaTop - 24,
      size: 9,
      font,
      color: COR_TEXTO,
    });
    x += larguras[i];
  });

  ctx.y = metaTop - metaAltura - 8;

  const tolerancia = textoTolerancia(sessao);
  if (tolerancia) {
    page.drawText(tolerancia, {
      x: MARGIN,
      y: ctx.y - 6,
      size: 8,
      font: bold,
      color: COR_PRIMARIA,
    });
    ctx.y -= 16;
  }
}

/** Linha de informação logo abaixo do cabeçalho: texto à esquerda + legenda à direita. */
function linhaInfo(
  ctx: Ctx,
  esquerda: string,
  legenda: { cor: RGB; fundo: RGB; texto: string }[] = []
) {
  let y = ctx.y - 6;
  ctx.page.drawText(esquerda, { x: MARGIN, y, size: 8, font: ctx.bold, color: COR_PRIMARIA });
  const larguraLegenda = legenda.reduce(
    (s, item) => s + ctx.font.widthOfTextAtSize(item.texto, 7) + 26,
    0
  );
  // Não coube do lado — a legenda desce pra linha de baixo
  if (
    legenda.length > 0 &&
    ctx.bold.widthOfTextAtSize(esquerda, 8) + larguraLegenda + 20 > PAGE_W - MARGIN * 2
  ) {
    y -= 12;
    ctx.y -= 12;
  }

  let x = PAGE_W - MARGIN;
  for (const item of [...legenda].reverse()) {
    const largura = ctx.font.widthOfTextAtSize(item.texto, 7);
    x -= largura;
    ctx.page.drawText(item.texto, { x, y, size: 7, font: ctx.font, color: COR_TEXTO_SUAVE });
    x -= 12;
    ctx.page.drawRectangle({
      x,
      y: y - 1,
      width: 8,
      height: 8,
      color: item.fundo,
      borderColor: item.cor,
      borderWidth: 0.8,
    });
    x -= 14;
  }
  ctx.y -= 16;
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

/** Observação + assinaturas — só na última página. */
function rodape(ctx: Ctx, sessao: SessaoMedicao) {
  const { page, font, bold } = ctx;
  const yAssinaturas = MARGIN + 22;
  const largura = 220;

  if (sessao.observacao) {
    page.drawText("OBSERVAÇÃO", {
      x: MARGIN,
      y: yAssinaturas + 34,
      size: 6.5,
      font: bold,
      color: COR_TEXTO_SUAVE,
    });
    page.drawText(sanitizarTexto(sessao.observacao), {
      x: MARGIN,
      y: yAssinaturas + 23,
      size: 8.5,
      font,
      color: COR_TEXTO,
      maxWidth: PAGE_W - MARGIN * 2,
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
    sanitizarTexto(sessao.inspecionadoPor ?? "")
  );
  linhaAssinatura(
    page,
    font,
    bold,
    MARGIN + largura + 40,
    yAssinaturas,
    largura,
    "LIBERADO POR",
    sanitizarTexto(sessao.liberadoPor ?? "")
  );
}

/** Numeração "página X de Y" + data de geração em todas as páginas. */
function numerarPaginas(doc: PDFDocument, font: PDFFont) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const paginas = doc.getPages();
  paginas.forEach((page, i) => {
    const texto = `Gerado em ${geradoEm}  |  Página ${i + 1} de ${paginas.length}`;
    const largura = font.widthOfTextAtSize(texto, 7);
    page.drawText(texto, {
      x: PAGE_W - MARGIN - largura,
      y: MARGIN - 12,
      size: 7,
      font,
      color: COR_TEXTO_SUAVE,
    });
  });
}

interface Coluna {
  header: string;
  width: number;
  /** Números ficam centralizados; texto (ex.: ajuste) alinhado à esquerda. */
  alinhar?: "esquerda" | "centro";
}

/** Grupo de colunas no cabeçalho (ex.: "1ª MEDIÇÃO" sobre 3 colunas). Título vazio = sem grupo. */
interface GrupoColunas {
  titulo: string;
  colunas: number;
}

interface EstiloCelula {
  cor?: RGB;
  fundo?: RGB;
  negrito?: boolean;
}

interface OpcoesTabela {
  alturaLinha?: number;
  grupos?: GrupoColunas[];
  /** Estica as colunas proporcionalmente pra ocupar a largura toda da página. */
  larguraTotal?: boolean;
  estiloCelula?: (linha: number, coluna: number) => EstiloCelula | undefined;
  /** Tenta encolher a altura da linha pra tabela caber numa página só. */
  caberNumaPagina?: boolean;
}

const ALTURA_CABECALHO = 13;

function larguraTexto(font: PDFFont, texto: string, tamanho: number) {
  return font.widthOfTextAtSize(texto, tamanho);
}

/** Tamanho de fonte que faz o texto caber na largura (sem passar de `maximo`). */
function tamanhoQueCabe(font: PDFFont, texto: string, maximo: number, largura: number) {
  const w = larguraTexto(font, texto, maximo);
  return w <= largura ? maximo : Math.max(5, (maximo * largura) / w);
}

/** Corta o texto com "..." se não couber na coluna. */
function caber(font: PDFFont, texto: string, tamanho: number, largura: number) {
  if (larguraTexto(font, texto, tamanho) <= largura) return texto;
  let t = texto;
  while (t.length > 0 && larguraTexto(font, t + "...", tamanho) > largura) {
    t = t.slice(0, -1);
  }
  return t + "...";
}

function desenharTextoCelula(
  ctx: Ctx,
  texto: string,
  x: number,
  largura: number,
  yBase: number,
  tamanho: number,
  font: PDFFont,
  cor: RGB,
  alinhar: "esquerda" | "centro"
) {
  const t = caber(font, texto, tamanho, largura - 6);
  const w = larguraTexto(font, t, tamanho);
  ctx.page.drawText(t, {
    x: alinhar === "centro" ? x + (largura - w) / 2 : x + 4,
    y: yBase,
    size: tamanho,
    font,
    color: cor,
  });
}

function desenharCabecalhoTabela(
  ctx: Ctx,
  colunas: Coluna[],
  grupos: GrupoColunas[] | undefined
) {
  const totalWidth = colunas.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN;
  const headerY = ctx.y;
  const linhasCab = grupos ? 2 : 1;
  const altura = ALTURA_CABECALHO * linhasCab;

  ctx.page.drawRectangle({
    x: startX,
    y: headerY - altura,
    width: totalWidth,
    height: altura,
    color: COR_PRIMARIA,
  });

  // Mapa coluna -> grupo com título (colunas sem grupo ocupam as 2 linhas)
  const temGrupo: boolean[] = [];
  if (grupos) {
    let x = startX;
    let col = 0;
    for (const g of grupos) {
      const largura = colunas
        .slice(col, col + g.colunas)
        .reduce((s, c) => s + c.width, 0);
      for (let i = 0; i < g.colunas; i++) temGrupo[col + i] = !!g.titulo;
      if (g.titulo) {
        // Sub-cabeçalho do grupo com um tom um pouco mais claro, alinhado
        // exatamente com as colunas do grupo.
        ctx.page.drawRectangle({
          x,
          y: headerY - ALTURA_CABECALHO * 2,
          width: largura,
          height: ALTURA_CABECALHO,
          color: COR_PRIMARIA_MEDIA,
        });
        desenharTextoCelula(ctx, g.titulo, x, largura, headerY - ALTURA_CABECALHO + 4, 7, ctx.bold, BRANCO, "centro");
        ctx.page.drawLine({
          start: { x, y: headerY - ALTURA_CABECALHO },
          end: { x: x + largura, y: headerY - ALTURA_CABECALHO },
          thickness: 0.6,
          color: BRANCO,
        });
      }
      x += largura;
      col += g.colunas;
    }
  }

  let x = startX;
  colunas.forEach((col, i) => {
    const yTexto = grupos
      ? temGrupo[i]
        ? headerY - altura + 4
        : headerY - altura / 2 - 2.5
      : headerY - altura + 4;
    const tamanho = tamanhoQueCabe(ctx.bold, col.header, 6.5, col.width - 6);
    desenharTextoCelula(ctx, col.header, x, col.width, yTexto, tamanho, ctx.bold, BRANCO, "centro");
    x += col.width;
  });

  // Divisórias verticais no cabeçalho, alinhadas com a grade da tabela:
  // entre grupos a linha ocupa o cabeçalho todo; dentro de um grupo, só a
  // linha dos sub-títulos.
  const inicioGrupo = new Set<number>();
  if (grupos) {
    let c = 0;
    for (const g of grupos) {
      inicioGrupo.add(c);
      c += g.colunas;
    }
  }
  let xDiv = startX;
  colunas.forEach((col, i) => {
    if (i > 0) {
      const divisaGrupo = !grupos || inicioGrupo.has(i);
      const inteira = divisaGrupo || !temGrupo[i];
      ctx.page.drawLine({
        start: { x: xDiv, y: inteira ? headerY : headerY - ALTURA_CABECALHO },
        end: { x: xDiv, y: headerY - altura },
        thickness: divisaGrupo ? 0.8 : 0.4,
        color: BRANCO,
        opacity: divisaGrupo ? 0.7 : 0.45,
      });
    }
    xDiv += col.width;
  });

  ctx.y = headerY - altura;
}

/** Bordas verticais (grades) da tabela, desenhadas quando a página fecha. */
function desenharGrade(
  ctx: Ctx,
  colunas: Coluna[],
  grupos: GrupoColunas[] | undefined,
  topo: number,
  base: number
) {
  const totalWidth = colunas.reduce((s, c) => s + c.width, 0);
  const inicioGrupo = new Set<number>();
  if (grupos) {
    let col = 0;
    for (const g of grupos) {
      inicioGrupo.add(col);
      col += g.colunas;
    }
  }
  const alturaCab = ALTURA_CABECALHO * (grupos ? 2 : 1);
  let x = MARGIN;
  colunas.forEach((col, i) => {
    if (i > 0) {
      const divisaGrupo = inicioGrupo.has(i);
      ctx.page.drawLine({
        start: { x, y: topo - alturaCab },
        end: { x, y: base },
        thickness: divisaGrupo ? 1 : 0.4,
        color: divisaGrupo ? COR_TEXTO_SUAVE : COR_LINHA,
      });
    }
    x += col.width;
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: base,
    width: totalWidth,
    height: topo - base,
    borderColor: COR_TEXTO_SUAVE,
    borderWidth: 0.8,
  });
}

function desenharTabela(
  ctx: Ctx,
  colunasBase: Coluna[],
  linhas: string[][],
  opcoes: OpcoesTabela = {}
) {
  const { grupos, estiloCelula } = opcoes;
  const larguraBase = colunasBase.reduce((s, c) => s + c.width, 0);
  const disponivelX = PAGE_W - MARGIN * 2;
  // Estica pra largura toda se pedido; encolhe sempre que não caberia na página.
  const fator =
    opcoes.larguraTotal || larguraBase > disponivelX ? disponivelX / larguraBase : 1;
  const colunas = colunasBase.map((c) => ({ ...c, width: c.width * fator }));
  const totalWidth = colunas.reduce((s, c) => s + c.width, 0);
  const startX = MARGIN;
  const alturaCab = ALTURA_CABECALHO * (grupos ? 2 : 1);

  let alturaLinha = opcoes.alturaLinha ?? 14;
  if (opcoes.caberNumaPagina && linhas.length > 0) {
    const disponivel = ctx.y - LIMITE_INFERIOR - alturaCab;
    const cabe = disponivel / linhas.length;
    // Não encolhe abaixo de 10pt — fica ilegível; aí é melhor quebrar página.
    if (cabe < alturaLinha) alturaLinha = Math.max(10, cabe);
  }
  const tamanhoFonte = alturaLinha < 12 ? 7 : 7.5;

  let topoPagina = ctx.y;
  desenharCabecalhoTabela(ctx, colunas, grupos);

  linhas.forEach((linha, idx) => {
    if (ctx.y - alturaLinha < LIMITE_INFERIOR) {
      desenharGrade(ctx, colunas, grupos, topoPagina, ctx.y);
      ctx.page = novaPagina(ctx.doc);
      ctx.y = PAGE_H - MARGIN;
      ctx.page.drawText("(continuação)", {
        x: startX,
        y: ctx.y - 10,
        size: 8,
        font: ctx.font,
        color: COR_TEXTO_SUAVE,
      });
      ctx.y -= 18;
      topoPagina = ctx.y;
      desenharCabecalhoTabela(ctx, colunas, grupos);
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
      const estilo = estiloCelula?.(idx, i);
      if (estilo?.fundo) {
        ctx.page.drawRectangle({
          x,
          y: y - alturaLinha,
          width: colunas[i].width,
          height: alturaLinha,
          color: estilo.fundo,
        });
      }
      desenharTextoCelula(
        ctx,
        linha[i] ?? "",
        x,
        colunas[i].width,
        y - alturaLinha + (alturaLinha - tamanhoFonte) / 2 + 1.2,
        tamanhoFonte,
        estilo?.negrito || i === 0 ? ctx.bold : ctx.font,
        estilo?.cor ?? COR_TEXTO,
        colunas[i].alinhar ?? "esquerda"
      );
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

  desenharGrade(ctx, colunas, grupos, topoPagina, ctx.y);
  ctx.y -= 12;
}

// --- GAP ---

const COR_FORA = rgb(0.72, 0.09, 0.09);
const COR_FORA_FUNDO = rgb(0.99, 0.89, 0.89);
const COR_OK = rgb(0.08, 0.47, 0.22);
const COR_OK_FUNDO = rgb(0.88, 0.96, 0.9);
const COR_PRIMEIRA = rgb(0.55, 0.38, 0.02);
const COR_PRIMEIRA_FUNDO = rgb(1, 0.96, 0.84);

/** |valor| passou do limite (com folga pra erro de ponto flutuante). */
function foraDoLimite(valor: number | null | undefined, limite: number) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return false;
  return Math.abs(valor) > limite + 1e-9;
}

function foraGap(valor: number | null | undefined, l: LinhaGap) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return false;
  if (l.toleranciaMm === null || l.toleranciaMm === undefined) return false;
  // Pequena folga pra erro de ponto flutuante (ex.: 260,5 - 260,0 = 0,5000001)
  return Math.abs(valor - l.gapNominal) > l.toleranciaMm + 1e-9;
}

function textoToleranciaGap(dados: LinhaGap[]) {
  const tolerancias = new Set(
    dados.map((l) => l.toleranciaMm).filter((t) => t !== null && t !== undefined)
  );
  if (tolerancias.size === 1) {
    return `TOLERÂNCIA: +/- ${fmt([...tolerancias][0])} mm EM RELAÇÃO AO GAP NOMINAL`;
  }
  return "TOLERÂNCIA: CONFORME COLUNA \"TOL. +/-\" (EM RELAÇÃO AO GAP NOMINAL)";
}

const LEGENDA_FORA = { cor: COR_FORA, fundo: COR_FORA_FUNDO, texto: "Fora da tolerância" };

function pdfGapCompleto(ctx: Ctx, dados: LinhaGap[]) {
  linhaInfo(ctx, textoToleranciaGap(dados), [LEGENDA_FORA]);

  const medidas: (keyof LinhaGap)[] = [
    "primeiraAcionado",
    "primeiraCentro",
    "primeiraNaoAcionado",
    "ajusteAcionado",
    "ajusteNaoAcionado",
    "segundaAcionado",
    "segundaCentro",
    "segundaNaoAcionado",
  ];
  const ehAjuste = (k: keyof LinhaGap) => k === "ajusteAcionado" || k === "ajusteNaoAcionado";

  desenharTabela(
    ctx,
    [
      { header: "Nº CAD", width: 42, alinhar: "centro" },
      { header: "GAP NOM.", width: 50, alinhar: "centro" },
      { header: "TOL. +/-", width: 42, alinhar: "centro" },
      { header: "ACIONADO", width: 58, alinhar: "centro" },
      { header: "CENTRO", width: 58, alinhar: "centro" },
      { header: "NÃO ACION.", width: 62, alinhar: "centro" },
      { header: "ACIONADO", width: 70 },
      { header: "NÃO ACION.", width: 70 },
      { header: "ACIONADO", width: 58, alinhar: "centro" },
      { header: "CENTRO", width: 58, alinhar: "centro" },
      { header: "NÃO ACION.", width: 62, alinhar: "centro" },
    ],
    dados.map((l) => [
      String(l.nCad),
      fmt(l.gapNominal),
      fmt(l.toleranciaMm),
      ...medidas.map((k) =>
        ehAjuste(k) ? fmtTexto(l[k] as string | undefined) : fmt(l[k] as number | undefined)
      ),
    ]),
    {
      larguraTotal: true,
      caberNumaPagina: true,
      grupos: [
        { titulo: "", colunas: 3 },
        { titulo: "1ª MEDIÇÃO", colunas: 3 },
        { titulo: "AJUSTE", colunas: 2 },
        { titulo: "2ª MEDIÇÃO", colunas: 3 },
      ],
      estiloCelula: (linha, coluna) => {
        const campo = medidas[coluna - 3];
        if (!campo || ehAjuste(campo)) return undefined;
        const l = dados[linha];
        return foraGap(l[campo] as number | undefined, l)
          ? { cor: COR_FORA, fundo: COR_FORA_FUNDO, negrito: true }
          : undefined;
      },
    }
  );
}

function pdfGapAtualizado(ctx: Ctx, dados: LinhaGap[]) {
  linhaInfo(ctx, textoToleranciaGap(dados), [
    { cor: COR_PRIMEIRA, fundo: COR_PRIMEIRA_FUNDO, texto: "* Valor da 1ª medição (2ª não registrada)" },
    LEGENDA_FORA,
  ]);

  const lados: [keyof LinhaGap, keyof LinhaGap][] = [
    ["segundaAcionado", "primeiraAcionado"],
    ["segundaCentro", "primeiraCentro"],
    ["segundaNaoAcionado", "primeiraNaoAcionado"],
  ];

  // Por lado: usa a 2ª medição (medida final, depois do ajuste) quando ela
  // existe; senão cai pra 1ª. Guarda de onde veio pra deixar claro no PDF.
  const linhasCalc = dados.map((l) => {
    const valores = lados.map(([segunda, primeira]) => {
      const v2 = l[segunda] as number | null | undefined;
      const v1 = l[primeira] as number | null | undefined;
      if (v2 !== null && v2 !== undefined) return { valor: v2, origem: 2 as const };
      if (v1 !== null && v1 !== undefined) return { valor: v1, origem: 1 as const };
      return { valor: undefined, origem: null };
    });
    const origens = new Set(valores.map((v) => v.origem).filter((o) => o !== null));
    const mista = origens.size > 1;
    const origem = mista ? "1ª / 2ª" : origens.has(2) ? "2ª" : origens.has(1) ? "1ª" : "";
    const preenchidos = valores.filter((v) => v.valor !== undefined);
    const fora = preenchidos.some((v) => foraGap(v.valor, l));
    const situacao = preenchidos.length === 0 ? "" : fora ? "FORA" : "OK";
    return { l, valores, mista, origem, situacao };
  });

  desenharTabela(
    ctx,
    [
      { header: "Nº CAD", width: 50, alinhar: "centro" },
      { header: "GAP NOMINAL", width: 70, alinhar: "centro" },
      { header: "TOL. +/-", width: 55, alinhar: "centro" },
      { header: "ACIONADO", width: 90, alinhar: "centro" },
      { header: "CENTRO", width: 90, alinhar: "centro" },
      { header: "NÃO ACIONADO", width: 90, alinhar: "centro" },
      { header: "MEDIÇÃO USADA", width: 70, alinhar: "centro" },
      { header: "SITUAÇÃO", width: 65, alinhar: "centro" },
    ],
    linhasCalc.map(({ l, valores, mista, origem, situacao }) => [
      String(l.nCad),
      fmt(l.gapNominal),
      fmt(l.toleranciaMm),
      ...valores.map((v) => fmt(v.valor) + (mista && v.origem === 1 ? "*" : "")),
      origem,
      situacao,
    ]),
    {
      larguraTotal: true,
      caberNumaPagina: true,
      grupos: [
        { titulo: "", colunas: 3 },
        { titulo: "MEDIDA ATUALIZADA", colunas: 3 },
        { titulo: "", colunas: 2 },
      ],
      estiloCelula: (linha, coluna) => {
        const calc = linhasCalc[linha];
        if (coluna >= 3 && coluna <= 5) {
          const v = calc.valores[coluna - 3];
          if (foraGap(v.valor, calc.l)) return { cor: COR_FORA, fundo: COR_FORA_FUNDO, negrito: true };
          if (calc.mista && v.origem === 1) return { cor: COR_PRIMEIRA, fundo: COR_PRIMEIRA_FUNDO };
          return undefined;
        }
        if (coluna === 7 && calc.situacao) {
          return calc.situacao === "OK"
            ? { cor: COR_OK, fundo: COR_OK_FUNDO, negrito: true }
            : { cor: COR_FORA, fundo: COR_FORA_FUNDO, negrito: true };
        }
        return undefined;
      },
    }
  );
}

export type ModoPdfGap = "TUDO" | "ATUALIZADO";

export async function gerarPdfSessao(
  sessao: SessaoMedicao,
  linhas: LinhasPorTipo[TipoFicha],
  modoGap: ModoPdfGap = "TUDO"
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = novaPagina(doc);
  const ctx: Ctx = { doc, font, bold, page, y: PAGE_H - MARGIN };

  const versaoGap =
    sessao.tipoFicha === "GAP"
      ? modoGap === "ATUALIZADO"
        ? "VERSÃO ATUALIZADA"
        : "VERSÃO COMPLETA"
      : undefined;
  cabecalho(ctx, sessao, versaoGap);

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
        ]),
        {
          // Ajuste fora de +/- 0,50 em vermelho (mesma regra do formulário).
          estiloCelula: (linha, coluna) => {
            const valor =
              coluna === 3 ? dados[linha].oesteAjuste : coluna === 6 ? dados[linha].lesteAjuste : undefined;
            return foraDoLimite(valor, TOLERANCIAS_MM.PASS_LINE_DESEMPENADEIRA)
              ? { cor: COR_FORA, fundo: COR_FORA_FUNDO, negrito: true }
              : undefined;
          },
        }
      );
      break;
    }
    case "GAP": {
      const dados = [...(linhas as LinhaGap[])].sort((a, b) => a.nCad - b.nCad);
      if (modoGap === "ATUALIZADO") pdfGapAtualizado(ctx, dados);
      else pdfGapCompleto(ctx, dados);
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
          fmtTexto(l.empenoSuperior),
          fmtTexto(l.empenoInferior),
          fmtTexto(l.empenoPar),
          fmt(l.desgasteSuperior),
          fmt(l.desgasteInferior),
          fmt(l.desgastePar),
        ])
      );
      break;
    }
    case "PASS_LINE_SEGMENTOS": {
      // Ordem: segmento em ordem numérica (1, 2, … 17 — antes era por
      // texto: 1, 10, 11, …, 2), depois lado acionado, depois posição.
      const ordemSegmento = (seg: string) => {
        const n = Number(seg);
        return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER; // "D" por último
      };
      const dados = [...(linhas as LeituraSegmento[])].sort(
        (a, b) =>
          ordemSegmento(a.segmento) - ordemSegmento(b.segmento) ||
          a.segmento.localeCompare(b.segmento) ||
          (a.lado === b.lado ? 0 : a.lado === "ACIONADO" ? -1 : 1) ||
          a.posicao - b.posicao
      );
      const tolerancia = toleranciaSegmentos(sessao);
      desenharTabela(
        ctx,
        [
          { header: "SEGMENTO", width: 70, alinhar: "centro" },
          { header: "LADO", width: 90 },
          { header: "POSIÇÃO", width: 60, alinhar: "centro" },
          { header: "VALOR", width: 70, alinhar: "centro" },
        ],
        dados.map((l) => [
          l.segmento,
          l.lado === "ACIONADO" ? "Acionado" : "Não acionado",
          String(l.posicao),
          fmt(l.valor),
        ]),
        {
          estiloCelula: (linha, coluna) =>
            coluna === 3 && foraDoLimite(dados[linha].valor, tolerancia)
              ? { cor: COR_FORA, fundo: COR_FORA_FUNDO, negrito: true }
              : undefined,
        }
      );
      break;
    }
  }

  rodape(ctx, sessao);
  numerarPaginas(doc, font);

  return doc.save();
}
