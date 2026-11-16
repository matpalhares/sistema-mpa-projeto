// Motor de desenho das pranchas (PDF vetorial com pdfkit, medidas em milímetros).
// Regra inegociável das pranchas: nenhum texto, cota ou chamada pode sobrepor outro elemento.
// Por isso todo texto e toda linha de cota são registrados e conferidos por verificarSobreposicoes().
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const MM = 72 / 25.4;
export const COR = { azul: "#0D2F63", dourado: "#C79B63", offwhite: "#F7F4EE", bege: "#E8DFD2", begeLinha: "#D9C9A3", vermelho: "#B3261E", preto: "#1A1A1A", cinza: "#6B7280", parede: "#C9C9C9", branco: "#FFFFFF" };

interface Caixa { x: number; y: number; l: number; a: number; texto: string; folha: number; dono?: number }
interface Segmento { x1: number; y1: number; x2: number; y2: number; folha: number; dono: number }
export interface Sobreposicao { folha: number; a: string; b: string }

const pastaFontes = () => path.join(/* turbopackIgnore: true */ process.cwd(), "recursos", "fontes");

export class Prancha {
  doc: PDFKit.PDFDocument;
  folha = 0;
  largura: number;
  altura: number;
  private caixas: Caixa[] = [];
  private segmentos: Segmento[] = [];
  private pedacos: Buffer[] = [];
  private fim: Promise<Buffer>;
  private proximoDono = 1;
  fonteOk = true;

  constructor(private formato: "A4" | "A3" = "A4") {
    this.doc = new PDFDocument({ size: formato, layout: "landscape", margin: 0, autoFirstPage: false, info: { Creator: "Sistema MPA Projeto" } });
    [this.largura, this.altura] = formato === "A4" ? [297, 210] : [420, 297];
    try {
      this.doc.registerFont("normal", path.join(pastaFontes(), "Montserrat-Regular.ttf"));
      this.doc.registerFont("medio", path.join(pastaFontes(), "Montserrat-Medium.ttf"));
      this.doc.registerFont("forte", path.join(pastaFontes(), "Montserrat-SemiBold.ttf"));
      if (!fs.existsSync(path.join(pastaFontes(), "Montserrat-Regular.ttf"))) throw new Error("sem fonte");
    } catch {
      this.fonteOk = false; // sem Montserrat: usa Helvetica e avisa
      this.doc.registerFont("normal", "Helvetica"); this.doc.registerFont("medio", "Helvetica"); this.doc.registerFont("forte", "Helvetica-Bold");
    }
    this.doc.on("data", (b: Buffer) => this.pedacos.push(b));
    this.fim = new Promise((ok) => this.doc.on("end", () => ok(Buffer.concat(this.pedacos))));
  }

  novaFolha() {
    this.doc.addPage({ size: this.formato, layout: "landscape", margin: 0 });
    this.folha++;
    this.ret(0, 0, this.largura, this.altura, { fundo: COR.branco });
  }

  async fechar(): Promise<Buffer> { this.doc.end(); return this.fim; }

