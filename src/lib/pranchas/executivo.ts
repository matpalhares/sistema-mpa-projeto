// EXECUTIVO DE ÁREAS MOLHADAS (padrão B, A3 paisagem, carimbo técnico), no modelo do executivo de referência do escritório:
// folha 1 = planta baixa cotada com chamadas, vistas internas, detalhe da bancada, quadro de pontos e alturas, notas e carimbo;
// folha 2 = perspectiva isométrica do ambiente em corte, amostra da pedra, notas e carimbo.
import type { Empresa } from "../tipos";
import { dataBR } from "../formato";
import { imagem } from "../documentos/comum";
import { COR, Prancha, metros, type Sobreposicao } from "./folha";
import { renderizar, type Solido, type V3 } from "./iso";
import { PADRAO } from "./regras-bancada";
import { ALTURA, NOME_PAREDE, alturaTampoDe, saiaDe, barrasDoAmbiente, comprimentoParede, lateraisDaBancada, nbr, type Ambiente, type BancadaAmb, type Barra, type NBR, type Parede, type RespostasAmbiente } from "./ambiente";

const AZUL_VIDRO = "#2F86C4", LARANJA = "#F28C28";
const corPedraRGB = (nome: string): V3 => (/bege bahia/i.test(nome) ? [222, 205, 172] : /ita[uú]nas/i.test(nome) ? [232, 228, 218] : /preto|gabriel/i.test(nome) ? [52, 52, 56] : /verde/i.test(nome) ? [58, 78, 66] : /cinza/i.test(nome) ? [168, 168, 170] : [228, 222, 210]);
const hex = (c: V3) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
const VASO = { tanqueL: 0.36, tanqueP: 0.18, baciaL: 0.38, comprimento: 0.65, alturaBacia: 0.4, alturaTanque: 0.78 };
const semCaixa = (r: RespostasAmbiente) => r.vasoTipo !== "Caixa acoplada";

// ponto do ambiente a partir de (parede, posição ao longo, distância para dentro)
function ponto(a: Ambiente, p: Parede, pos: number, d: number): [number, number] {
  return p === "N" ? [pos, d] : p === "S" ? [pos, a.comprimento - d] : p === "O" ? [d, pos] : [a.largura - d, pos];
}
function retangulo(a: Ambiente, p: Parede, de: number, ate: number, prof: number): [number, number, number, number] {
  return p === "N" ? [de, 0, ate - de, prof] : p === "S" ? [de, a.comprimento - prof, ate - de, prof] : p === "O" ? [0, de, prof, ate - de] : [a.largura - prof, de, prof, ate - de];
}
// vista interna: converte a posição ao longo da parede para a posição na vista (esquerda para a direita)
const naVista = (a: Ambiente, p: Parede, pos: number) => (p === "S" || p === "O" ? comprimentoParede(a, p) - pos : pos);
const vizinhas = (p: Parede): { esq: Parede; dir: Parede } => ({ N: { esq: "O", dir: "L" }, L: { esq: "N", dir: "S" }, S: { esq: "L", dir: "O" }, O: { esq: "S", dir: "N" } } as const)[p];
const paredeInicio = (q: Parede): Parede => (q === "N" || q === "S" ? "O" : "N");

function pontilhado(pr: Prancha, x: number, y: number, l: number, a: number, semente: number) {
  let s = semente * 9301 + 49297;
  const n = Math.min(260, Math.round(l * a * 0.9));
  for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; const px = x + (s / 233280) * l; s = (s * 9301 + 49297) % 233280; const py = y + (s / 233280) * a; pr.circulo(px, py, 0.14, { fundo: i % 3 ? "#8F6E3D" : "#5B4A33" }); }
}

// Cadeia de cotas horizontais. Trecho em que o número não cabe vai para baixo da linha; se o vizinho também estiver lá, desce mais uma linha.
// Devolve quantas linhas extras de texto foram usadas (para afastar a cota total).
function cadeiaH(pr: Prancha, xs: number[], rotulos: string[], yRef: number, yCota: number, tam = 6): number {
  const sg = yCota < yRef ? -1 : 1, alt = (tam * 1.15) / (72 / 25.4);
  const fins: number[] = [];
  let usadas = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    if (!rotulos[i]) continue;
    const l = pr.larguraTexto(rotulos[i], tam, "medio");
    // o número fica dentro dos limites da cadeia, para não cruzar as linhas da cota total
    const meio = Math.min(xs[xs.length - 1] - l / 2 - 0.8, Math.max(xs[0] + l / 2 + 0.8, (xs[i] + xs[i + 1]) / 2));
    if (l + 4.2 < xs[i + 1] - xs[i]) { pr.cotaH(xs[i], xs[i + 1], yRef, yCota, rotulos[i], { tam }); continue; }
    pr.cotaH(xs[i], xs[i + 1], yRef, yCota, "", { tam });
    let linha = 0; while (fins[linha] != null && fins[linha] > meio - l / 2 - 0.8) linha++;
    fins[linha] = meio + l / 2; usadas = Math.max(usadas, linha + 1);
    const yt = sg > 0 ? yCota + 1.7 + linha * (alt + 0.5) : yCota - alt - 0.5 - (linha + 1) * (alt + 0.5);
    pr.texto(rotulos[i], meio, yt, { tam, fonte: "medio", cor: COR.vermelho, alinhar: "centro" });
  }
  return usadas;
}

export interface ResultadoExecutivo { pdf: Buffer; folhas: number; sobreposicoes: Sobreposicao[]; avisos: string[] }

function carimbo(pr: Prancha, empresa: Empresa, logo: Buffer | null, r: RespostasAmbiente, prancha: string, folha: number, total: number) {
  const x = 234, y = 236, l = 176, a = 51, lx = 118; // lx = largura da parte de texto
  pr.ret(x, y, l, a, { cor: COR.preto, esp: 0.5 });
  pr.linha(x + lx, y, x + lx, y + a, { esp: 0.35 });
  const campo = (rot: string, valor: string, cx: number, cy: number, forte = false, tam = 8) => { pr.texto(rot, cx + 1.2, cy + 0.9, { tam: 4.6, cor: COR.cinza }); pr.texto(valor, cx + 1.2, cy + 3.2, { tam, fonte: forte ? "forte" : "normal" }); };
  const linhas = [8.5, 20, 27.5, 35.5, 43];
  for (const ly of linhas) pr.linha(x, y + ly, x + lx, y + ly, { esp: 0.25 });
  campo("CLIENTE", (r.cliente || "A DEFINIR").toUpperCase(), x, y, true);
  pr.texto("LOCAL", x + 1.2, y + 9.4, { tam: 4.6, cor: COR.cinza });
  const local = r.local || "a definir", corte = local.length > 52 ? local.lastIndexOf(",", 52) : -1;
  pr.texto(corte > 0 ? local.slice(0, corte + 1) : local, x + 1.2, y + 11.8, { tam: 7 });
  if (corte > 0) pr.texto(local.slice(corte + 1).trim(), x + 1.2, y + 15.4, { tam: 7 });
  campo("ETAPA", "EXECUTIVO - ÁREAS MOLHADAS", x, y + 20, true, 7.5);
  campo("PRANCHA", prancha.toUpperCase(), x, y + 27.5, true, 8.5);
  pr.linha(x + 70, y + 35.5, x + 70, y + 43, { esp: 0.25 });
  campo("RESP.", empresa.marca.responsavelTecnico, x, y + 35.5, false, 7);
  campo("REVISÃO", "R" + String(r.revisao).padStart(2, "0"), x + 70, y + 35.5, false, 7);
  pr.linha(x + 46, y + 43, x + 46, y + a, { esp: 0.25 }); pr.linha(x + 90, y + 43, x + 90, y + a, { esp: 0.25 });
  campo("ESCALA", "SEM ESCALA", x, y + 43, false, 7);
  campo("DATA", dataBR(r.data), x + 46, y + 43, false, 7);
  campo("FOLHA", `${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`, x + 90, y + 43, true, 8);
  if (logo) pr.imagem(logo, x + lx + 8, y + 12, l - lx - 16, 26);
  pr.texto(`${empresa.marca.email}  ·  ${empresa.marca.telefone}`, x + lx + (l - lx) / 2, y + 41, { tam: 4.6, cor: COR.cinza, alinhar: "centro" });
}
function moldura(pr: Prancha) {
  pr.ret(5, 5, pr.largura - 10, pr.altura - 10, { cor: COR.preto, esp: 0.2 });
  pr.ret(10, 10, pr.largura - 20, pr.altura - 20, { cor: COR.preto, esp: 0.7 });
}
const titulo = (pr: Prancha, t: string, x: number, y: number) => pr.texto(t.toUpperCase(), x, y, { tam: 8.5, fonte: "forte", cor: COR.azul });
function tag(pr: Prancha, t: string, x: number, y: number) {
  pr.circulo(x, y, 2.1, { fundo: COR.branco, cor: COR.preto, esp: 0.25 });
  pr.texto(t, x, y - 1.15, { tam: 4.6, fonte: "forte", alinhar: "centro" });
}

