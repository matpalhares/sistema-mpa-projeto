// Proposta comercial (módulo P02). Regras: capa full-bleed com logo grande e sem foto, carta em 1ª pessoa,
// "Por que investir em um bom projeto" sem preço, escopo, 4 a 6 etapas, investimento em um card,
// termos e assinaturas, encerramento com logo e QR codes, marca d'água discreta, sem travessão longo.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeightRule, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  ImageRun, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TabStopType, TextRun, TextWrappingType,
  VerticalAlign, VerticalPositionAlign, VerticalPositionRelativeFrom, WidthType,
} from "docx";
import type { DadosProposta, Empresa } from "../tipos";
import { A_DEFINIR } from "../tipos";
import { dataExtenso, moeda, somarDias } from "../formato";
import { cores, fabrica, imagem, PAGINA_A, PAGINA_L, semBordas, AMARELO } from "./comum";

const MARGEM = 1134;
const LARGURA = PAGINA_L - 2 * MARGEM; // 9638

export * from "./regras-proposta";
import { calcularPagamento } from "./regras-proposta";

export async function gerarPropostaDocx(empresa: Empresa, d: DadosProposta): Promise<Buffer> {
  const m = empresa.marca;
  const c = cores(m);
  const f = fabrica(c);
  const { t, p, espaco, titulo, celula, cartao, aDefinir } = f;
  const [logoClaro, marcaDagua, qrWa, qrIg] = await Promise.all([
    imagem(m.logoClaro), imagem(m.marcaDagua), imagem(m.qrWhatsapp), imagem(m.qrInstagram),
  ]);
  const img = (data: Buffer, largura: number, proporcao = 280 / 900) =>
    new ImageRun({ type: "png", data, transformation: { width: largura, height: Math.round(largura * proporcao) } });
  const centro = (filhos: (ReturnType<typeof t> | ImageRun)[], depois = 120) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: depois }, children: filhos });
  const validade = d.validadeDias != null ? dataExtenso(somarDias(d.data, d.validadeDias)) : null;
  const calc = calcularPagamento(d);

  // ---------- CAPA (full-bleed, sem foto) ----------
  const capa = new Table({
    width: { size: PAGINA_L, type: WidthType.DXA }, columnWidths: [PAGINA_L],
    rows: [new TableRow({
      height: { value: PAGINA_A - 40, rule: HeightRule.EXACT },
      children: [celula([
        ...(logoClaro ? [centro([img(logoClaro, 520)], 600)] : [centro([t(empresa.nome.toUpperCase(), { size: 44, bold: true, color: c.dourado })], 700)]),
        centro([t("PROPOSTA COMERCIAL", { size: 22, bold: true, color: c.dourado, characterSpacing: 160 })], 200),
        centro([d.objetivo.trim() ? t(d.objetivo.toUpperCase(), { size: 40, bold: true, color: "FFFFFF" }) : aDefinir("objetivo a definir", { size: 40 })], 500),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, indent: { left: 4200, right: 4200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: c.dourado, space: 1 } }, children: [] }),
        centro([t("PREPARADA PARA", { size: 16, color: c.begeLinha, characterSpacing: 100 })], 80),
        centro([d.clienteNome.trim() ? t(d.clienteNome, { size: 30, bold: true, color: "FFFFFF" }) : aDefinir("cliente a definir", { size: 30 })], 500),
        centro([t(dataExtenso(d.data), { size: 18, color: c.begeLinha })], 60),
        centro([t("Válida até ", { size: 18, color: c.begeLinha }), validade ? t(validade, { size: 18, color: c.begeLinha }) : aDefinir(A_DEFINIR, { size: 18 })], 0),
      ], { fundo: c.azul, largura: PAGINA_L, margem: 0, vertical: VerticalAlign.CENTER })],
    })],
  });

  // ---------- CABEÇALHO, RODAPÉ E MARCA D'ÁGUA ----------
  const cabecalho = new Header({ children: [
    new Paragraph({
      spacing: { after: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c.dourado, space: 6 } },
      children: [
        t(empresa.nome.toUpperCase(), { size: 14, bold: true, color: c.azul, characterSpacing: 60 }),
        t("\t" + m.registro, { size: 14, color: c.dourado }),
        ...(marcaDagua ? [new ImageRun({
          type: "png", data: marcaDagua, transformation: { width: 520, height: 162 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
            behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE },
          },
        })] : []),
      ],
    }),
  ] });
  const rodape = new Footer({ children: [
    new Paragraph({
      spacing: { before: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: c.begeLinha, space: 6 } },
      children: [
        t(`${m.telefone}  ·  ${m.instagram}  ·  ${m.responsavelTecnico}`, { size: 13, color: "6B7280" }),
        new TextRun({ children: ["\t", PageNumber.CURRENT], font: c.fonte, size: 13, color: c.dourado }),
      ],
    }),
  ] });

  const paragrafos = (texto: string) => texto.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
    .map((x) => p([t(x)], { alignment: AlignmentType.JUSTIFIED }));

  // ---------- CARTA ----------
  const corpo: (Paragraph | Table)[] = [
    ...titulo("Apresentação", "Uma conversa antes do projeto"),
    p([t("Olá, "), d.clienteNome.trim() ? t(d.clienteNome.split(" ")[0] + ".", { bold: true }) : aDefinir("cliente")]),
    ...paragrafos(d.carta),
    p([t(m.responsavelTecnico, { bold: true, color: c.azul })], { spacing: { before: 200, after: 0 } }),
    p([t(m.registro, { size: 16, color: c.dourado })]),

    // ---------- POR QUE INVESTIR ----------
    ...titulo("Valor", "Por que investir em um bom projeto"),
    cartao(paragrafos(d.porQueInvestir), LARGURA),

    // ---------- ESCOPO ----------
    ...titulo("Escopo", "O que você vai receber"),
    p([t("Objetivo: ", { bold: true, color: c.azul }), f.valor(d.objetivo), t("   ·   Contratação: ", { bold: true, color: c.azul }), f.valor(d.tipoContratacao)]),
    ...(d.obra.trim() || d.local.trim() ? [p([t("Obra: ", { bold: true, color: c.azul }), f.valor(d.obra), t("   ·   Local: ", { bold: true, color: c.azul }), f.valor(d.local)])] : []),
    ...(d.escopo.filter((e) => e.trim()).length
      ? d.escopo.filter((e) => e.trim()).map((e) => p([t("◆  ", { color: c.dourado, size: 16 }), t(e.trim())], { indent: { left: 360, hanging: 360 }, spacing: { after: 100, line: 300 } }))
      : [p([aDefinir("escopo a definir")])]),
  ];

  // ---------- ETAPAS ----------
  const etapas = d.etapas.filter((e) => e.titulo.trim());
  const L1 = 1300, L3 = 2100, L2 = LARGURA - L1 - L3;
  corpo.push(...titulo("Processo", "Como o trabalho acontece"));
  corpo.push(new Table({
    width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [L1, L2, L3],
    rows: etapas.map((e, i) => new TableRow({
      cantSplit: true,
      children: [
        celula([new Paragraph({ alignment: AlignmentType.CENTER, children: [t(String(i + 1).padStart(2, "0"), { size: 44, bold: true, color: c.dourado })] })],
          { fundo: c.azul, largura: L1, bordas: { ...semBordas, bottom: { style: BorderStyle.SINGLE, size: 6, color: c.dourado } } }),
        celula([
          new Paragraph({ spacing: { after: 60 }, children: [t(e.titulo.toUpperCase(), { bold: true, color: c.azul, size: 20 })] }),
          new Paragraph({ spacing: { after: 0, line: 280 }, children: [t(e.descricao, { size: 18 })] }),
        ], { fundo: i % 2 ? c.offwhite : c.bege, largura: L2, bordas: { ...semBordas, bottom: { style: BorderStyle.SINGLE, size: 6, color: c.dourado } } }),
        celula([
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t("PRAZO", { size: 13, color: c.dourado, bold: true, characterSpacing: 60 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [e.prazo.trim() ? t(e.prazo, { size: 18, bold: true, color: c.azul }) : aDefinir(A_DEFINIR, { size: 18 })] }),
        ], { fundo: i % 2 ? c.offwhite : c.bege, largura: L3, bordas: { ...semBordas, bottom: { style: BorderStyle.SINGLE, size: 6, color: c.dourado } } }),
      ],
    })),
  }));

  // ---------- INVESTIMENTO (um card) ----------
  const linhaPg = (rotulo: string, texto: (ReturnType<typeof t>)[]) =>
    new Paragraph({ spacing: { after: 90 }, children: [t("◆  ", { color: c.dourado, size: 16 }), t(rotulo + " ", { bold: true, color: "FFFFFF", size: 19 }), ...texto] });
  const branco = { color: "FFFFFF", size: 19 };
  const extras = d.itensExtras.filter((i) => i.descricao.trim());
  corpo.push(...titulo("Investimento", "Valor e formas de pagamento"));
  corpo.push(new Table({
    width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [LARGURA],
    rows: [new TableRow({ cantSplit: true, children: [celula([
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [t("INVESTIMENTO TOTAL", { size: 15, bold: true, color: c.dourado, characterSpacing: 100 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [d.valorTotal != null ? t(moeda(d.valorTotal), { size: 56, bold: true, color: "FFFFFF" }) : aDefinir("valor a definir", { size: 44 })] }),
      linhaPg("À vista:", d.valorTotal != null ? [t(`${moeda(calc.aVista!)} (${d.descontoAVista}% de desconto)`, branco)] : [t(`${d.descontoAVista}% de desconto`, branco)]),
      linhaPg("Parcelado:", calc.parcelaSemJuros != null ? [t(`até ${d.parcelasSemJuros}x de ${moeda(calc.parcelaSemJuros)} sem juros`, branco)] : [t(`até ${d.parcelasSemJuros}x sem juros`, branco)]),
      linhaPg("Cartão:", [t(`até ${d.parcelasComJuros}x com juros da operadora`, branco)]),
      ...extras.flatMap((i, k) => [
        ...(k === 0 ? [new Paragraph({ spacing: { before: 200, after: 80 }, children: [t("ITENS EXTRAS (não inclusos no valor acima)", { size: 14, bold: true, color: c.dourado, characterSpacing: 60 })] })] : []),
        new Paragraph({ spacing: { after: 70 }, children: [t(i.descricao + ": ", branco), i.valor != null ? t(moeda(i.valor), { ...branco, bold: true }) : aDefinir(A_DEFINIR, { size: 19 })] }),
      ]),
    ], { fundo: c.azul, largura: LARGURA, margem: 320, vertical: VerticalAlign.TOP })] })],
  }));
  if (d.observacoes.trim()) corpo.push(espaco(120), ...d.observacoes.split("\n").filter((x) => x.trim()).map((x) => p([t(x.trim(), { size: 18, italics: true })])));

  // ---------- TERMOS E ASSINATURAS ----------
  corpo.push(...titulo("Aceite", "Termos, condições e assinaturas"));
  d.termos.filter((x) => x.trim()).forEach((x, i) => corpo.push(p([t(`${i + 1}.  `, { bold: true, color: c.dourado }), t(x.trim(), { size: 19 })], { keepNext: true, keepLines: true, indent: { left: 400, hanging: 400 }, spacing: { after: 100, line: 290 } })));
  const LA = Math.floor(LARGURA / 2);
  const assinatura = (nome: (ReturnType<typeof t>)[], papel: string) => celula([
    new Paragraph({ spacing: { before: 900, after: 60 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: c.azul, space: 6 } }, children: nome }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t(papel, { size: 15, color: "6B7280" })] }),
  ], { largura: LA, vertical: VerticalAlign.BOTTOM });
  corpo.push(new Table({ width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [LA, LARGURA - LA], rows: [new TableRow({ cantSplit: true, children: [
    assinatura([d.clienteNome.trim() ? t(d.clienteNome, { bold: true, size: 18 }) : aDefinir("cliente", { size: 18 })], "Contratante"),
    assinatura([t(m.responsavelTecnico, { bold: true, size: 18 })], `${m.razaoSocial} · ${m.registro}`),
  ] })] }));

  // ---------- ENCERRAMENTO (logo + QR codes) ----------
  const LQ = Math.floor(LARGURA / 2);
  const qr = (data: Buffer | null, rotulo: string, valor: string) => celula([
    ...(data ? [centro([new ImageRun({ type: "png", data, transformation: { width: 120, height: 120 } })], 100)] : []),
    centro([t(rotulo.toUpperCase(), { size: 13, bold: true, color: c.dourado, characterSpacing: 60 })], 30),
    centro([t(valor, { size: 17, color: "FFFFFF" })], 0),
  ], { fundo: c.azul, largura: LQ, margem: 120 });
  corpo.push(new Paragraph({ children: [new PageBreak()] }));
  corpo.push(new Table({
    width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [LQ, LARGURA - LQ],
    rows: [
      new TableRow({ cantSplit: true, children: [new TableCell({
        columnSpan: 2, borders: semBordas, shading: { type: ShadingType.CLEAR, fill: c.azul, color: "auto" },
        margins: { top: 900, bottom: 300, left: 500, right: 500 },
        children: [
          ...(logoClaro ? [centro([img(logoClaro, 330)], 500)] : [centro([t(empresa.nome.toUpperCase(), { size: 36, bold: true, color: c.dourado })], 500)]),
          ...(m.fraseEncerramento ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400, line: 360 }, children: [t(`"${m.fraseEncerramento}"`, { size: 22, italics: true, color: "FFFFFF" })] })] : []),
          centro([t("VAMOS CONVERSAR", { size: 16, bold: true, color: c.dourado, characterSpacing: 120 })], 100),
        ],
      })] }),
      new TableRow({ cantSplit: true, children: [qr(qrWa, "WhatsApp", m.telefone), qr(qrIg, "Instagram", m.instagram)] }),
      new TableRow({ cantSplit: true, children: [new TableCell({
        columnSpan: 2, borders: semBordas, shading: { type: ShadingType.CLEAR, fill: c.azul, color: "auto" },
        margins: { top: 300, bottom: 700, left: 500, right: 500 },
        children: [centro([t(`${m.razaoSocial}  ·  ${m.cidade}  ·  ${m.registro}`, { size: 14, color: c.begeLinha })], 0)],
      })] }),
    ],
  }));

  const doc = new Document({
    creator: m.razaoSocial, title: `Proposta ${d.clienteNome}`,
    background: { color: c.offwhite },
    styles: { default: { document: { run: { font: c.fonte, size: 20 } } } },
    sections: [
      { properties: { page: { size: { width: PAGINA_L, height: PAGINA_A }, margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 } } }, children: [capa] },
      { properties: { page: { size: { width: PAGINA_L, height: PAGINA_A }, margin: { top: 1500, bottom: 1200, left: MARGEM, right: MARGEM, header: 600, footer: 500 } } },
        headers: { default: cabecalho }, footers: { default: rodape }, children: corpo },
    ],
  });
  void AMARELO;
  return Packer.toBuffer(doc);
}