  // ---------- primitivas ----------
  linha(x1: number, y1: number, x2: number, y2: number, o: { cor?: string; esp?: number; traco?: number[] } = {}) {
    const d = this.doc.save().lineWidth((o.esp ?? 0.25) * MM).strokeColor(o.cor ?? COR.preto);
    if (o.traco) d.dash(o.traco[0] * MM, { space: (o.traco[1] ?? o.traco[0]) * MM });
    d.moveTo(x1 * MM, y1 * MM).lineTo(x2 * MM, y2 * MM).stroke().restore();
  }
  ret(x: number, y: number, l: number, a: number, o: { fundo?: string; cor?: string; esp?: number; raio?: number; traco?: number[]; opacidade?: number } = {}) {
    const d = this.doc.save();
    if (o.opacidade != null) d.fillOpacity(o.opacidade);
    if (o.traco) d.dash(o.traco[0] * MM, { space: (o.traco[1] ?? o.traco[0]) * MM });
    if (o.raio) d.roundedRect(x * MM, y * MM, l * MM, a * MM, o.raio * MM); else d.rect(x * MM, y * MM, l * MM, a * MM);
    d.lineWidth((o.esp ?? 0.25) * MM);
    if (o.fundo && o.cor) d.fillAndStroke(o.fundo, o.cor); else if (o.fundo) d.fill(o.fundo); else d.strokeColor(o.cor ?? COR.preto).stroke();
    d.restore();
  }
  circulo(x: number, y: number, r: number, o: { fundo?: string; cor?: string; esp?: number } = {}) {
    const d = this.doc.save().circle(x * MM, y * MM, r * MM).lineWidth((o.esp ?? 0.25) * MM);
    if (o.fundo && o.cor) d.fillAndStroke(o.fundo, o.cor); else if (o.fundo) d.fill(o.fundo); else d.strokeColor(o.cor ?? COR.preto).stroke();
    d.restore();
  }
  poligono(pontos: [number, number][], o: { fundo?: string; cor?: string; esp?: number } = {}) {
    const d = this.doc.save().lineWidth((o.esp ?? 0.25) * MM);
    d.moveTo(pontos[0][0] * MM, pontos[0][1] * MM);
    for (const [x, y] of pontos.slice(1)) d.lineTo(x * MM, y * MM);
    d.closePath();
    if (o.fundo && o.cor) d.fillAndStroke(o.fundo, o.cor); else if (o.fundo) d.fill(o.fundo); else d.strokeColor(o.cor ?? COR.preto).stroke();
    d.restore();
  }
  // Hachura a 45° dentro de um retângulo (peça cortada).
  hachura(x: number, y: number, l: number, a: number, passo = 1.2, cor = COR.cinza) {
    const d = this.doc.save().rect(x * MM, y * MM, l * MM, a * MM).clip().lineWidth(0.12 * MM).strokeColor(cor);
    for (let k = -a; k < l; k += passo) d.moveTo((x + k) * MM, (y + a) * MM).lineTo((x + k + a) * MM, y * MM);
    d.stroke().restore();
  }
  imagem(dados: Buffer, x: number, y: number, l: number, a: number) {
    this.doc.image(dados, x * MM, y * MM, { fit: [l * MM, a * MM], align: "center", valign: "center" });
  }

  larguraTexto(texto: string, tam: number, fonte: "normal" | "medio" | "forte" = "normal") {
    return this.doc.font(fonte).fontSize(tam).widthOfString(texto) / MM;
  }
  // Texto de uma linha. (x, y) é o ponto de ancoragem; y é o topo do texto. Registra a caixa para a conferência.
  texto(texto: string, x: number, y: number, o: { tam?: number; fonte?: "normal" | "medio" | "forte"; cor?: string; alinhar?: "esq" | "centro" | "dir"; espaco?: number; dono?: number; livre?: boolean } = {}) {
    const tam = o.tam ?? 7, fonte = o.fonte ?? "normal";
    this.doc.font(fonte).fontSize(tam);
    const l = this.doc.widthOfString(texto, { characterSpacing: o.espaco ?? 0 }) / MM;
    const a = (tam * 1.15) / MM;
    const x0 = o.alinhar === "centro" ? x - l / 2 : o.alinhar === "dir" ? x - l : x;
    this.doc.fillColor(o.cor ?? COR.preto).text(texto, x0 * MM, y * MM, { lineBreak: false, characterSpacing: o.espaco ?? 0 });
    if (!o.livre) this.caixas.push({ x: x0, y, l, a, texto, folha: this.folha, dono: o.dono });
    return { x: x0, y, l, a };
  }
  // Parágrafo com quebra automática. Devolve a altura usada (mm).
  paragrafo(texto: string, x: number, y: number, largura: number, o: { tam?: number; fonte?: "normal" | "medio" | "forte"; cor?: string; entre?: number } = {}) {
    const tam = o.tam ?? 6.5;
    this.doc.font(o.fonte ?? "normal").fontSize(tam).fillColor(o.cor ?? COR.preto);
    const opcoes = { width: largura * MM, lineGap: (o.entre ?? 0.6) * MM };
    const a = this.doc.heightOfString(texto, opcoes) / MM;
    this.doc.text(texto, x * MM, y * MM, opcoes);
    this.caixas.push({ x, y, l: largura, a, texto: texto.slice(0, 30), folha: this.folha });
    return a;
  }

