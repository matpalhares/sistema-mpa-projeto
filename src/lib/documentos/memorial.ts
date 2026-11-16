// Memorial descritivo (módulo P03), em dois tipos:
//  - completo (cliente e obra): materiais, marcas, modelos e medidas;
//  - simplificado (prefeitura): SEM marcas, modelos e medidas de revestimentos e itens.
// Estrutura e papel timbrado seguem a skill memorial-descritivo do escritório.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, Table, TableRow,
  TabStopType, TextRun, VerticalAlign, WidthType,
} from "docx";
import type { Acabamento, DadosMemorial, Empresa, TipoMemorial } from "../tipos";
import { A_DEFINIR } from "../tipos";
import { dataExtenso, numero } from "../formato";
import { cores, fabrica, imagem, PAGINA_A, PAGINA_L } from "./comum";
import { NORMAS, PERGUNTAS_SERVICOS, SECOES_SERVICOS } from "./opcoes-memorial";

const MARGEM = 1134;
const LARGURA = PAGINA_L - 2 * MARGEM; // 9638

export * from "./regras-memorial";
import { areaTotal } from "./regras-memorial";

export async function gerarMemorialDocx(empresa: Empresa, d: DadosMemorial, tipo: TipoMemorial): Promise<Buffer> {
  const m = empresa.marca;
  const c = cores(m);
  const { t, p, titulo, celula, aDefinir, valor } = fabrica(c);
  const completo = tipo === "completo";
  const logo = await imagem(m.logoEscuro);

  const cabecalho = new Header({ children: [new Paragraph({
    spacing: { after: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c.dourado, space: 6 } },
    children: [
      ...(logo ? [new ImageRun({ type: "png", data: logo, transformation: { width: 150, height: 47 } })] : [t(empresa.nome.toUpperCase(), { bold: true, color: c.azul, size: 16 })]),
      t("\tMEMORIAL DESCRITIVO" + (completo ? "" : " SIMPLIFICADO"), { size: 16, bold: true, color: c.azul, characterSpacing: 60 }),
    ],
  })] });
  const rodape = new Footer({ children: [
    new Paragraph({ spacing: { after: 20 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: c.begeLinha, space: 6 } },
      children: [t(`WhatsApp ${m.telefone}  ·  ${m.instagram}  ·  ${m.email}`, { size: 13, color: "6B7280" })] }),
    new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: LARGURA }], children: [
      t(`${m.razaoSocial}  ·  ${m.cidade}  ·  RT ${m.responsavelTecnico}  ·  ${m.registro}`, { size: 13, color: "6B7280" }),
      new TextRun({ children: ["\tPág. ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: c.fonte, size: 13, color: c.dourado }),
    ] }),
  ] });

  const borda = { style: BorderStyle.SINGLE, size: 4, color: c.begeLinha };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const cel = (filhos: (TextRun)[], largura: number, o: { cab?: boolean; rotulo?: boolean } = {}) =>
    celula([new Paragraph({ spacing: { after: 0, line: 270 }, children: filhos })],
      { largura, margem: 80, bordas, fundo: o.cab ? c.azul : o.rotulo ? c.bege : undefined, vertical: VerticalAlign.CENTER });
  const tabela = (larguras: number[], linhas: TableRow[]) => new Table({ width: { size: LARGURA, type: WidthType.DXA }, columnWidths: larguras, rows: linhas });
  const cab = (textos: string[], larguras: number[]) => new TableRow({ tableHeader: true, cantSplit: true, children: textos.map((x, i) => cel([t(x.toUpperCase(), { size: 15, bold: true, color: "FFFFFF" })], larguras[i], { cab: true })) });
  const txt = (s: string, o = {}) => t(s, { size: 18, ...o });
  const val = (s: string | null | undefined) => valor(s, { size: 18 });
  const area = (n: number | null) => (n == null ? aDefinir(A_DEFINIR, { size: 18 }) : txt(`${numero(n)} m²`));

  const corpo: (Paragraph | Table)[] = [];

  // Título do documento
  corpo.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, children: [t(completo ? "MEMORIAL DESCRITIVO" : "MEMORIAL DESCRITIVO SIMPLIFICADO", { size: 32, bold: true, color: c.azul })] }));
  corpo.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [d.obra.trim() ? t(d.obra, { size: 20, color: c.dourado, bold: true }) : aDefinir("obra a definir")] }));

  // 1 Identificação
  const LI = [3000, LARGURA - 3000];
  const linhaId = (rotulo: string, v: string | null | undefined) => new TableRow({ cantSplit: true, children: [cel([txt(rotulo, { bold: true, color: c.azul })], LI[0], { rotulo: true }), cel([val(v)], LI[1])] });
  corpo.push(...titulo("Seção 1", "Identificação"));
  corpo.push(tabela(LI, [
    linhaId("Proprietário", d.proprietario), linhaId("CPF ou CNPJ", d.cpfCnpj), linhaId("Obra", d.obra),
    linhaId("Tipo de obra", d.tipoObra), linhaId("Endereço", d.endereco), linhaId("Município", d.municipio),
    linhaId("Matrícula do imóvel", d.matricula), linhaId("Inscrição municipal", d.inscricaoMunicipal),
    linhaId("Responsável técnico", `${m.responsavelTecnico} · ${m.registro}`), linhaId("RRT", d.rrt),
  ]));

  // 2 Quadro de áreas
  const LA = [LARGURA - 3000, 3000];
  const linhaArea = (rotulo: string, filho: TextRun, forte = false) => new TableRow({ cantSplit: true, children: [cel([txt(rotulo, forte ? { bold: true, color: c.azul } : {})], LA[0], { rotulo: forte }), cel([filho], LA[1], { rotulo: forte })] });
  corpo.push(...titulo("Seção 2", "Quadro de áreas"));
  corpo.push(tabela(LA, [
    cab(["Descrição", "Área"], LA),
    linhaArea("Área do terreno", area(d.areaTerreno)),
    linhaArea("Área a construir", area(d.areaAConstruir)),
    linhaArea("Área existente a reformar", area(d.areaExistenteReformada)),
    linhaArea("Área existente mantida", area(d.areaExistenteMantida)),
    linhaArea("Área total edificada", area(areaTotal(d)), true),
    linhaArea("Taxa de ocupação", val(d.taxaOcupacao)),
    linhaArea("Coeficiente de aproveitamento", val(d.coeficienteAproveitamento)),
    linhaArea("Taxa de permeabilidade", val(d.taxaPermeabilidade)),
  ]));

  // 3 Objeto e caracterização
  corpo.push(...titulo("Seção 3", "Objeto e caracterização"));
  corpo.push(p([txt("Este memorial descreve os serviços e os materiais previstos para a obra de tipo "), val(d.tipoObra), txt(", localizada em "), val(d.endereco), txt(", município de "), val(d.municipio), txt(".")], { alignment: AlignmentType.JUSTIFIED }));
  corpo.push(p([txt("A execução seguirá o projeto arquitetônico aprovado e as normas técnicas aplicáveis, entre elas: " + NORMAS.join("; ") + ".")], { alignment: AlignmentType.JUSTIFIED }));
  if (!completo) corpo.push(p([txt("Marcas, modelos e especificações serão definidos na execução, com padrão equivalente ou superior ao descrito.")], { alignment: AlignmentType.JUSTIFIED }));
  if (d.ajusteMunicipio.trim()) for (const x of d.ajusteMunicipio.split("\n").filter((y) => y.trim())) corpo.push(p([txt(x.trim())], { alignment: AlignmentType.JUSTIFIED }));

  // 4 Descrição dos serviços
  corpo.push(...titulo("Seção 4", "Descrição dos serviços"));
  for (const s of SECOES_SERVICOS) {
    corpo.push(new Paragraph({ keepNext: true, spacing: { before: 160, after: 80 }, children: [t(`${s.id}  ${s.titulo}`, { size: 20, bold: true, color: c.azul })] }));
    for (const q of PERGUNTAS_SERVICOS.filter((x) => x.secao === s.id)) {
      const r = d.servicos[q.chave];
      const filhos = [txt(q.rotulo + ": ", { bold: true }), val(r?.resposta)];
      if (r?.resposta?.trim()) filhos.push(txt("."));
      if (completo && r?.detalhe?.trim()) filhos.push(txt(" " + r.detalhe.trim().replace(/\.$/, "") + "."));
      corpo.push(p(filhos, { alignment: AlignmentType.JUSTIFIED, spacing: { after: 90, line: 290 } }));
    }
    if (s.id === "4.5") {
      if (completo) {
        const LE = [900, 2500, 2338, 1300, 1300, 1300];
        corpo.push(tabela(LE, [
          cab(["Cód.", "Tipo", "Material", "Largura", "Altura", "Qtd."], LE),
          ...(d.esquadrias.length ? d.esquadrias.map((e) => new TableRow({ cantSplit: true, children: [e.codigo, e.tipo, e.material, e.largura, e.altura, e.quantidade].map((v, i) => cel([val(v)], LE[i])) }))
            : [new TableRow({ children: LE.map((l) => cel([aDefinir(A_DEFINIR, { size: 18 })], l)) })]),
        ]));
      } else {
        corpo.push(p([txt("As dimensões e os tipos de cada esquadria constam no quadro de esquadrias do projeto arquitetônico.")], { alignment: AlignmentType.JUSTIFIED }));
      }
    }
  }

  // 5 Acabamentos por ambiente
  const acab = (a: Acabamento): TextRun[] => {
    if (!a.tipo.trim()) return [aDefinir(A_DEFINIR, { size: 18 })];
    if (!completo) return [txt(/mantid/i.test(a.tipo) ? a.tipo.trim() : `${a.tipo.trim()} ou similar`)];
    const extra = [a.marca, a.modelo, a.medida].map((x) => x.trim()).filter(Boolean).join(", ");
    return [txt(a.tipo.trim() + (extra ? ` (${extra})` : ""))];
  };
  const LC = completo ? [1900, 2100, 2100, 1700, 1838] : [2438, 2400, 2400, 2400];
  corpo.push(...titulo("Seção 5", "Acabamentos por ambiente"));
  corpo.push(tabela(LC, [
    cab(completo ? ["Ambiente", "Piso", "Paredes", "Teto", "Esquadrias"] : ["Ambiente", "Piso", "Paredes", "Teto"], LC),
    ...(d.ambientes.length ? d.ambientes.map((a) => new TableRow({ cantSplit: true, children: [
      cel([txt(a.nome, { bold: true, color: c.azul }), ...(completo && a.areaM2 != null ? [txt(`  ${numero(a.areaM2)} m²`, { size: 15, color: "6B7280" })] : [])], LC[0], { rotulo: true }),
      cel(acab(a.piso), LC[1]), cel(acab(a.paredes), LC[2]), cel(acab(a.teto), LC[3]),
      ...(completo ? [cel([val(a.esquadrias)], LC[4])] : []),
    ] })) : [new TableRow({ children: LC.map((l) => cel([aDefinir(A_DEFINIR, { size: 18 })], l)) })]),
  ]));

  // 6 Declaração e assinaturas
  corpo.push(...titulo("Seção 6", "Declaração e assinaturas"));
  corpo.push(p([txt("Declaro que as informações deste memorial correspondem ao projeto apresentado e que a obra será executada de acordo com ele.")], { keepNext: true, alignment: AlignmentType.JUSTIFIED }));
  corpo.push(p([val(d.municipio), txt(", " + dataExtenso(d.data) + ".")], { keepNext: true, spacing: { before: 120, after: 200 } }));
  const LS = Math.floor(LARGURA / 2);
  const assin = (nome: TextRun, papel: string) => celula([
    new Paragraph({ spacing: { before: 800, after: 50 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: c.azul, space: 6 } }, children: [nome] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t(papel, { size: 15, color: "6B7280" })] }),
  ], { largura: LS, vertical: VerticalAlign.BOTTOM });
  corpo.push(new Table({ width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [LS, LARGURA - LS], rows: [new TableRow({ cantSplit: true, children: [
    assin(valor(d.proprietario, { size: 18, bold: true }), "Proprietário"),
    assin(t(m.responsavelTecnico, { size: 18, bold: true }), `Responsável técnico · ${m.registro}`),
  ] })] }));

  const doc = new Document({
    creator: m.razaoSocial, title: `Memorial descritivo ${d.obra}`,
    styles: { default: { document: { run: { font: c.fonte, size: 18 } } } },
    sections: [{
      properties: { page: { size: { width: PAGINA_L, height: PAGINA_A }, margin: { top: 1700, bottom: 1300, left: MARGEM, right: MARGEM, header: 600, footer: 500 } } },
      headers: { default: cabecalho }, footers: { default: rodape }, children: corpo,
    }],
  });
  return Packer.toBuffer(doc);
}

