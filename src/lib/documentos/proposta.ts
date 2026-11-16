// Proposta comercial (módulo P02), no modelo visual aprovado (Proposta Cris Bebidas):
// capa em duas colunas (azul com logo + bege com os dados), apresentação, diferenciais em cards,
// escopo numerado, etapas, investimento com três formas de pagamento, aceite e encerramento com QR codes.
// Sem travessão longo; o que falta sai "a definir" em amarelo.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeightRule, ImageRun, Packer, PageBreak, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TabStopType, TextRun, VerticalAlign, WidthType, type ITableCellBorders,
} from "docx";
import type { DadosProposta, Empresa } from "../tipos";
import { A_DEFINIR } from "../tipos";
import { dataExtenso, moeda, semTravessao } from "../formato";
import { AMARELO, AMARELO_TEXTO, cores, imagem, PAGINA_A, PAGINA_L, semBorda, semBordas, TEXTO } from "./comum";
import { calcularPagamento } from "./regras-proposta";
import { FRASE_CAPA_DESTAQUE } from "./textos-proposta";

export * from "./regras-proposta";

const MARGEM = 1247; // 2,2 cm
const LARGURA = PAGINA_L - 2 * MARGEM;
const CINZA = "5E6470";

function misturar(a: string, b: string, t: number) {
  const n = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return [0, 2, 4].map((i) => Math.round(n(a, i) * (1 - t) + n(b, i) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function gerarPropostaDocx(empresa: Empresa, d: DadosProposta): Promise<Buffer> {
  const m = empresa.marca;
  const c = cores(m);
  const begeClaro = misturar(c.bege, c.offwhite, 0.45);
  const nomeAssina = m.assinaturaNome || m.responsavelTecnico;
  const tituloAssina = m.assinaturaTitulo || "";
  const cidade = m.cidade.split(/[-,]/)[0].trim();
  const [logoBranco, qrWa, qrIg] = await Promise.all([imagem(m.logoBranco ?? m.logoClaro), imagem(m.qrWhatsapp), imagem(m.qrInstagram)]);

  type Run = TextRun | ImageRun;
  const t = (texto: string, o: Record<string, unknown> = {}) => new TextRun({ text: semTravessao(texto), font: c.fonte, size: 19, color: TEXTO, ...o });
  const ic = (simbolo: string, size = 14, cor = c.dourado) => new TextRun({ text: simbolo + "  ", font: "Arial", size, color: cor });
  const aDef = (rotulo = A_DEFINIR, size = 19) => new TextRun({ text: rotulo, font: c.fonte, size, color: AMARELO_TEXTO, shading: { type: ShadingType.CLEAR, fill: AMARELO, color: "auto" } });
  const p = (filhos: Run[], o: Record<string, unknown> = {}) => new Paragraph({ spacing: { before: 0, after: 140, line: 300 }, ...o, children: filhos });
  const rotulo = (texto: string, o: Record<string, unknown> = {}) => t(texto.toUpperCase(), { size: 13, bold: true, color: c.dourado, characterSpacing: 70, ...o });
  const linha = (cor: string, depois = 160, tamanho = 4, o: Record<string, unknown> = {}) =>
    new Paragraph({ spacing: { before: 0, after: depois }, border: { bottom: { style: BorderStyle.SINGLE, size: tamanho, color: cor, space: 1 } }, children: [], ...o });
  const cel = (filhos: (Paragraph | Table)[], o: { fundo?: string; largura: number; margens?: [number, number, number, number]; vertical?: "top" | "center" | "bottom"; bordas?: ITableCellBorders; colunas?: number }) =>
    new TableCell({
      width: { size: o.largura, type: WidthType.DXA }, columnSpan: o.colunas, borders: o.bordas ?? semBordas,
      shading: o.fundo ? { type: ShadingType.CLEAR, fill: o.fundo, color: "auto" } : undefined,
      margins: { top: o.margens?.[0] ?? 160, right: o.margens?.[1] ?? 220, bottom: o.margens?.[2] ?? 160, left: o.margens?.[3] ?? 220 },
      verticalAlign: o.vertical === "top" ? VerticalAlign.TOP : o.vertical === "bottom" ? VerticalAlign.BOTTOM : VerticalAlign.CENTER,
      children: filhos,
    });
  const tabela = (larguras: number[], linhas: TableRow[], total = LARGURA) => new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: larguras, rows: linhas });
  // Faixa da cor do papel entre cards: dá o respiro entre as linhas da tabela.
  const respiro = (tam = 36): ITableCellBorders => ({ top: { style: BorderStyle.SINGLE, size: tam, color: c.offwhite }, bottom: { style: BorderStyle.SINGLE, size: tam, color: c.offwhite }, left: semBorda, right: semBorda });
  const secao = (icone: string, rot: string, titulo: string) => [
    new Paragraph({ keepNext: true, spacing: { before: 320, after: 40 }, children: [ic(icone, 15), rotulo(rot)] }),
    new Paragraph({ keepNext: true, spacing: { before: 0, after: 220 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c.azul, space: 10 } }, children: [t(titulo, { size: 28, bold: true, color: c.azul })] }),
  ];
  const img = (data: Buffer, largura: number, proporcao = 280 / 900) => new ImageRun({ type: "png", data, transformation: { width: largura, height: Math.round(largura * proporcao) } });
  const centro = (filhos: Run[], depois = 100, o: Record<string, unknown> = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: depois }, children: filhos, ...o });

  // ---------- CAPA: azul com logo à esquerda, dados à direita ----------
  const CE = Math.floor(PAGINA_L * 0.44), CD = PAGINA_L - CE;
  const campoCapa = (rot: string, valor: Run[], depois = 260) => [
    new Paragraph({ spacing: { before: 0, after: 90 }, children: [rotulo(rot, { characterSpacing: 110 })] }),
    new Paragraph({ spacing: { before: 0, after: depois }, children: valor }),
  ];
  const capa = new Table({
    width: { size: PAGINA_L, type: WidthType.DXA }, columnWidths: [CE, CD],
    rows: [new TableRow({ height: { value: PAGINA_A - 40, rule: HeightRule.EXACT }, children: [
      cel([
        ...(logoBranco ? [centro([img(logoBranco, 232)], 500)] : [centro([t(empresa.nome.toUpperCase(), { size: 30, bold: true, color: "FFFFFF" })], 500)]),
        linha(c.dourado, 420, 8, { indent: { left: 700, right: 700 } }),
        centro([t(m.registro.replace("CAU ", "CAU-SP "), { size: 14, color: c.begeLinha })], 40),
        centro([t(m.email, { size: 14, color: c.begeLinha })], 40),
        centro([t(m.instagram, { size: 14, color: c.begeLinha })], 0),
      ], { fundo: c.azul, largura: CE, margens: [0, 0, 0, 0] }),
      cel([
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 700, line: 440 }, shading: { type: ShadingType.CLEAR, fill: c.dourado, color: "auto" }, children: [t("PROPOSTA EXCLUSIVA", { size: 15, bold: true, color: "FFFFFF", characterSpacing: 130 })] }),
        linha(c.dourado, 240),
        ...campoCapa("Para", [d.clienteNome.trim() ? t(d.clienteNome, { size: 44, bold: true, color: c.azul }) : aDef("cliente a definir", 36)], 240),
        linha(c.dourado, 240),
        ...campoCapa("Projeto", [d.objetivo.trim() ? t(d.objetivo, { size: 23, bold: true, color: c.azul }) : aDef("projeto a definir", 23)], 240),
        linha(c.dourado, 240),
        ...campoCapa("Data de emissão", [t(dataExtenso(d.data), { size: 20 })]),
        ...campoCapa("Validade", [d.validadeDias != null ? t(`${d.validadeDias} dias`, { size: 20, bold: true, color: c.azul }) : aDef(A_DEFINIR, 20)], 240),
        linha(c.dourado, 320),
        new Paragraph({ spacing: { before: 0, after: 140, line: 320 }, children: [t(d.fraseCapa, { size: 20, color: c.azul })] }),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [t(FRASE_CAPA_DESTAQUE, { size: 20, bold: true, color: c.dourado })] }),
      ], { fundo: c.bege, largura: CD, margens: [0, 420, 0, 420] }),
    ] })],
  });

  // ---------- CABEÇALHO E RODAPÉ ----------
  const cabecalho = new Header({ children: [new Paragraph({
    spacing: { after: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c.dourado, space: 8 } },
    children: [
      t((m.cabecalhoNome || empresa.nome).toUpperCase(), { size: 14, bold: true, color: c.azul, characterSpacing: 110 }),
      t("   " + (m.cabecalhoSub || ""), { size: 12, color: c.dourado }),
      t("\t" + m.registro, { size: 12, color: c.dourado }),
    ],
  })] });
  const rodape = new Footer({ children: [new Paragraph({
    spacing: { before: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: c.begeLinha, space: 8 } },
    children: [
      t(`Proposta ${d.clienteNome.trim() || ""}  ·  ${nomeAssina}${tituloAssina ? "  ·  " + tituloAssina : ""}`, { size: 12, color: CINZA }),
      new TextRun({ children: ["\t", PageNumber.CURRENT], font: c.fonte, size: 12, color: c.dourado }),
    ],
  })] });

  const corpo: (Paragraph | Table)[] = [];
  const paragrafos = (texto: string) => texto.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => p([t(x)], { alignment: AlignmentType.JUSTIFIED }));

  // ---------- APRESENTAÇÃO ----------
  corpo.push(...secao("◆", "Apresentação", d.tituloApresentacao.trim() || "Apresentação"));
  corpo[0] = new Paragraph({ keepNext: true, spacing: { before: 0, after: 40 }, children: [ic("◆", 15), rotulo("Apresentação")] });
  corpo.push(p([d.saudacao.trim() ? t(d.saudacao.trim(), { bold: true, color: c.azul }) : d.clienteNome.trim() ? t(`Olá, ${d.clienteNome.trim()}.`, { bold: true, color: c.azul }) : aDef("saudação a definir")]));
  corpo.push(...paragrafos(d.carta));
  corpo.push(p([t(nomeAssina, { bold: true, color: c.azul, size: 20 })], { spacing: { before: 60, after: 0 } }));
  corpo.push(p([t([tituloAssina, m.registro].filter(Boolean).join("  ·  "), { size: 14, color: c.dourado })], { spacing: { after: 0 } }));

  // ---------- DIFERENCIAIS: por que investir em um bom projeto ----------
  corpo.push(...secao("★", "Diferenciais", "Por que investir em um bom projeto"));
  const difs = d.diferenciais.filter((x) => x.titulo.trim() || x.texto.trim());
  corpo.push(tabela([LARGURA], difs.map((x, i) => new TableRow({ cantSplit: true, children: [cel([
    new Paragraph({ spacing: { after: 60 }, children: [ic("◆", 15), t(x.titulo, { bold: true, color: c.azul })] }),
    new Paragraph({ spacing: { after: 0, line: 290 }, children: [t(x.texto, { size: 18 })] }),
  ], { fundo: i % 2 ? c.bege : begeClaro, largura: LARGURA, margens: [170, 260, 170, 260], bordas: { ...respiro(30), left: { style: BorderStyle.SINGLE, size: 18, color: c.dourado } } })] }))));

  // ---------- ESCOPO ----------
  const escopo = d.escopo.filter((x) => x.titulo.trim());
  const LN = 760;
  corpo.push(new Paragraph({ children: [new PageBreak()] }));
  corpo.push(...secao("□", "Escopo", "O que está incluído no projeto"));
  corpo[corpo.length - 2] = new Paragraph({ keepNext: true, spacing: { before: 0, after: 40 }, children: [ic("□", 15), rotulo("Escopo")] });
  if (escopo.length === 0) corpo.push(p([aDef("escopo a definir")]));
  else {
    const folga = escopo.length <= 6 ? 300 : escopo.length <= 8 ? 230 : 150;
    corpo.push(tabela([LN, LARGURA - LN], escopo.map((x, i) => new TableRow({ cantSplit: true, children: [
      cel([centro([t(String(i + 1).padStart(2, "0"), { size: 26, bold: true, color: c.dourado })], 0)], { fundo: c.azul, largura: LN, margens: [folga, 60, folga, 60], bordas: respiro() }),
      cel([
        new Paragraph({ spacing: { after: x.descricao.trim() ? 60 : 0 }, children: [t(x.titulo, { bold: true, color: c.azul, size: 20 })] }),
        ...(x.descricao.trim() ? [new Paragraph({ spacing: { after: 0, line: 280 }, children: [t(x.descricao, { size: 16, color: CINZA })] })] : []),
      ], { fundo: i % 2 ? c.bege : begeClaro, largura: LARGURA - LN, margens: [folga, 240, folga, 240], bordas: respiro() }),
    ] }))));
  }

  // ---------- ETAPAS ----------
  const etapas = d.etapas.filter((e) => e.titulo.trim());
  const LE = Math.round(LARGURA * 0.3);
  const altura = etapas.length <= 4 ? 2500 : etapas.length === 5 ? 2050 : 1700;
  corpo.push(new Paragraph({ children: [new PageBreak()] }));
  corpo.push(...secao("▷", "Processo", "Etapas do projeto"));
  corpo[corpo.length - 2] = new Paragraph({ keepNext: true, spacing: { before: 0, after: 40 }, children: [ic("▷", 15), rotulo("Processo")] });
  corpo.push(tabela([LE, LARGURA - LE], etapas.map((e, i) => {
    const itens = e.itens.filter((x) => x.trim());
    return new TableRow({ cantSplit: true, height: { value: altura, rule: HeightRule.ATLEAST }, children: [
      cel([
        new Paragraph({ spacing: { after: 60 }, children: [t(String(i + 1).padStart(2, "0"), { size: 50, bold: true, color: c.dourado })] }),
        new Paragraph({ spacing: { after: 0, line: 250 }, children: [t(e.titulo.toUpperCase(), { size: 13, bold: true, color: "FFFFFF", characterSpacing: 45 })] }),
      ], { fundo: c.azul, largura: LE, margens: [200, 160, 200, 240], bordas: respiro(40) }),
      cel([
        ...(itens.length ? itens.map((x) => new Paragraph({ spacing: { after: 90, line: 280 }, indent: { left: 260, hanging: 260 }, children: [ic("◆", 13), t(x.trim(), { size: 18 })] })) : [p([aDef("itens a definir", 18)])]),
        ...(e.prazo.trim() ? [new Paragraph({ spacing: { before: 60, after: 0 }, children: [rotulo("Prazo  "), t(e.prazo.trim(), { size: 17, bold: true, color: c.azul })] })] : []),
      ], { fundo: i % 2 ? c.bege : begeClaro, largura: LARGURA - LE, margens: [200, 240, 200, 320], bordas: respiro(40) }),
    ] });
  })));

  // ---------- INVESTIMENTO ----------
  const calc = calcularPagamento(d);
  const L3 = Math.floor(LARGURA / 3);
  const forma = (icone: string, rot: string, valor: Run[], texto: string, i: number) => cel([
    new Paragraph({ spacing: { after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c.dourado, space: 8 } }, children: [ic(icone, 13), rotulo(rot, { size: 11 })] }),
    new Paragraph({ spacing: { before: 100, after: 80 }, children: valor }),
    new Paragraph({ spacing: { after: 0, line: 270 }, children: [t(texto, { size: 14, color: CINZA })] }),
  ], { fundo: i % 2 ? c.bege : begeClaro, largura: i === 2 ? LARGURA - 2 * L3 : L3, margens: [260, 200, 260, 220], vertical: "top" });
  const forte = (s: string) => t(s, { size: 24, bold: true, color: c.azul });
  corpo.push(new Paragraph({ children: [new PageBreak()] }));
  corpo.push(...secao("○", "Investimento", "Valor do projeto"));
  corpo[corpo.length - 2] = new Paragraph({ keepNext: true, spacing: { before: 0, after: 40 }, children: [ic("○", 15), rotulo("Investimento")] });
  corpo.push(tabela([L3, L3, LARGURA - 2 * L3], [
    new TableRow({ cantSplit: true, children: [cel([
      centro([ic("○", 13), rotulo("Investimento total", { characterSpacing: 120 })], 120),
      centro([d.valorTotal != null ? t(moeda(d.valorTotal), { size: 60, bold: true, color: "FFFFFF" }) : aDef("valor a definir", 44)], 100),
      centro([t(`${d.objetivo.trim() || "Projeto"}, conforme escopo descrito nesta proposta`, { size: 14, color: c.begeLinha })], 0),
    ], { fundo: c.azul, largura: LARGURA, colunas: 3, margens: [420, 300, 420, 300], bordas: { ...semBordas, bottom: { style: BorderStyle.SINGLE, size: 40, color: c.offwhite } } })] }),
    new TableRow({ cantSplit: true, children: [
      forma("◆", "À vista", [calc.aVista != null ? forte(moeda(calc.aVista)) : aDef(A_DEFINIR, 24)], `Com ${String(d.descontoAVista).replace(".", ",")}% de desconto sobre o valor total.`, 0),
      forma("▷", `Cartão em até ${d.parcelasSemJuros}x`, [calc.parcelaSemJuros != null ? forte(`${d.parcelasSemJuros}x de ${moeda(calc.parcelaSemJuros)}`) : forte(`Até ${d.parcelasSemJuros}x`)], "No cartão de crédito, sem juros.", 1),
      forma("○", `Cartão em até ${d.parcelasComJuros}x`, [forte(`Até ${d.parcelasComJuros}x`)], "No cartão de crédito, com juros da operadora da máquina.", 2),
    ] }),
  ]));
  const extras = d.itensExtras.filter((i) => i.descricao.trim());
  if (extras.length) {
    corpo.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [rotulo("Itens extras, não inclusos no valor acima")] }));
    for (const i of extras) corpo.push(p([ic("◆", 13), t(i.descricao.trim() + ": ", { size: 18 }), i.valor != null ? t(moeda(i.valor), { size: 18, bold: true, color: c.azul }) : aDef(A_DEFINIR, 18)], { spacing: { after: 60 } }));
  }
  for (const x of d.observacoes.split("\n").filter((y) => y.trim())) corpo.push(p([t(x.trim(), { size: 17, italics: true, color: CINZA })], { spacing: { before: 120, after: 0 } }));

  // ---------- TERMOS, ACEITE E ASSINATURAS ----------
  const termos = [
    ...(d.validadeDias != null ? [`Esta proposta tem validade de ${d.validadeDias} dias a partir da data de emissão.`] : []),
    ...d.termos.filter((x) => x.trim()),
  ];
  corpo.push(...secao("✓", "Termos e condições", "Aceite da proposta"));
  if (d.validadeDias == null) corpo.push(p([ic("◆", 13), t("Validade da proposta: "), aDef()], { keepNext: true, spacing: { after: 110 } }));
  for (const x of termos) corpo.push(p([ic("◆", 13), t(x.trim(), { size: 18 })], { keepNext: true, keepLines: true, indent: { left: 260, hanging: 260 }, spacing: { after: 110, line: 290 } }));
  const LA = Math.floor(LARGURA / 2);
  const assina = (nome: Run[], papel: string, larg: number) => cel([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 520, after: 50 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: c.dourado, space: 8 } }, children: nome }),
    centro([t(papel, { size: 14, color: CINZA })], 0),
  ], { fundo: begeClaro, largura: larg, margens: [260, 300, 260, 300], vertical: "bottom" });
  corpo.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 0 }, children: [] }));
  corpo.push(tabela([LA, LARGURA - LA], [new TableRow({ cantSplit: true, children: [
    assina([d.clienteNome.trim() ? t(d.clienteNome, { bold: true, color: c.azul, size: 19 }) : aDef("cliente", 19)], "Contratante", LA),
    assina([t(nomeAssina, { bold: true, color: c.azul, size: 19 })], [tituloAssina, m.registro].filter(Boolean).join("  ·  "), LARGURA - LA),
  ] })]));
  corpo.push(centro([t(`${cidade}, ${dataExtenso(d.data)}`, { size: 15, color: CINZA })], 0, { spacing: { before: 200, after: 0 } }));

  // ---------- ENCERRAMENTO: logo e QR codes à esquerda, missão e próximos passos à direita ----------
  const LEsq = Math.round(LARGURA * 0.46), LDir = LARGURA - LEsq, LQ = Math.floor((LEsq - 240) / 2);
  const qr = (data: Buffer | null, rot: string, valor: string, larg: number) => cel([
    ...(data ? [centro([new ImageRun({ type: "png", data, transformation: { width: 84, height: 84 } })], 80)] : []),
    centro([rotulo(rot, { size: 10, characterSpacing: 90 })], 30),
    centro([t(valor, { size: 11, color: c.begeLinha })], 0),
  ], { largura: larg, margens: [0, 20, 0, 20], vertical: "top" });
  const passos = d.proximosPassos.filter((x) => x.trim());
  corpo.push(new Paragraph({ children: [new PageBreak()] }));
  corpo.push(tabela([LEsq, LDir], [new TableRow({ cantSplit: true, height: { value: 13000, rule: HeightRule.EXACT }, children: [
    cel([
      ...(logoBranco ? [centro([img(logoBranco, 200)], 420)] : [centro([t(empresa.nome.toUpperCase(), { size: 26, bold: true, color: "FFFFFF" })], 420)]),
      linha(c.dourado, 420, 8),
      new Table({ width: { size: LQ * 2, type: WidthType.DXA }, columnWidths: [LQ, LQ], alignment: AlignmentType.CENTER, rows: [new TableRow({ children: [qr(qrWa, "WhatsApp", m.telefone, LQ), qr(qrIg, "Instagram", m.instagram, LQ)] })] }),
    ], { fundo: c.azul, largura: LEsq, margens: [0, 120, 0, 120] }),
    cel([
      new Paragraph({ spacing: { after: 160 }, children: [ic("★", 13), t("Minha Missão", { size: 15, bold: true, color: c.dourado })] }),
      linha(c.begeLinha, 260, 6),
      new Paragraph({ spacing: { after: 700, line: 340 }, children: [t(`“${d.missao.trim()}”`, { size: 19, color: c.azul })] }),
      new Paragraph({ spacing: { after: 140 }, children: [ic("▷", 13), t("Próximos Passos", { size: 15, bold: true, color: c.dourado })] }),
      ...passos.map((x, i) => new Paragraph({ spacing: { after: 90 }, children: [t(String(i + 1).padStart(2, "0") + "  ", { size: 14, bold: true, color: c.dourado }), t(x.trim(), { size: 16, bold: true, color: c.azul })] })),
      linha(c.begeLinha, 260, 6, { spacing: { before: 500, after: 260 } }),
      new Paragraph({ spacing: { after: 60 }, children: [t("É um prazer fazer parte da sua conquista.", { size: 15, color: c.azul })] }),
      new Paragraph({ spacing: { after: 0 }, children: [t("Obrigado pela confiança.", { size: 15, bold: true, color: c.dourado })] }),
    ], { fundo: c.bege, largura: LDir, margens: [0, 340, 0, 380] }),
  ] })]));

  const doc = new Document({
    creator: m.razaoSocial, title: `Proposta ${d.clienteNome}`,
    background: { color: c.offwhite },
    styles: { default: { document: { run: { font: c.fonte, size: 19 } } } },
    sections: [
      { properties: { page: { size: { width: PAGINA_L, height: PAGINA_A }, margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 } } }, children: [capa] },
      { properties: { page: { size: { width: PAGINA_L, height: PAGINA_A }, margin: { top: 1560, bottom: 1300, left: MARGEM, right: MARGEM, header: 620, footer: 560 } } },
        headers: { default: cabecalho }, footers: { default: rodape }, children: corpo },
    ],
  });
  return Packer.toBuffer(doc);
}