  private seta(x: number, y: number, dx: number, dy: number, cor: string) {
    const t = 1.4, n = 0.45; // comprimento e meia largura da seta
    this.poligono([[x, y], [x + dx * t - dy * n, y + dy * t + dx * n], [x + dx * t + dy * n, y + dy * t - dx * n]], { fundo: cor });
  }
  // Cota horizontal: mede de x1 a x2; a linha de cota fica em yCota; as linhas de chamada saem de yRef.
  cotaH(x1: number, x2: number, yRef: number, yCota: number, rotulo: string, o: { tam?: number; cor?: string; estreita?: "fora" | "abaixo" } = {}) {
    const cor = o.cor ?? COR.vermelho, tam = o.tam ?? 6.5, dono = this.proximoDono++;
    const s = yCota < yRef ? -1 : 1;
    this.linha(x1, yRef + s * 1, x1, yCota + s * 1.2, { cor, esp: 0.12 });
    this.linha(x2, yRef + s * 1, x2, yCota + s * 1.2, { cor, esp: 0.12 });
    this.segmentos.push({ x1, y1: yRef + s, x2: x1, y2: yCota + s * 1.2, folha: this.folha, dono }, { x1: x2, y1: yRef + s, x2, y2: yCota + s * 1.2, folha: this.folha, dono });
    this.linha(x1, yCota, x2, yCota, { cor, esp: 0.15 });
    this.seta(x1, yCota, 1, 0, cor); this.seta(x2, yCota, -1, 0, cor);
    this.segmentos.push({ x1, y1: yCota, x2, y2: yCota, folha: this.folha, dono });
    const l = this.larguraTexto(rotulo, tam, "medio");
    const cabe = l + 4 < Math.abs(x2 - x1);
    const alt = (tam * 1.15) / MM;
    // Se o número não cabe entre as setas, vai para fora, à direita, com um pequeno prolongamento.
    if (cabe) this.texto(rotulo, (x1 + x2) / 2, yCota - alt - 0.5, { tam, fonte: "medio", cor, alinhar: "centro", dono });
    else if (o.estreita === "abaixo") this.texto(rotulo, (x1 + x2) / 2, yCota + s * 1.2 + (s > 0 ? 0.4 : -alt - 0.4), { tam, fonte: "medio", cor, alinhar: "centro", dono });
    else { this.linha(x2, yCota, x2 + 2, yCota, { cor, esp: 0.15 }); this.texto(rotulo, x2 + 2.6, yCota - alt / 2, { tam, fonte: "medio", cor, dono }); }
  }
  // Cota vertical: mede de y1 a y2; a linha de cota fica em xCota; o número fica ao lado, na horizontal.
  cotaV(y1: number, y2: number, xRef: number, xCota: number, rotulo: string, o: { tam?: number; cor?: string; lado?: "dir" | "esq" } = {}) {
    const cor = o.cor ?? COR.vermelho, tam = o.tam ?? 6.5, dono = this.proximoDono++;
    const s = xCota < xRef ? -1 : 1;
    this.linha(xRef + s * 1, y1, xCota + s * 1.2, y1, { cor, esp: 0.12 });
    this.linha(xRef + s * 1, y2, xCota + s * 1.2, y2, { cor, esp: 0.12 });
    this.segmentos.push({ x1: xRef + s, y1, x2: xCota + s * 1.2, y2: y1, folha: this.folha, dono }, { x1: xRef + s, y1: y2, x2: xCota + s * 1.2, y2, folha: this.folha, dono });
    this.linha(xCota, y1, xCota, y2, { cor, esp: 0.15 });
    this.seta(xCota, Math.min(y1, y2), 0, 1, cor); this.seta(xCota, Math.max(y1, y2), 0, -1, cor);
    this.segmentos.push({ x1: xCota, y1, x2: xCota, y2, folha: this.folha, dono });
    const alt = (tam * 1.15) / MM;
    const lado = o.lado ?? (s > 0 ? "dir" : "esq");
    this.texto(rotulo, lado === "dir" ? xCota + 1.6 : xCota - 1.6, (y1 + y2) / 2 - alt / 2, { tam, fonte: "medio", cor, alinhar: lado === "dir" ? "esq" : "dir", dono });
  }
  // Chamada: ponto sobre o alvo, linha até o rótulo. lado = para onde o texto cresce.
  chamada(xAlvo: number, yAlvo: number, xTexto: number, yTexto: number, rotulo: string, o: { tam?: number; lado?: "dir" | "esq"; sobreImagem?: boolean } = {}) {
    const tam = o.tam ?? 6.5, alt = (tam * 1.15) / MM, dono = this.proximoDono++;
    this.circulo(xAlvo, yAlvo, 0.55, { fundo: COR.azul });
    this.linha(xAlvo, yAlvo, xTexto, yTexto, { cor: COR.azul, esp: 0.15 });
    if (!o.sobreImagem) this.segmentos.push({ x1: xAlvo, y1: yAlvo, x2: xTexto, y2: yTexto, folha: this.folha, dono });
    this.texto(rotulo, o.lado === "esq" ? xTexto - 1 : xTexto + 1, yTexto - alt / 2, { tam, cor: COR.azul, fonte: "medio", alinhar: o.lado === "esq" ? "dir" : "esq", dono });
  }
  // Chamada em cotovelo: desce (ou sobe) na vertical a partir do alvo até a linha do texto e vira para o lado.
  chamadaVertical(xAlvo: number, yAlvo: number, yTexto: number, rotulo: string, o: { tam?: number; lado?: "dir" | "esq" } = {}) {
    const tam = o.tam ?? 6.5, alt = (tam * 1.15) / MM, dono = this.proximoDono++, k = o.lado === "esq" ? -1 : 1;
    this.circulo(xAlvo, yAlvo, 0.55, { fundo: COR.azul });
    this.linha(xAlvo, yAlvo, xAlvo, yTexto, { cor: COR.azul, esp: 0.15 });
    this.linha(xAlvo, yTexto, xAlvo + k * 2.5, yTexto, { cor: COR.azul, esp: 0.15 });
    this.segmentos.push({ x1: xAlvo, y1: yAlvo, x2: xAlvo, y2: yTexto, folha: this.folha, dono });
    this.texto(rotulo, xAlvo + k * 3.3, yTexto - alt / 2, { tam, cor: COR.azul, fonte: "medio", alinhar: k < 0 ? "dir" : "esq", dono });
  }
  // Linha que não pode cruzar textos (ex.: marca de corte).
  linhaConferida(x1: number, y1: number, x2: number, y2: number, o: { cor?: string; esp?: number; traco?: number[] } = {}) {
    this.linha(x1, y1, x2, y2, o);
    this.segmentos.push({ x1, y1, x2, y2, folha: this.folha, dono: this.proximoDono++ });
  }