// ---------------- PLANTA BAIXA ----------------
function plantaBaixa(pr: Prancha, a: Ambiente, r: RespostasAmbiente, barras: Barra[], vistas: { parede: Parede; letra: string }[], pedra: string, x: number, y: number, larg: number, alt: number) {
  const W = a.largura, H = a.comprimento, t = a.espessuraParede, mc = 24;
  // porta que abre para fora precisa de espaço para o giro daquele lado
  const fora: Record<Parede, number> = { N: 0, S: 0, L: 0, O: 0 };
  if (a.porta?.abre === "fora") fora[a.porta.parede] = a.porta.largura;
  const s = Math.min((larg - 2 * mc) / (W + 2 * t + fora.O + fora.L), (alt - 2 * mc) / (H + 2 * t + fora.N + fora.S));
  const ox = x + (larg - (W + fora.L - fora.O) * s) / 2, oy = y + (alt - (H + fora.S - fora.N) * s) / 2;
  const X = (v: number) => ox + v * s, Y = (v: number) => oy + v * s;
  pr.ret(X(-t), Y(-t), (W + 2 * t) * s, (H + 2 * t) * s, { fundo: "#8C8C8C", cor: COR.preto, esp: 0.2 });
  pr.ret(X(0), Y(0), W * s, H * s, { fundo: COR.branco, cor: COR.preto, esp: 0.4 });
  // box
  if (a.box) {
    const [bx, by, bl, ba] = retangulo(a, a.box.parede, 0, comprimentoParede(a, a.box.parede === "N" || a.box.parede === "S" ? "N" : "L"), a.box.profundidade);
    pr.ret(X(bx), Y(by), bl * s, ba * s, { fundo: "#EAF2F8" });
    pr.ret(X(bx), Y(by), bl * s, ba * s, { cor: COR.preto, esp: 0.3, traco: [1.4, 0.8] });
    tag(pr, "BX", X(bx + bl / 2), Y(by + ba * 0.82));
  }
  if (a.ralo) {
    const q = 0.15 * s; pr.ret(X(a.ralo.x) - q / 2, Y(a.ralo.y) - q / 2, q, q, { fundo: LARANJA, cor: COR.preto, esp: 0.2 });
    pr.linha(X(a.ralo.x) - q / 2, Y(a.ralo.y) - q / 2, X(a.ralo.x) + q / 2, Y(a.ralo.y) + q / 2, { esp: 0.15 }); pr.linha(X(a.ralo.x) + q / 2, Y(a.ralo.y) - q / 2, X(a.ralo.x) - q / 2, Y(a.ralo.y) + q / 2, { esp: 0.15 });
    const dentro = (v: number, max: number) => (v < max / 2 ? 1 : -1);
    tag(pr, "RL", X(a.ralo.x) + dentro(a.ralo.x, W) * (q / 2 + 3.2), Y(a.ralo.y) + dentro(a.ralo.y, H) * (q / 2 + 3.2));
  }
  if (a.chuveiro) {
    const [cx, cy] = ponto(a, a.chuveiro.parede, a.chuveiro.pos, 0.3), [px, py] = ponto(a, a.chuveiro.parede, a.chuveiro.pos, 0);
    pr.linha(X(px), Y(py), X(cx), Y(cy), { esp: 0.5, cor: "#555555" });
    pr.circulo(X(cx), Y(cy), 0.09 * s, { fundo: "#BDBDBD", cor: COR.preto, esp: 0.25 });
    const [tx, ty] = ponto(a, a.chuveiro.parede, a.chuveiro.pos, 0.3 + 0.09 + 3.4 / s); tag(pr, "CH", X(tx), Y(ty));
    const reg = a.chuveiro.registros === 2 ? [-0.3, -0.14] : [-0.22];
    reg.forEach((d) => { const [rx, ry] = ponto(a, a.chuveiro!.parede, Math.max(0.06, a.chuveiro!.pos + d), 0.035); pr.ret(X(rx) - 0.7, Y(ry) - 0.7, 1.4, 1.4, { fundo: "#9A9A9A", cor: COR.preto, esp: 0.15 }); });
  }
  // vasos
  for (const v of a.vasos) {
    const tanque = semCaixa(r) ? 0 : VASO.tanqueP;
    if (tanque) { const [vx, vy, vl, va] = retangulo(a, v.parede, v.eixo - VASO.tanqueL / 2, v.eixo + VASO.tanqueL / 2, tanque); pr.ret(X(vx), Y(vy), vl * s, va * s, { fundo: "#EFEBE0", cor: COR.preto, esp: 0.25, raio: 0.5 }); }
    const [bx, by, bl, ba] = retangulo(a, v.parede, v.eixo - VASO.baciaL / 2, v.eixo + VASO.baciaL / 2, VASO.comprimento);
    const horiz = v.parede === "N" || v.parede === "S";
    const cortar = tanque * s * 0.85;
    const rx = X(bx) + (v.parede === "O" ? cortar : 0), ry = Y(by) + (v.parede === "N" ? cortar : 0), rl = bl * s - (horiz ? 0 : cortar), ra = ba * s - (horiz ? cortar : 0);
    pr.ret(rx, ry, rl, ra, { fundo: "#EFEBE0", cor: COR.preto, esp: 0.3, raio: Math.min(rl, ra) * 0.48 });
    const [ex, ey] = ponto(a, v.parede, v.eixo, ALTURA.vasoEsgotoEixo);
    pr.circulo(X(ex), Y(ey), 1.5, { cor: COR.vermelho, esp: 0.2 }); pr.linha(X(ex) - 2, Y(ey), X(ex) + 2, Y(ey), { cor: COR.vermelho, esp: 0.15 }); pr.linha(X(ex), Y(ey) - 2, X(ex), Y(ey) + 2, { cor: COR.vermelho, esp: 0.15 });
    const [tx, ty] = ponto(a, v.parede, v.eixo, VASO.comprimento + 3.6 / s); tag(pr, "V", X(tx), Y(ty));
  }
  // bancadas
  a.bancadas.forEach((b, i) => {
    const [bx, by, bl, ba] = retangulo(a, b.parede, b.inicio, b.inicio + b.comprimento, b.profundidade);
    pr.ret(X(bx), Y(by), bl * s, ba * s, { fundo: pedra, cor: COR.preto, esp: 0.35 });
    pontilhado(pr, X(bx) + 0.4, Y(by) + 0.4, bl * s - 0.8, ba * s - 0.8, i + 3);
    const [fx, fy, fl, fa] = retangulo(a, b.parede, b.inicio, b.inicio + b.comprimento, PADRAO.frontaoEsp * 1.6);
    pr.ret(X(fx), Y(fy), fl * s, fa * s, { fundo: COR.preto });
    for (const c of b.cubas) {
      const cl = r.cubaLargura ?? 0.3, cp = r.cubaProfundidade ?? 0.3, meio = (b.profundidade + PADRAO.frontaoEsp) / 2;
      const [qx, qy] = ponto(a, b.parede, b.inicio + c, meio), horiz = b.parede === "N" || b.parede === "S";
      const lw = (horiz ? cl : cp) * s, lh = (horiz ? cp : cl) * s;
      pr.ret(X(qx) - lw / 2, Y(qy) - lh / 2, lw, lh, { fundo: COR.branco, cor: COR.preto, esp: 0.3, raio: 0.6 });
      pr.circulo(X(qx), Y(qy), 0.8, { cor: COR.preto, esp: 0.2 });
      if (r.torneira.startsWith("Mesa")) { const [hx, hy] = ponto(a, b.parede, b.inicio + c, (meio - cp / 2 + PADRAO.frontaoEsp) / 2 + 0.01); pr.circulo(X(hx), Y(hy), 0.75, { fundo: "#8A8A8A", cor: COR.preto, esp: 0.15 }); }
    }
    const [tx, ty] = ponto(a, b.parede, b.inicio + b.comprimento / 2, b.profundidade + 3.6 / s); tag(pr, a.bancadas.length > 1 ? `L${i + 1}` : "L", X(tx), Y(ty));
  });
  // barras de apoio
  barras.forEach((b, i) => {
    const [x1, y1] = ponto(a, b.parede, b.de, 0.06), [x2, y2] = ponto(a, b.parede, b.ate, 0.06);
    if (b.tipo === "vertical") { pr.circulo(X(x1), Y(y1), 0.9, { fundo: "#C0392B" }); return; }
    pr.linha(X(x1), Y(y1), X(x2), Y(y2), { cor: "#C0392B", esp: 1 });
    const eixos = a.vasos.filter((v) => v.parede === b.parede).map((v) => v.eixo);
    const pos = eixos.length ? (Math.abs(b.de - eixos[0]) > Math.abs(b.ate - eixos[0]) ? b.de + 3 / s : b.ate - 3 / s) : (b.de + b.ate) / 2;
    const [tx, ty] = ponto(a, b.parede, pos, 0.06 + 4.2 / s); if (i < 2) tag(pr, "BA", X(tx), Y(ty));
    void i;
  });
  // porta
  if (a.porta) {
    const p = a.porta, [gx, gy, gl, ga] = retangulo(a, p.parede, p.inicio, p.inicio + p.largura, -t);
    const horiz = p.parede === "N" || p.parede === "S";
    pr.ret(horiz ? X(gx) : Math.min(X(gx), X(gx + gl)), horiz ? Math.min(Y(gy), Y(gy + ga)) : Y(gy), Math.abs(gl) * s, Math.abs(ga) * s, { fundo: COR.branco, cor: COR.preto, esp: 0.25 });
    const dob = p.dobradica === "inicio" ? p.inicio : p.inicio + p.largura, sentido = p.dobradica === "inicio" ? 1 : -1;
    const dentro = p.abre === "dentro" ? 1 : -1;
    const [hx, hy] = ponto(a, p.parede, dob, p.abre === "dentro" ? 0 : -t);
    const [lx, ly] = ponto(a, p.parede, dob, (p.abre === "dentro" ? 0 : -t) + dentro * p.largura);
    pr.linha(X(hx), Y(hy), X(lx), Y(ly), { esp: 0.5 });
    // arco do giro
    const pts: [number, number][] = [];
    for (let k = 0; k <= 12; k++) { const ang = (k / 12) * (Math.PI / 2); const ao = dob + sentido * p.largura * Math.sin(ang), pd = (p.abre === "dentro" ? 0 : -t) + dentro * p.largura * Math.cos(ang); const [qx, qy] = ponto(a, p.parede, ao, pd); pts.push([X(qx), Y(qy)]); }
    for (let k = 0; k < pts.length - 1; k++) pr.linha(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], { esp: 0.15, traco: [1, 0.7] });
    const [tx, ty] = ponto(a, p.parede, p.inicio + p.largura / 2, p.abre === "dentro" ? Math.min(0.55, p.largura * 0.6) : 0.3); tag(pr, "P", X(tx), Y(ty));
  }
  // marcas das vistas e nome do ambiente: procuram um lugar livre (sem peça, chamada ou giro de porta)
  const ocupados: [number, number, number, number][] = [];
  const ocupar = (rx: number, ry: number, rl: number, ra: number) => ocupados.push([Math.min(rx, rx + rl), Math.min(ry, ry + ra), Math.abs(rl), Math.abs(ra)]);
  for (const v of a.vasos) { const [vx, vy, vl, va] = retangulo(a, v.parede, v.eixo - 0.25, v.eixo + 0.25, VASO.comprimento + 7.5 / s); ocupar(X(vx), Y(vy), vl * s, va * s); }
  for (const b of a.bancadas) { const [vx, vy, vl, va] = retangulo(a, b.parede, b.inicio, b.inicio + b.comprimento, b.profundidade + 7.5 / s); ocupar(X(vx), Y(vy), vl * s, va * s); }
  if (a.porta && a.porta.abre === "dentro") { const [vx, vy, vl, va] = retangulo(a, a.porta.parede, a.porta.inicio, a.porta.inicio + a.porta.largura, a.porta.largura); ocupar(X(vx), Y(vy), vl * s, va * s); }
  if (a.porta && a.porta.abre === "fora") { const [vx, vy, vl, va] = retangulo(a, a.porta.parede, a.porta.inicio, a.porta.inicio + a.porta.largura, 0.3 + 5 / s); ocupar(X(vx), Y(vy), vl * s, va * s); }
  if (a.chuveiro) { const [qx, qy] = ponto(a, a.chuveiro.parede, a.chuveiro.pos, 0.35); ocupar(X(qx) - 4, Y(qy) - 7, 8, 14); }
  if (a.ralo) ocupar(X(a.ralo.x) - 7, Y(a.ralo.y) - 7, 14, 14);
  if (a.box) { const [bx, by, bl, ba] = retangulo(a, a.box.parede, 0, comprimentoParede(a, a.box.parede === "N" || a.box.parede === "S" ? "N" : "L"), a.box.profundidade); ocupar(X(bx + bl / 2) - 3, Y(by + ba * 0.82) - 3, 6, 6); if (a.box.parede === "N" || a.box.parede === "S") ocupar(X(0), Y(a.box.parede === "N" ? a.box.profundidade : H - a.box.profundidade) - 1, W * s, 2); else ocupar(X(a.box.parede === "O" ? a.box.profundidade : W - a.box.profundidade) - 1, Y(0), 2, H * s); }
  barras.forEach((b) => { const [vx, vy, vl, va] = retangulo(a, b.parede, b.de, b.ate, 0.06 + 7 / s); ocupar(X(vx), Y(vy), vl * s, va * s); });
  const livre = (rx: number, ry: number, rl: number, ra: number) => rx > X(0) + 0.5 && ry > Y(0) + 0.5 && rx + rl < X(W) - 0.5 && ry + ra < Y(H) - 0.5 && !ocupados.some(([ox2, oy2, ol, oa]) => rx < ox2 + ol && ox2 < rx + rl && ry < oy2 + oa && oy2 < ry + ra);
  const grade: [number, number][] = [];
  for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) grade.push([X(W * fx), Y(H * fy)]);
  const ln = pr.larguraTexto(a.nome.toUpperCase(), 8, "forte");
  const pn = grade.find(([gx, gy]) => livre(gx - ln / 2 - 1, gy - 2.2, ln + 2, 4.4));
  if (pn) { pr.texto(a.nome.toUpperCase(), pn[0], pn[1] - 1.6, { tam: 8, fonte: "forte", cor: "#444444", alinhar: "centro" }); ocupar(pn[0] - ln / 2 - 1, pn[1] - 2.2, ln + 2, 4.4); }
  for (const v of vistas) {
    const d: Record<Parede, [number, number]> = { N: [0, -1], S: [0, 1], L: [1, 0], O: [-1, 0] };
    const [dx, dy] = d[v.parede];
    // candidatos do mais perto da parede para o mais longe
    const cand = [...grade].sort((m, k) => (k[0] * dx + k[1] * dy) - (m[0] * dx + m[1] * dy));
    const cx0 = Math.min(0, dx) * 5 - 2.6 + Math.max(0, dx) * 0, cy0 = Math.min(0, dy) * 5 - 2.6;
    const lugar = cand.find(([gx, gy]) => livre(gx + cx0, gy + cy0, 5.2 + Math.abs(dx) * 5, 5.2 + Math.abs(dy) * 5));
    if (!lugar) continue;
    const [mx, my] = lugar; ocupar(mx + cx0, my + cy0, 5.2 + Math.abs(dx) * 5, 5.2 + Math.abs(dy) * 5);
    pr.circulo(mx, my, 2.3, { fundo: COR.branco, cor: COR.preto, esp: 0.35 });
    pr.texto(v.letra, mx, my - 1.35, { tam: 5.4, fonte: "forte", alinhar: "centro" });
    pr.poligono([[mx + dx * 4.6, my + dy * 4.6], [mx + dx * 2.8 - dy * 1.5, my + dy * 2.8 + dx * 1.5], [mx + dx * 2.8 + dy * 1.5, my + dy * 2.8 - dx * 1.5]], { fundo: COR.preto });
  }
  // cotas externas em cadeia, por lado
  const quebras = (p: Parede): number[] => {
    const L = comprimentoParede(a, p), q = [0, L];
    for (const b of a.bancadas) if (b.parede === p) q.push(b.inicio, b.inicio + b.comprimento);
    for (const v of a.vasos) if (v.parede === p) q.push(v.eixo);
    if (a.porta?.parede === p) q.push(a.porta.inicio, a.porta.inicio + a.porta.largura);
    if (a.box && (a.box.parede === "O" || a.box.parede === "L") && (p === "N" || p === "S")) q.push(a.box.parede === "O" ? a.box.profundidade : L - a.box.profundidade);
    if (a.box && (a.box.parede === "N" || a.box.parede === "S") && (p === "L" || p === "O")) q.push(a.box.parede === "N" ? a.box.profundidade : L - a.box.profundidade);
    return [...new Set(q.map((v) => Math.round(Math.min(L, Math.max(0, v)) * 100) / 100))].sort((m, n) => m - n).filter((v, i, arr) => i === 0 || v - arr[i - 1] >= 0.05);
  };
  for (const p of ["N", "S"] as Parede[]) {
    const q = quebras(p), fora = p === "N" ? Y(-t) : Y(H + t), sg = p === "N" ? -1 : 1, n1 = fora + sg * 7;
    const extra = q.length > 2 ? cadeiaH(pr, q.map(X), q.slice(1).map((v, i) => (v - q[i] >= 0.15 ? metros(v - q[i]) : "")), fora, n1) : 0;
    pr.cotaH(X(0), X(W), fora, fora + sg * (q.length > 2 ? 14 + extra * 3 : 7), metros(W), { tam: 6.5 });
  }
  for (const p of ["O", "L"] as Parede[]) {
    const q = quebras(p), fora = p === "O" ? X(-t) : X(W + t), sg = p === "O" ? -1 : 1, n1 = fora + sg * 8, n2 = fora + sg * (q.length > 2 ? 16 : 8);
    if (q.length > 2) for (let i = 0; i < q.length - 1; i++) if (q[i + 1] - q[i] >= 0.15) pr.cotaV(Y(q[i]), Y(q[i + 1]), fora, n1, metros(q[i + 1] - q[i]), { vertical: true, tam: 6 });
    pr.cotaV(Y(0), Y(H), fora, n2, metros(H), { vertical: true, tam: 6.5 });
  }
}

