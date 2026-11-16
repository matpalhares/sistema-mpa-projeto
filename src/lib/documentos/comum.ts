// Peças comuns aos documentos (DOCX via docx.js, PDF via LibreOffice).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  AlignmentType, BorderStyle, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
  type IRunOptions, type IParagraphOptions, type ITableCellBorders,
} from "docx";
import type { Marca, Verificacao } from "../tipos";
import { A_DEFINIR } from "../tipos";
import { semTravessao, temTravessao } from "../formato";
import { lerArquivo } from "../arquivos";

const exec = promisify(execFile);

export const PAGINA_L = 11906; // A4 em DXA
export const PAGINA_A = 16838;
export const AMARELO = "FFF2B3"; // "a definir"
export const AMARELO_TEXTO = "7A4B00";
export const TEXTO = "2A2A2A";

export const hex = (c: string) => c.replace("#", "").toUpperCase();
export interface Cores { azul: string; dourado: string; offwhite: string; bege: string; begeLinha: string; fonte: string }
export function cores(m: Marca): Cores {
  return { azul: hex(m.azul), dourado: hex(m.dourado), offwhite: hex(m.offwhite || "#F7F4EE"), bege: hex(m.bege || "#E8DFD2"), begeLinha: hex(m.begeLinha || "#D9C9A3"), fonte: m.fonte || "Montserrat" };
}

export const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };

export function fabrica(c: Cores) {
  const t = (texto: string, o: Partial<IRunOptions> = {}) =>
    new TextRun({ text: semTravessao(texto), font: c.fonte, size: 20, color: TEXTO, ...o });
  // Campo desconhecido: nunca inventar. Sai destacado em amarelo.
  const aDefinir = (rotulo = A_DEFINIR, o: Partial<IRunOptions> = {}) =>
    new TextRun({ text: rotulo, font: c.fonte, size: 20, color: AMARELO_TEXTO, shading: { type: ShadingType.CLEAR, fill: AMARELO, color: "auto" }, ...o });
  const valor = (v: string | null | undefined, o: Partial<IRunOptions> = {}) => (v && v.trim() ? t(v.trim(), o) : aDefinir(A_DEFINIR, o.size ? { size: o.size } : {}));
  const p = (filhos: TextRun[] | string, o: Partial<IParagraphOptions> = {}) =>
    new Paragraph({ spacing: { before: 0, after: 140, line: 300 }, ...o, children: typeof filhos === "string" ? [t(filhos)] : filhos });
  const espaco = (n = 160) => new Paragraph({ spacing: { before: 0, after: n }, children: [] });
  const titulo = (rotulo: string, tituloTxt: string) => [
    new Paragraph({ keepNext: true, spacing: { before: 280, after: 40 }, children: [t(rotulo.toUpperCase(), { size: 15, bold: true, color: c.dourado, characterSpacing: 60 })] }),
    new Paragraph({
      keepNext: true, spacing: { before: 0, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c.azul, space: 6 } },
      children: [t(tituloTxt.toUpperCase(), { size: 28, bold: true, color: c.azul })],
    }),
  ];
  const celula = (filhos: (Paragraph | Table)[], o: { fundo?: string; largura?: number; margem?: number; vertical?: "top" | "center" | "bottom"; bordas?: ITableCellBorders } = {}) =>
    new TableCell({
      width: o.largura ? { size: o.largura, type: WidthType.DXA } : undefined,
      borders: o.bordas ?? semBordas,
      shading: o.fundo ? { type: ShadingType.CLEAR, fill: o.fundo, color: "auto" } : undefined,
      margins: { top: o.margem ?? 160, bottom: o.margem ?? 160, left: 220, right: 220 },
      verticalAlign: o.vertical ?? VerticalAlign.CENTER,
      children: filhos,
    });
  const cartao = (filhos: Paragraph[], largura: number, fundo = c.bege) =>
    new Table({ width: { size: largura, type: WidthType.DXA }, columnWidths: [largura], rows: [new TableRow({ cantSplit: true, children: [celula(filhos, { fundo, largura, margem: 220 })] })] });
  return { t, aDefinir, valor, p, espaco, titulo, celula, cartao };
}

export async function imagem(caminho: string | undefined): Promise<Buffer | null> {
  if (!caminho) return null;
  if (caminho.startsWith("recursos/")) {
    try { return fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), caminho)); } catch { return null; }
  }
  return lerArquivo(caminho); // logo enviado pelo usuário
}

function caminhosSoffice(): string[] {
  const env = process.env.SOFFICE_PATH ? [process.env.SOFFICE_PATH] : [];
  return [
    ...env, "soffice", "libreoffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
  ];
}

// Converte DOCX em PDF com o LibreOffice. Devolve null se o LibreOffice não estiver instalado.
export async function converterParaPdf(docx: Buffer): Promise<Buffer | null> {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "mpa-doc-"));
  try {
    fs.writeFileSync(path.join(pasta, "doc.docx"), docx);
    const perfil = "file:///" + path.join(pasta, "perfil").replace(/\\/g, "/").replace(/^\//, "");
    for (const bin of caminhosSoffice()) {
      try {
        await exec(bin, [`-env:UserInstallation=${perfil}`, "--headless", "--convert-to", "pdf", "--outdir", pasta, path.join(pasta, "doc.docx")], { timeout: 120000 });
        const saida = path.join(pasta, "doc.pdf");
        if (fs.existsSync(saida)) return fs.readFileSync(saida);
      } catch { /* tenta o próximo caminho */ }
    }
    return null;
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

// Revisão automática de paginação: conta páginas, acha páginas sem conteúdo no corpo e procura travessão.
export async function verificar(pdf: Buffer | null): Promise<Verificacao> {
  const v: Verificacao = { paginas: null, paginasEmBranco: [], temTravessao: false, pdfGerado: !!pdf, avisos: [] };
  if (!pdf) {
    v.avisos.push("PDF não gerado: o LibreOffice não foi encontrado neste computador. O DOCX está pronto; instale o LibreOffice para ter o PDF e a revisão de paginação.");
    return v;
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, verbosity: 0 }).promise;
  v.paginas = doc.numPages;
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const altura = pagina.getViewport({ scale: 1 }).height;
    const conteudo = await pagina.getTextContent();
    let corpo = "";
    let tudo = "";
    for (const item of conteudo.items as { str: string; transform: number[] }[]) {
      tudo += item.str;
      const y = item.transform[5];
      if (y > 80 && y < altura - 80) corpo += item.str; // ignora cabeçalho e rodapé
    }
    if (corpo.replace(/\s/g, "").length === 0) v.paginasEmBranco.push(i);
    if (temTravessao(tudo)) v.temTravessao = true;
  }
  if (v.paginasEmBranco.length) v.avisos.push(`Página(s) em branco: ${v.paginasEmBranco.join(", ")}.`);
  if (v.temTravessao) v.avisos.push("Foi encontrado travessão longo no texto.");
  return v;
}

export { AlignmentType };