  // ---------- conferência ----------
  verificarSobreposicoes(): Sobreposicao[] {
    const erros: Sobreposicao[] = [];
    const folga = 0.15;
    for (let i = 0; i < this.caixas.length; i++) {
      const a = this.caixas[i];
      if (a.x < 3 || a.y < 3 || a.x + a.l > this.largura - 3 || a.y + a.a > this.altura - 3) erros.push({ folha: a.folha, a: a.texto, b: "borda da folha" });
      for (let j = i + 1; j < this.caixas.length; j++) {
        const b = this.caixas[j];
        if (a.folha !== b.folha) continue;
        if (a.x + folga < b.x + b.l && b.x + folga < a.x + a.l && a.y + folga < b.y + b.a && b.y + folga < a.y + a.a) erros.push({ folha: a.folha, a: a.texto, b: b.texto });
      }
      for (const s of this.segmentos) {
        if (s.folha !== a.folha || s.dono === a.dono) continue;
        if (cruza(s, a.x + folga, a.y + folga, a.x + a.l - folga, a.y + a.a - folga)) erros.push({ folha: a.folha, a: a.texto, b: "linha de cota ou de chamada" });
      }
    }
    return erros;
  }
}

// Segmento cruza o retângulo? (recorte de Liang-Barsky)
function cruza(s: { x1: number; y1: number; x2: number; y2: number }, xa: number, ya: number, xb: number, yb: number) {
  let t0 = 0, t1 = 1;
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  for (const [p, q] of [[-dx, s.x1 - xa], [dx, xb - s.x1], [-dy, s.y1 - ya], [dy, yb - s.y1]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1;
}

export const metros = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m";
export const cm = (v: number) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " cm";