// ---------------- VISTA INTERNA ----------------
function vistaInterna(pr: Prancha, a: Ambiente, r: RespostasAmbiente, barras: Barra[], p: Parede, letra: string, pedra: string, x: number, y: number, larg: number, alt: number) {
  titulo(pr, `Vista ${letra} - Parede ${NOME_PAREDE[p]}`, x, y);
  const L = comprimentoParede(a, p), PD = ALTURA.peDireito;
  const s = Math.min((larg - 34) / L, (alt - 30) / PD);
  const x0 = x + 8 + (larg - 34 - L * s) / 2, yPiso = y + 9 + PD * s;
  const X = (t: number) => x0 + t * s, Z = (z: number) => yPiso - z * s;
  pr.ret(X(0), Z(PD), L * s, PD * s, { fundo: "#F1F1F1", cor: COR.preto, esp: 0.35 });
  pr.linha(X(0) - 5, yPiso, X(L) + 5, yPiso, { esp: 0.6 });
  for (let k = X(0) - 5; k < X(L) + 5; k += 2.4) pr.linha(k, yPiso + 1.6, k + 1.2, yPiso, { esp: 0.1, cor: COR.cinza });
  pr.texto("FORRO DE GESSO / PÉ-DIREITO 3,00 m", X(0) + 1.2, Z(PD) + 1.2, { tam: 4.2, cor: COR.cinza });
  pr.texto(`REVESTIMENTO / PINTURA: ${r.revestimentosDefinidos === "sim" && r.revestimentoParede ? r.revestimentoParede.toUpperCase() : "A DEFINIR"}`, X(0) + 1.2, Z(PD) + 3.4, { tam: 4.2, cor: COR.cinza });
  const cortes = new Set<number>([0, L]);
  const { esq, dir } = vizinhas(p);
  // box
  if (a.box) {
    const hb = Z(ALTURA.box);
    if (a.box.parede === p) { pr.ret(X(0), hb, L * s, yPiso - hb, { cor: AZUL_VIDRO, esp: 0.3, traco: [1.4, 0.9] }); pr.texto("BOX - VIDRO TEMPERADO h=2,00 m", X(L / 2), hb + 1.6, { tam: 4.4, cor: AZUL_VIDRO, alinhar: "centro" }); }
    else if (a.box.parede === esq || a.box.parede === dir) {
      const tv = a.box.parede === esq ? a.box.profundidade : L - a.box.profundidade; cortes.add(tv);
      pr.linhaConferida(X(tv), hb, X(tv), yPiso, { cor: AZUL_VIDRO, esp: 0.4, traco: [1.4, 0.9] });
      pr.texto("VIDRO TEMP. 2,00 m", X(tv) + (a.box.parede === esq ? 1.2 : -1.2), hb + 1.2, { tam: 4.2, cor: AZUL_VIDRO, alinhar: a.box.parede === esq ? "esq" : "dir" });
    }
  }
  // bancadas (de frente nesta parede; de perfil se encostam nela pela ponta)
  for (const b of a.bancadas) {
    const zT = alturaTampoDe(a);
    if (b.parede === p) {
      const t1 = Math.min(naVista(a, p, b.inicio), naVista(a, p, b.inicio + b.comprimento)); cortes.add(t1); cortes.add(t1 + b.comprimento);
      if (r.espelho === "sim") { pr.ret(X(t1), Z(ALTURA.espelhoAte), b.comprimento * s, (ALTURA.espelhoAte - ALTURA.espelhoDe) * s, { fundo: "#E3ECF3", cor: AZUL_VIDRO, esp: 0.2 }); pr.texto("ESPELHO", X(t1 + b.comprimento / 2), Z(1.68), { tam: 4.6, cor: AZUL_VIDRO, alinhar: "centro" }); pr.texto("1,15 a 2,10 m", X(t1 + b.comprimento / 2), Z(1.6), { tam: 4, cor: AZUL_VIDRO, alinhar: "centro" }); }
      pr.ret(X(t1), Z(zT + PADRAO.frontaoAlt), b.comprimento * s, PADRAO.frontaoAlt * s, { fundo: pedra, cor: COR.preto, esp: 0.25 });
      pr.ret(X(t1), Z(zT), b.comprimento * s, saiaDe(a) * s, { fundo: pedra, cor: COR.preto, esp: 0.3 });
      pontilhado(pr, X(t1) + 0.3, Z(zT + PADRAO.frontaoAlt) + 0.3, b.comprimento * s - 0.6, (PADRAO.frontaoAlt + saiaDe(a)) * s - 0.6, 11);
      for (const c of b.cubas) {
        const tc = naVista(a, p, b.inicio + c);
        if (r.torneira.startsWith("Mesa")) { pr.ret(X(tc) - 0.5, Z(zT + 0.14), 1, 0.14 * s, { fundo: "#8A8A8A", cor: COR.preto, esp: 0.12 }); pr.ret(X(tc) - 2, Z(zT + 0.01), 4, 0.5, { fundo: "#8A8A8A" }); }
        const af = X(tc - 0.1), es = X(tc + 0.1);
        pr.circulo(af, Z(ALTURA.lavatorioAF), 0.9, { cor: AZUL_VIDRO, esp: 0.3 }); pr.circulo(af, Z(ALTURA.lavatorioAF), 0.25, { fundo: AZUL_VIDRO });
        pr.circulo(es, Z(ALTURA.lavatorioES), 0.9, { cor: AZUL_VIDRO, esp: 0.3 }); pr.circulo(es, Z(ALTURA.lavatorioES), 0.25, { fundo: AZUL_VIDRO });
        pr.texto("AF 0,60", af - 1.6, Z(ALTURA.lavatorioAF) - 0.9, { tam: 4.2, cor: AZUL_VIDRO, alinhar: "dir" });
        pr.texto("ES 0,50", es + 1.6, Z(ALTURA.lavatorioES) - 0.9, { tam: 4.2, cor: AZUL_VIDRO });
      }
    } else if ((b.parede === esq || b.parede === dir)) {
      const lat = lateraisDaBancada(a, b), noInicio = paredeInicio(b.parede) === p;
      if ((noInicio && lat.inicio === "parede") || (!noInicio && lat.fim === "parede")) {
        const t1 = b.parede === esq ? 0 : L - b.profundidade; cortes.add(b.parede === esq ? b.profundidade : L - b.profundidade);
        pr.ret(X(t1), Z(zT + PADRAO.frontaoAlt), b.profundidade * s, PADRAO.frontaoAlt * s, { fundo: pedra, cor: COR.preto, esp: 0.25 });
        pr.ret(X(t1), Z(zT), b.profundidade * s, saiaDe(a) * s, { fundo: pedra, cor: COR.preto, esp: 0.3 });
      }
    }
  }
  // vasos nesta parede (de frente)
  for (const v of a.vasos) if (v.parede === p) {
    const tc = naVista(a, p, v.eixo); cortes.add(tc);
    if (!semCaixa(r)) pr.ret(X(tc - VASO.tanqueL / 2), Z(VASO.alturaTanque), VASO.tanqueL * s, (VASO.alturaTanque - VASO.alturaBacia) * s, { fundo: "#F3EFE6", cor: COR.preto, esp: 0.25, raio: 0.8 });
    pr.ret(X(tc - VASO.baciaL / 2), Z(VASO.alturaBacia), VASO.baciaL * s, VASO.alturaBacia * s, { fundo: COR.branco, cor: COR.preto, esp: 0.3, raio: 1.2 });
    if (semCaixa(r) && r.vasoTipo.startsWith("Válvula")) { pr.circulo(X(tc), Z(ALTURA.valvulaDescarga), 1.1, { cor: AZUL_VIDRO, esp: 0.3 }); pr.texto("VÁLVULA h=1,00", X(tc) + 2, Z(ALTURA.valvulaDescarga) - 0.9, { tam: 4.2, cor: AZUL_VIDRO }); }
    else if (!semCaixa(r)) { const xa = X(tc - ALTURA.vasoAFAfastamento); pr.circulo(xa, Z(ALTURA.vasoAF), 0.9, { cor: AZUL_VIDRO, esp: 0.3 }); pr.circulo(xa, Z(ALTURA.vasoAF), 0.25, { fundo: AZUL_VIDRO }); pr.texto("AF 0,25", xa, Z(ALTURA.vasoAF) + 1.3, { tam: 4.2, cor: AZUL_VIDRO, alinhar: "centro" }); }
  }
  // chuveiro e registros
  if (a.chuveiro?.parede === p) {
    const tc = naVista(a, p, a.chuveiro.pos);
    pr.ret(X(tc) - 2.2, Z(ALTURA.chuveiro) - 0.6, 4.4, 1.2, { fundo: COR.branco, cor: COR.preto, esp: 0.3, raio: 0.6 });
    pr.texto("DUCHA h=2,10", X(tc), Z(ALTURA.chuveiro) - 3.6, { tam: 4.4, cor: COR.azul, alinhar: "centro" });
    const reg = a.chuveiro.registros === 2 ? [-0.3, -0.14] : [-0.22], sg = p === "S" || p === "O" ? -1 : 1;
    reg.forEach((d) => { const xr = X(tc + sg * d); pr.circulo(xr, Z(ALTURA.registro), 1, { cor: COR.preto, esp: 0.3 }); pr.linha(xr - 1, Z(ALTURA.registro), xr + 1, Z(ALTURA.registro), { esp: 0.15 }); pr.linha(xr, Z(ALTURA.registro) - 1, xr, Z(ALTURA.registro) + 1, { esp: 0.15 }); });
    const tr = tc + sg * (reg.reduce((m, n) => m + n, 0) / reg.length);
    const vidro = a.box && (a.box.parede === esq || a.box.parede === dir) ? (a.box.parede === esq ? a.box.profundidade : L - a.box.profundidade) : null;
    const perto = vidro != null && Math.abs(vidro - tr) * s < 12;
    pr.texto(`REGISTRO${reg.length > 1 ? "S" : ""} h=1,10`, X(tr) + (perto ? (vidro! < tr ? -1.2 : 1.2) : 0), Z(ALTURA.registro) + 1.8, { tam: 4.2, cor: COR.azul, alinhar: perto ? (vidro! < tr ? "esq" : "dir") : "centro" });
  }
  // porta
  if (a.porta?.parede === p) {
    const t1 = Math.min(naVista(a, p, a.porta.inicio), naVista(a, p, a.porta.inicio + a.porta.largura)), lp = a.porta.largura; cortes.add(t1); cortes.add(t1 + lp);
    pr.ret(X(t1), Z(a.porta.altura), lp * s, a.porta.altura * s, { fundo: "#F5F1EA", cor: COR.preto, esp: 0.4 });
    pr.linha(X(t1), Z(a.porta.altura), X(t1 + lp), Z(a.porta.altura / 2), { esp: 0.12, traco: [1.2, 0.8] }); pr.linha(X(t1 + lp), Z(a.porta.altura / 2), X(t1), Z(0), { esp: 0.12, traco: [1.2, 0.8] });
    pr.texto(`PORTA ${metros(lp).replace(" m", "")} x ${metros(a.porta.altura)}`, X(t1 + lp / 2), Z(a.porta.altura) - 3.2, { tam: 4.4, alinhar: "centro" });
  }
  // barras de apoio
  for (const b of barras) if (b.parede === p) {
    const t1 = Math.min(naVista(a, p, b.de), naVista(a, p, b.ate)), lb = b.ate - b.de;
    if (b.tipo === "vertical") { pr.ret(X(t1) - 0.45, Z(b.z2), 0.9, (b.z2 - b.z1) * s, { fundo: "#C0392B" }); pr.texto(`BARRA VERTICAL ${metros(b.z2 - b.z1)}`, X(t1), Z(b.z2) - 3, { tam: 4.2, cor: "#C0392B", alinhar: "centro" }); continue; }
    pr.ret(X(t1), Z(b.z1) - 0.45, lb * s, 0.9, { fundo: "#C0392B" });
    pr.texto(`BARRA DE APOIO h=${metros(b.z1).replace(" m", "")}`, X(t1 + lb / 2), Z(b.z1) + 1.2, { tam: 4.2, cor: "#C0392B", alinhar: "centro" });
  }
  // cotas: alturas à direita, cadeia horizontal embaixo
  const xc = X(L) + 8;
  pr.cotaV(Z(alturaTampoDe(a)), yPiso, X(L), xc, metros(alturaTampoDe(a)), { tam: 6, vertical: true });
  pr.cotaV(Z(ALTURA.porta), Z(alturaTampoDe(a)), X(L), xc, metros(ALTURA.porta - alturaTampoDe(a)), { tam: 6, vertical: true });
  pr.cotaV(Z(PD), Z(ALTURA.porta), X(L), xc, metros(PD - ALTURA.porta), { tam: 6, vertical: true });
  const q = [...cortes].map((v) => Math.round(Math.min(L, Math.max(0, v)) * 100) / 100).sort((m, n) => m - n).filter((v, i, arr) => i === 0 || v - arr[i - 1] >= 0.05);
  if (q[q.length - 1] !== Math.round(L * 100) / 100) q[q.length - 1] = L;
  const extra = q.length > 2 ? cadeiaH(pr, q.map(X), q.slice(1).map((v, i) => (v - q[i] >= 0.15 ? metros(v - q[i]) : "")), yPiso + 1.6, yPiso + 7) : 0;
  pr.cotaH(X(0), X(L), yPiso + 1.6, yPiso + (q.length > 2 ? 14 + extra * 3 : 7), metros(L), { tam: 6.5 });
}

// ---------------- DETALHE DA BANCADA ----------------
function detalheBancada(pr: Prancha, a: Ambiente, b: BancadaAmb, r: RespostasAmbiente, pedra: string, x: number, y: number, larg: number) {
  titulo(pr, `Detalhe da bancada (${r.pedra || "pedra a definir"})`, x, y);
  pr.texto("VISTA SUPERIOR (sem escala)", x, y + 5, { tam: 5, cor: COR.cinza });
  const C = b.comprimento, P = b.profundidade, s = Math.min((larg - 46) / C, 34 / P), x0 = x + 14 + (larg - 46 - C * s) / 2, y0 = y + 27;
  const lat = lateraisDaBancada(a, b), inv = b.parede === "S" || b.parede === "O";
  const esq = inv ? lat.fim : lat.inicio, dir = inv ? lat.inicio : lat.fim;
  pr.ret(x0, y0, C * s, P * s, { fundo: pedra, cor: COR.preto, esp: 0.35 }); pontilhado(pr, x0 + 0.4, y0 + 0.4, C * s - 0.8, P * s - 0.8, 5);
  pr.ret(x0, y0 - 1.2, C * s, 1.2, { fundo: COR.preto });
  if (esq === "parede") pr.ret(x0 - 1.2, y0 - 1.2, 1.2, P * s + 1.2, { fundo: COR.preto });
  if (dir === "parede") pr.ret(x0 + C * s, y0 - 1.2, 1.2, P * s + 1.2, { fundo: COR.preto });
  const cubas = b.cubas.map((c) => (inv ? C - c : c)).sort((m, n) => m - n), cl = r.cubaLargura ?? 0.3, cp = r.cubaProfundidade ?? 0.3, meio = (P + PADRAO.frontaoEsp) / 2;
  const q = [0, C];
  for (const c of cubas) {
    pr.ret(x0 + (c - cl / 2) * s, y0 + (meio - cp / 2) * s, cl * s, cp * s, { fundo: COR.branco, cor: COR.preto, esp: 0.4, traco: [1.6, 0.8] });
    pr.circulo(x0 + c * s, y0 + meio * s, 1, { cor: COR.preto, esp: 0.25 });
    if (r.torneira.startsWith("Mesa")) pr.circulo(x0 + c * s, y0 + ((meio - cp / 2 + PADRAO.frontaoEsp) / 2) * s, 0.9, { fundo: "#8A8A8A", cor: COR.preto, esp: 0.2 });
    q.push(c - cl / 2, c + cl / 2);
  }
  const qs = [...new Set(q.map((v) => Math.round(v * 100) / 100))].sort((m, n) => m - n);
  const extra = qs.length > 2 ? cadeiaH(pr, qs.map((v) => x0 + v * s), qs.slice(1).map((v, i) => metros(v - qs[i])), y0 - 1.2, y0 - 7, 5.6) : 0;
  pr.cotaH(x0, x0 + C * s, y0 - 1.2, y0 - (qs.length > 2 ? 14 + extra * 3 : 7), metros(C), { tam: 6 });
  const xd = x0 + C * s + (dir === "parede" ? 1.2 : 0);
  if (cubas.length) pr.cotaV(y0 + (meio - cp / 2) * s, y0 + (meio + cp / 2) * s, xd, xd + 8, metros(cp), { tam: 5.6, vertical: true });
  pr.cotaV(y0, y0 + P * s, xd, xd + (cubas.length ? 16 : 8), metros(P), { tam: 6, vertical: true });
  // corte transversal
  const yc = y0 + P * s + 20, sc = Math.min(48 / P, 60), wx = x + 20, e = Math.max(PADRAO.tampo * sc, 0.9), xF = wx + P * sc;
  const hp = PADRAO.frontaoAlt * sc + 4 + saiaDe(a) * sc + 4; pr.ret(wx - 5, yc - PADRAO.frontaoAlt * sc - 4, 5, hp, { fundo: COR.parede }); pr.hachura(wx - 5, yc - PADRAO.frontaoAlt * sc - 4, 5, hp, 1.4, "#8A8A8A");
  pr.ret(wx, yc - PADRAO.frontaoAlt * sc, e, PADRAO.frontaoAlt * sc, { fundo: pedra, cor: COR.preto, esp: 0.3 });
  pr.ret(wx, yc, P * sc, e, { fundo: pedra, cor: COR.preto, esp: 0.3 });
  pr.ret(xF - e, yc + e, e, saiaDe(a) * sc - e, { fundo: pedra, cor: COR.preto, esp: 0.3 });
  pr.ret(wx - PADRAO.grapaEmbutida * sc, yc + e, xF - e - PADRAO.grapaFolgaSaia * sc - (wx - PADRAO.grapaEmbutida * sc), 0.03 * sc, { fundo: "#C0392B", cor: COR.preto, esp: 0.15 });
  if (cubas.length) { const c1 = wx + (meio - cp / 2) * sc, c2 = wx + (meio + cp / 2) * sc; pr.poligono([[c1, yc + e], [c1 + 1, yc + e + 0.12 * sc], [c2 - 1, yc + e + 0.12 * sc], [c2, yc + e]], { cor: COR.preto, esp: 0.3 }); }
  const ch: [number, number, string][] = [[wx + e / 2, yc - PADRAO.frontaoAlt * sc * 0.55, "FRONTÃO e=0,02 / h=0,10"], [wx + P * sc * 0.85, yc + e / 2, "TAMPO e=0,02"], [wx + P * sc * 0.3, yc + e + 0.015 * sc, "GRAPA (METALON 40x30 OU BARRA Ø40)"], [xF - e / 2, yc + saiaDe(a) * sc * 0.75, `SAIA h=${metros(saiaDe(a)).replace(" m", "")} (face inferior a ${metros(alturaTampoDe(a) - saiaDe(a)).replace(" m", "")})`]];
  ch.forEach(([ax, ay, t], i) => pr.chamada(ax, ay, xF + 8, yc - 7 + i * 4, t, { tam: 4.8 }));
  pr.cotaH(wx, xF, yc + saiaDe(a) * sc, yc + saiaDe(a) * sc + 5, metros(P), { tam: 5.6 });
  pr.texto("CORTE TRANSVERSAL NO EIXO DA CUBA (sem escala)", x, yc + saiaDe(a) * sc + 10, { tam: 5, cor: COR.cinza });
}

// ---------------- QUADRO E NOTAS ----------------
function quadro(pr: Prancha, a: Ambiente, r: RespostasAmbiente, barras: Barra[], n: NBR, x: number, y: number) {
  pr.texto("QUADRO DE PONTOS E ALTURAS", x, y, { tam: 7, fonte: "forte", cor: COR.azul });
  const linhas: [string, string, string, string][] = [];
  if (a.chuveiro) linhas.push(["CH", r.chuveiroTipo || "Chuveiro", "2,10", ""], ["RG", `Registro${a.chuveiro.registros > 1 ? "s R1 e R2" : ""} (pressão/água)`, "1,10", ""]);
  if (a.ralo) linhas.push(["RL", "Ralo oculto 15x15 (conforme planta)", "piso", "caimento para o ralo; confirmar posição"]);
  if (a.box) linhas.push(["BX", `Box: ${(r.boxTipo || "vidro temperado").toLowerCase()}`, "2,00", "abertura do vidro a confirmar em obra"]);
  if (a.vasos.length) linhas.push(["V", `Vaso sanitário: ${(r.vasoTipo || "a definir").toLowerCase()}`, semCaixa(r) ? (r.vasoTipo.startsWith("Válvula") ? "válvula 1,00" : "conforme modelo") : "AF 0,25 (esq.) / ES piso", semCaixa(r) ? "ES Ø100 mm, eixo a 0,30 m da parede" : "AF à esquerda de quem olha o vaso; ES Ø100 mm a 0,30 m da parede"]);
  if (barras.length) {
    const fundo = barras.find((b) => b.tipo === "fundo"), vert = barras.find((b) => b.tipo === "vertical");
    linhas.push(["BA", "Barras de apoio: lateral e fundo (horizontais) e vertical na parede lateral", `lateral ${metros(n.altura).replace(" m", "")} / fundo ${metros(fundo?.z1 ?? n.altura).replace(" m", "")}`, `NBR 9050:2020, 7.7.2.2: comprimento mín. ${metros(n.comprimento)}; vertical mín. ${metros(vert ? vert.z2 - vert.z1 : 0.7)}; seção de 30 a 45 mm, a 40 mm da parede`]);
  }
  if (a.bancadas.some((b) => b.cubas.length)) linhas.push(["L", `Lavatório: cuba ${(r.cubaTipo || "").toLowerCase()} + torneira ${(r.torneira || "").toLowerCase()}`, "AF 0,60 / ES 0,50", "ES Ø40 mm; conferir no modelo"]);
  if (r.espelho === "sim") linhas.push(["ESP", "Espelho", "1,15 a 2,10", ""]);
  if (a.porta) linhas.push(["P", `Porta ${metros(a.porta.largura).replace(" m", "")} x ${metros(a.porta.altura)}`, metros(a.porta.altura).replace(" m", ""), r.corPorta ? `cor: ${r.corPorta}` : "cor a definir"]);
  const col = [x, x + 8, x + 60, x + 84], L = 128, h = 4.4;
  pr.ret(x, y + 4.5, L, h, { fundo: COR.azul });
  ["TAG", "PONTO / PEÇA", "ALTURA (m)", "OBSERVAÇÃO"].forEach((t, i) => pr.texto(t, col[i] + 1, y + 5.6, { tam: 4.6, fonte: "forte", cor: COR.branco }));
  let ly = y + 4.5 + h;
  linhas.forEach((l, i) => {
    const larguras = [7, 51, 23, L - 85];
    const alturas = l.map((t, k) => (t ? pr.doc.font(k === 0 ? "forte" : "normal").fontSize(4.6).heightOfString(t, { width: larguras[k] * (72 / 25.4) }) / (72 / 25.4) : 0));
    const hl = Math.max(h, Math.max(...alturas) + 2);
    if (i % 2 === 0) pr.ret(x, ly, L, hl, { fundo: "#F3F1EC" });
    pr.linha(x, ly + hl, x + L, ly + hl, { esp: 0.1, cor: COR.cinza });
    l.forEach((t, k) => { if (t) pr.paragrafo(t, col[k] + 1, ly + 1.1, larguras[k], { tam: 4.6, fonte: k === 0 ? "forte" : "normal", entre: 0.2 }); });
    ly += hl;
  });
}
function notas(pr: Prancha, r: RespostasAmbiente, x: number, y: number, larg: number, lista: string[]) {
  pr.texto("NOTAS", x, y, { tam: 7, fonte: "forte", cor: COR.azul });
  let yn = y + 4.6;
  const tam = lista.length > 6 ? 4.1 : 4.8, entre = lista.length > 6 ? 0.2 : 0.35;
  lista.forEach((n, i) => { pr.texto(`${i + 1}.`, x, yn, { tam, livre: true }); yn += pr.paragrafo(n, x + 3.2, yn, larg - 3.2, { tam, entre }) + (lista.length > 6 ? 0.5 : 0.9); });
  void r;
}

// ---------------- PERSPECTIVA ----------------
function cenaAmbiente(a: Ambiente, r: RespostasAmbiente, barras: Barra[], n: NBR): { solidos: Solido[]; azimute: number; alvos: [string, V3][] } {
  const W = a.largura, H = a.comprimento, t = a.espessuraParede, hc = ALTURA.cortePerspectiva;
  // coordenadas da cena: x = leste, y = NORTE (invertido em relação à planta), z = altura
  const Yc = (y: number) => H - y;
  const caixa = (x1: number, y1: number, x2: number, y2: number, z1: number, z2: number, cor: V3, extra: Partial<Solido> = {}): Solido => ({ min: [Math.min(x1, x2), Math.min(Yc(y1), Yc(y2)), z1], max: [Math.max(x1, x2), Math.max(Yc(y1), Yc(y2)), z2], cor, ...extra });
  const naParede = (p: Parede, de: number, ate: number, d1: number, d2: number, z1: number, z2: number, cor: V3, extra: Partial<Solido> = {}) => { const [x1, y1] = ponto(a, p, de, d1), [x2, y2] = ponto(a, p, ate, d2); return caixa(x1, y1, x2, y2, z1, z2, cor, extra); };
  const peso = (p: Parede) => a.bancadas.filter((b) => b.parede === p).length * 3 + a.vasos.filter((v) => v.parede === p).length * 2 + (a.chuveiro?.parede === p ? 2 : 0) + barras.filter((b) => b.parede === p).length - (a.porta?.parede === p ? 0.5 : 0);
  const cantos: { fundo: [Parede, Parede]; az: number }[] = [{ fundo: ["N", "O"], az: -45 }, { fundo: ["N", "L"], az: -135 }, { fundo: ["S", "O"], az: 45 }, { fundo: ["S", "L"], az: 135 }];
  const melhor = cantos.map((c) => ({ ...c, nota: peso(c.fundo[0]) + peso(c.fundo[1]) })).sort((m, k) => k.nota - m.nota)[0];
  const parede: V3 = [226, 224, 218], piso: V3 = [222, 218, 208], louca: V3 = [246, 246, 242], metal: V3 = [150, 154, 160], pedra = corPedraRGB(r.pedra);
  const s: Solido[] = [caixa(-t, -t, W + t, H + t, -0.12, 0, piso)];
  const alvos: [string, V3][] = [];
  const P3 = (p: Parede, pos: number, d: number, z: number): V3 => { const [x, y] = ponto(a, p, pos, d); return [x, Yc(y), z]; };
  for (const p of melhor.fundo) {
    const L = comprimentoParede(a, p);
    if (a.porta?.parede === p) {
      const po = a.porta;
      s.push(naParede(p, -t, po.inicio, -t, 0, 0, hc, parede), naParede(p, po.inicio + po.largura, L + t, -t, 0, 0, hc, parede), naParede(p, po.inicio, po.inicio + po.largura, -t, 0, po.altura, hc, parede));
      s.push(naParede(p, po.inicio, po.inicio + po.largura, -t * 0.6, -t * 0.3, 0, po.altura, [150, 120, 90]));
      alvos.push([`Porta ${metros(po.largura).replace(" m", "")} x ${metros(po.altura)}`, P3(p, po.inicio + po.largura / 2, -t * 0.3, 1.4)]);
    } else s.push(naParede(p, -t, L + t, -t, 0, 0, hc, parede));
  }
  if (a.box) {
    const Lb = comprimentoParede(a, a.box.parede === "N" || a.box.parede === "S" ? "N" : "L");
    s.push(naParede(a.box.parede, 0, Lb, a.box.profundidade - 0.008, a.box.profundidade + 0.008, 0, ALTURA.box, [150, 195, 225], { alfa: 0.38 }));
    s.push(naParede(a.box.parede, 0, Lb, 0, a.box.profundidade, 0, 0.004, [234, 242, 248], { semArestas: true }));
    alvos.push(["Box de vidro temperado h = 2,00 m", P3(a.box.parede, Lb * 0.5, a.box.profundidade, 1.7)]);
  }
  if (a.ralo) { s.push(caixa(a.ralo.x - 0.075, a.ralo.y - 0.075, a.ralo.x + 0.075, a.ralo.y + 0.075, 0, 0.008, [242, 140, 40])); alvos.push(["Ralo oculto 15x15", [a.ralo.x, Yc(a.ralo.y), 0.01]]); }
  if (a.chuveiro) {
    const c = a.chuveiro;
    s.push(naParede(c.parede, c.pos - 0.012, c.pos + 0.012, 0, 0.32, ALTURA.chuveiro, ALTURA.chuveiro + 0.024, metal), naParede(c.parede, c.pos - 0.09, c.pos + 0.09, 0.23, 0.41, ALTURA.chuveiro - 0.03, ALTURA.chuveiro, metal));
    (c.registros === 2 ? [-0.3, -0.14] : [-0.22]).forEach((d) => s.push(naParede(c.parede, c.pos + d - 0.03, c.pos + d + 0.03, 0, 0.04, ALTURA.registro - 0.03, ALTURA.registro + 0.03, metal)));
    alvos.push(["Chuveiro (ducha) h = 2,10 m", P3(c.parede, c.pos, 0.32, ALTURA.chuveiro)], ["Registros h = 1,10 m", P3(c.parede, c.pos - 0.2, 0.04, ALTURA.registro)]);
  }
  for (const v of a.vasos) {
    const tq = semCaixa(r) ? 0 : VASO.tanqueP;
    if (tq) s.push(naParede(v.parede, v.eixo - VASO.tanqueL / 2, v.eixo + VASO.tanqueL / 2, 0, tq, VASO.alturaBacia, VASO.alturaTanque, louca));
    s.push(naParede(v.parede, v.eixo - VASO.baciaL / 2 + 0.04, v.eixo + VASO.baciaL / 2 - 0.04, tq * 0.5, VASO.comprimento - 0.08, 0, VASO.alturaBacia - 0.06, louca));
    s.push(naParede(v.parede, v.eixo - VASO.baciaL / 2, v.eixo + VASO.baciaL / 2, tq, VASO.comprimento, VASO.alturaBacia - 0.06, VASO.alturaBacia, louca));
    alvos.push([`Vaso sanitário: ${(r.vasoTipo || "a definir").toLowerCase()}`, P3(v.parede, v.eixo, VASO.comprimento * 0.6, VASO.alturaBacia)]);
    if (!semCaixa(r)) { s.push(naParede(v.parede, v.eixo - 0.27, v.eixo - 0.23, 0, 0.02, ALTURA.vasoAF - 0.02, ALTURA.vasoAF + 0.02, [47, 134, 196])); alvos.push(["Ponto de água do vaso: AF h = 0,25 m, lado esquerdo", P3(v.parede, v.eixo - 0.25, 0.02, ALTURA.vasoAF)]); }
  }
  a.bancadas.forEach((b) => {
    const z = alturaTampoDe(a), e = PADRAO.tampo, lat = lateraisDaBancada(a, b), f = b.inicio + b.comprimento;
    const cl = r.cubaLargura ?? 0.3, cp = r.cubaProfundidade ?? 0.3, meio = (b.profundidade + PADRAO.frontaoEsp) / 2, rec = r.cubaTipo !== "Sobrepor" && b.cubas.length > 0;
    const pd: Partial<Solido> = { pedra: true };
    if (rec) {
      let ant = b.inicio;
      for (const c of [...b.cubas].sort((m, k) => m - k)) {
        const c1 = b.inicio + c - cl / 2, c2 = b.inicio + c + cl / 2;
        s.push(naParede(b.parede, ant, c1, 0, b.profundidade, z - e, z, pedra, pd));
        s.push(naParede(b.parede, c1, c2, 0, meio - cp / 2, z - e, z, pedra, { ...pd, semArestas: true }), naParede(b.parede, c1, c2, meio + cp / 2, b.profundidade, z - e, z, pedra, { ...pd, semArestas: true }));
        const cb = r.cubaTipo === "Esculpida" ? pedra : louca;
        s.push(naParede(b.parede, c1, c2, meio - cp / 2, meio + cp / 2, z - 0.15, z - 0.13, cb, { pedra: r.cubaTipo === "Esculpida" }));
        s.push(naParede(b.parede, c1 - 0.02, c1, meio - cp / 2, meio + cp / 2, z - 0.15, z - e, cb), naParede(b.parede, c2, c2 + 0.02, meio - cp / 2, meio + cp / 2, z - 0.15, z - e, cb), naParede(b.parede, c1, c2, meio - cp / 2 - 0.02, meio - cp / 2, z - 0.15, z - e, cb), naParede(b.parede, c1, c2, meio + cp / 2, meio + cp / 2 + 0.02, z - 0.15, z - e, cb));
        ant = c2;
      }
      s.push(naParede(b.parede, ant, f, 0, b.profundidade, z - e, z, pedra, pd));
    } else {
      s.push(naParede(b.parede, b.inicio, f, 0, b.profundidade, z - e, z, pedra, pd));
      for (const c of b.cubas) s.push(naParede(b.parede, b.inicio + c - cl / 2, b.inicio + c + cl / 2, meio - cp / 2, meio + cp / 2, z, z + 0.13, louca));
    }
    s.push(naParede(b.parede, b.inicio, f, 0, PADRAO.frontaoEsp, z, z + PADRAO.frontaoAlt, pedra, pd));
    s.push(naParede(b.parede, b.inicio, f, b.profundidade - e, b.profundidade, z - saiaDe(a), z - e, pedra, pd));
    if (lat.inicio === "parede") s.push(naParede(b.parede, b.inicio, b.inicio + PADRAO.frontaoEsp, PADRAO.frontaoEsp, b.profundidade, z, z + PADRAO.frontaoAlt, pedra, pd)); else s.push(naParede(b.parede, b.inicio, b.inicio + e, 0, b.profundidade - e, z - saiaDe(a), z - e, pedra, pd));
    if (lat.fim === "parede") s.push(naParede(b.parede, f - PADRAO.frontaoEsp, f, PADRAO.frontaoEsp, b.profundidade, z, z + PADRAO.frontaoAlt, pedra, pd)); else s.push(naParede(b.parede, f - e, f, 0, b.profundidade - e, z - saiaDe(a), z - e, pedra, pd));
    for (const c of b.cubas) if (r.torneira.startsWith("Mesa")) {
      const alta = /alta|monocomando/i.test(r.torneira), th = alta ? 0.26 : 0.12, d = (meio - cp / 2 + PADRAO.frontaoEsp) / 2 + 0.01;
      s.push(naParede(b.parede, b.inicio + c - 0.015, b.inicio + c + 0.015, d - 0.015, d + 0.015, z, z + th, metal), naParede(b.parede, b.inicio + c - 0.012, b.inicio + c + 0.012, d, d + 0.13, z + th - 0.025, z + th, metal));
    }
    if (r.espelho === "sim") { s.push(naParede(b.parede, b.inicio, f, 0, 0.012, ALTURA.espelhoDe, ALTURA.espelhoAte, [190, 212, 228])); alvos.push(["Espelho de 1,15 a 2,10 m", P3(b.parede, b.inicio + b.comprimento / 2, 0.012, 1.7)]); }
    alvos.push([`${r.pedra || "Pedra"}: tampo 2 cm, saia ${Math.round(saiaDe(a) * 100)} cm e frontão 10 cm`, P3(b.parede, b.inicio + b.comprimento * 0.2, b.profundidade * 0.8, z)]);
    if (b.cubas.length) alvos.push([`Cuba ${(r.cubaTipo || "").toLowerCase()} e torneira ${(r.torneira || "").toLowerCase()}`, P3(b.parede, b.inicio + b.cubas[0], meio, rec ? z - 0.13 : z + 0.13)]);
  });
  barras.forEach((b) => {
    if (b.tipo === "vertical") { s.push(naParede(b.parede, b.de - 0.018, b.de + 0.018, 0.04, 0.075, b.z1, b.z2, [192, 57, 43])); alvos.push([`Barra vertical de ${metros(b.z2 - b.z1)} (NBR 9050)`, P3(b.parede, b.de, 0.075, (b.z1 + b.z2) / 2)]); return; }
    s.push(naParede(b.parede, b.de, b.ate, 0.04, 0.075, b.z1 - 0.018, b.z1 + 0.018, [192, 57, 43]));
    alvos.push([`Barra de apoio ${b.tipo === "fundo" ? "do fundo" : "lateral"} h = ${metros(b.z1)} (NBR 9050)`, P3(b.parede, (b.de + b.ate) / 2, 0.075, b.z1)]);
  });
  void n;
  return { solidos: s, azimute: melhor.az, alvos };
}

export async function gerarExecutivo(empresa: Empresa, a: Ambiente, r: RespostasAmbiente, o: { folhaInicial?: number; totalFolhas?: number; parametros?: NBR } = {}): Promise<ResultadoExecutivo> {
  const pr = new Prancha("A3");
  const logo = await imagem(empresa.marca.logoEscuro);
  const n = o.parametros ?? nbr();
  const acess = a.acessivel === "sim" ? barrasDoAmbiente(a, n, !semCaixa(r)) : { barras: [], avisos: [] };
  const pedra = hex(corPedraRGB(r.pedra).map((v) => v + (255 - v) * 0.25) as V3);
  const f1 = o.folhaInicial ?? 1, total = o.totalFolhas ?? 2;
  const avisos = [...acess.avisos];
  if (a.bancadas.length > 1) avisos.push(`${a.nome}: há mais de uma bancada; o detalhe da folha mostra a primeira. As demais saem nas pranchas de marmoraria.`);

  // paredes com elementos viram vistas (no máximo 4; com bancada, 3 vistas + detalhe)
  const temAlgo = (p: Parede) => a.bancadas.some((b) => b.parede === p) || a.vasos.some((v) => v.parede === p) || a.chuveiro?.parede === p || a.porta?.parede === p || acess.barras.some((b) => b.parede === p) || a.box?.parede === p;
  const maxVistas = a.bancadas.length ? 3 : 4;
  const ordem = (["N", "L", "S", "O"] as Parede[]).filter(temAlgo).slice(0, maxVistas);
  const vistas = ordem.map((p, i) => ({ parede: p, letra: "ABCD"[i] }));

  // ===== FOLHA 1 =====
  pr.novaFolha(); moldura(pr);
  titulo(pr, `Planta baixa - ${a.nome}`, 16, 15);
  plantaBaixa(pr, a, r, acess.barras, vistas, pedra, 14, 22, 146, 206);
  const vagas: [number, number][] = [[166, 15], [292, 15], [166, 126], [292, 126]];
  vistas.forEach((v, i) => vistaInterna(pr, a, r, acess.barras, v.parede, v.letra, pedra, vagas[i][0], vagas[i][1], 118, 104));
  if (a.bancadas.length) detalheBancada(pr, a, a.bancadas[0], r, pedra, vagas[3][0], vagas[3][1], 118);
  quadro(pr, a, r, acess.barras, n, 16, 238);
  notas(pr, r, 150, 238, 80, [
    `Medidas em metros, lidas da planta${r.origemPlanta ? ` "${r.origemPlanta}"` : ""}. Conferir todas as medidas no local antes de executar.`,
    "Alturas dos pontos a partir do piso acabado. Forro de gesso e pé-direito de 3,00 m.",
    r.revestimentosDefinidos === "sim" ? `Revestimentos: piso ${r.revestimentoPiso || "a definir"}; parede ${r.revestimentoParede || "a definir"}; porta ${r.corPorta || "a definir"}; pintura ${r.pintura || "a definir"}.` : "Revestimentos de piso e parede, cor das portas e pintura: A DEFINIR (representação genérica em tons neutros).",
    `Bancadas: tampo 2 cm; frontão 2 cm x 10 cm nos lados encostados; saia de ${Math.round(saiaDe(a) * 100)} cm (topo do tampo a ${metros(alturaTampoDe(a))}, saia fecha em ${metros(alturaTampoDe(a) - saiaDe(a))}); lateral aberta sem frontão e com saia; cantos em meia esquadria.`,
    "Fixação das bancadas por grapas (barra de metalon 40x30 mm ou barra Ø40 mm) nas laterais, a 3 a 4 cm da saia, fora de ligações hidráulicas, sifão e recortes (ver pranchas de marmoraria).",
    "Caimento do piso em direção ao ralo e impermeabilização das áreas molhadas conforme projeto e normas aplicáveis.",
    ...(a.acessivel === "sim" && a.bancadas.length ? ["Sanitário acessível: superfície superior do lavatório a 0,80 m e altura livre inferior de 0,73 m, com saia reduzida para 7 cm (ABNT NBR 9050:2020, itens 7.5 e 7.10.3)."] : []),
    ...(acess.barras.length ? ["Barras de apoio conforme ABNT NBR 9050:2020, item 7.7.2.2: seção de 30 a 45 mm, a no mínimo 40 mm da parede, resistência mínima de 150 kg. Bacia sem abertura frontal, com 0,43 a 0,45 m de altura sem o assento. Conferir com o modelo da bacia."] : []),
  ]);
  carimbo(pr, empresa, logo, r, `${a.nome} - Executivo`, f1, total);

  // ===== FOLHA 2 =====
  pr.novaFolha(); moldura(pr);
  titulo(pr, `Perspectiva isométrica - ${a.nome}`, 16, 15);
  pr.texto("Corte esquemático das paredes a 2,60 m (pé-direito 3,00 m). Imagem ilustrativa: revestimentos, pintura e cor de portas a definir.", 16, 20.5, { tam: 5, cor: COR.cinza });
  const c3 = cenaAmbiente(a, r, acess.barras, n);
  const ix = 110, iy = 26, iw = 200, ih = 204;
  const img = await renderizar(c3.solidos, Math.round(iw * 7), Math.round(ih * 7), { azimute: c3.azimute, elevacao: 34 });
  pr.imagem(img.png, ix, iy, iw, ih);
  const proj = c3.alvos.map(([t, p]) => { const [u, v] = img.projetar(p); return { t, x: ix + u * iw, y: iy + v * ih }; });
  const meioX = ix + iw / 2;
  const lado = (esq: boolean) => proj.filter((q) => (q.x < meioX) === esq).sort((m, k) => m.y - k.y);
  const coluna = (lista: typeof proj, esq: boolean) => {
    const passo = Math.min(16, 190 / Math.max(1, lista.length)), y0 = iy + (ih - passo * (lista.length - 1)) / 2;
    lista.forEach((q, i) => { const ty = y0 + i * passo, tx = esq ? 104 : 316; pr.chamada(q.x, q.y, tx, ty, q.t.length > 70 ? q.t.slice(0, 69) + "…" : q.t, { lado: esq ? "esq" : "dir", tam: 5.6, sobreImagem: true }); });
  };
  coluna(lado(true), true); coluna(lado(false), false);
  if (a.bancadas.length) {
    pr.texto("AMOSTRA DA PEDRA", 16, 238, { tam: 7, fonte: "forte", cor: COR.azul });
    pr.ret(16, 243, 44, 24, { fundo: pedra, cor: COR.preto, esp: 0.25 }); pontilhado(pr, 16.4, 243.4, 43.2, 23.2, 21);
    pr.texto(r.pedra, 16, 269.5, { tam: 6, fonte: "forte" });
    pr.texto("Textura ilustrativa; conferir a chapa na marmoraria.", 16, 273.5, { tam: 4.6, cor: COR.cinza });
  }
  notas(pr, r, 90, 238, 138, [
    "Perspectiva isométrica em vista alta, com as paredes da frente em corte, para leitura de pontos, bancadas e louças.",
    "As alturas e posições seguem a planta baixa e o quadro de pontos da folha anterior.",
    "Louças, metais e vaso são representados de forma esquemática: conferir os modelos escolhidos.",
  ]);
  carimbo(pr, empresa, logo, r, `${a.nome} - Perspectiva isométrica`, f1 + 1, total);

  const sobreposicoes = pr.verificarSobreposicoes();
  if (sobreposicoes.length) avisos.push(`A conferência automática achou ${sobreposicoes.length} sobreposição(ões) de texto ou cota em ${a.nome}. Revise a prancha antes de enviar.`);
  return { pdf: await pr.fechar(), folhas: 2, sobreposicoes, avisos };
}
