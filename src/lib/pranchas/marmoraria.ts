// Prancha de MARMORARIA (padrão A, A4 paisagem, sem escala fixa): vista superior cotada, vista frontal,
// corte A, perspectiva isométrica renderizada e notas; folha 2 com a fixação (grapas) e a lista de peças.
import type { Empresa } from "../tipos";
import { dataBR } from "../formato";
import { imagem } from "../documentos/comum";
import { COR, Prancha, cm, metros, type Sobreposicao } from "./folha";
import { renderizar, type Solido, type V3 } from "./iso";
import { PADRAO, eixoCuba, pecasBancada, temCuba, type DadosBancada } from "./regras-bancada";

const CORES_PEDRA: [RegExp, V3][] = [
  [/bege bahia/i, [222, 205, 172]], [/ita[uú]nas/i, [232, 228, 218]], [/preto|s[aã]o gabriel/i, [52, 52, 56]], [/verde/i, [58, 78, 66]],
  [/siena|branco/i, [236, 233, 226]], [/cinza/i, [168, 168, 170]], [/m[aá]rmore/i, [238, 236, 230]],
];
const corPedra = (nome: string): V3 => CORES_PEDRA.find(([r]) => r.test(nome))?.[1] ?? [205, 200, 190];
const hexRGB = (c: V3) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

export interface ResultadoPrancha { pdf: Buffer; folhas: number; sobreposicoes: Sobreposicao[]; avisos: string[] }

function moldura(pr: Prancha, empresa: Empresa, logo: Buffer | null, d: DadosBancada, titulo: string, sub: string, folha: number, total: number) {
  const m = empresa.marca, L = pr.largura, A = pr.altura;
  if (logo) pr.imagem(logo, 10, 7.5, 24, 14);
  pr.texto(titulo, 38, 8.5, { tam: 15, fonte: "forte", cor: COR.azul, espaco: 1.2 });
  pr.texto(sub, 38, 16.5, { tam: 7.5, cor: COR.cinza });
  pr.texto(`Cliente: ${d.cliente || "a definir"}`, L - 10, 8, { tam: 7, fonte: "medio", cor: COR.azul, alinhar: "dir" });
  pr.texto(`Local: ${d.local || "a definir"}`, L - 10, 12.2, { tam: 6.5, cor: COR.cinza, alinhar: "dir" });
  pr.texto(`Prancha: ${d.nomePrancha || d.ambiente}  ·  Data: ${dataBR(d.data)}  ·  Revisão: R${String(d.revisao).padStart(2, "0")}`, L - 10, 16.2, { tam: 6.5, cor: COR.cinza, alinhar: "dir" });
  pr.linha(10, 23.5, L - 10, 23.5, { cor: COR.dourado, esp: 0.5 });
  pr.linha(10, A - 14, L - 10, A - 14, { cor: COR.begeLinha, esp: 0.3 });
  pr.texto(`${m.telefone}  ·  ${m.email}  ·  ${m.instagram}  ·  ${m.responsavelTecnico}  ·  ${m.registro}`, 10, A - 12.4, { tam: 6, cor: COR.cinza });
  pr.texto(`FOLHA ${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`, L - 10, A - 12.4, { tam: 6.5, fonte: "forte", cor: COR.azul, alinhar: "dir" });
  pr.texto("CONFERIR MEDIDAS NO LOCAL ANTES DA EXECUÇÃO.  DESENHO SEM ESCALA.", L / 2, A - 8, { tam: 6.5, fonte: "forte", cor: COR.vermelho, alinhar: "centro" });
}
const tituloBloco = (pr: Prancha, t: string, x: number, y: number) => pr.texto(t.toUpperCase(), x, y, { tam: 6.5, fonte: "forte", cor: COR.dourado, espaco: 0.8 });

// Geometria da planta (vista superior), reaproveitada na folha de fixação.
function planta(pr: Prancha, d: DadosBancada, x: number, y: number, larg: number, alt: number, pedra: string, modo: "cotas" | "fixacao") {
  const C = d.comprimento!, P = d.profundidade!;
  const mEsq = 24, mDir = 20, mTopo = 13, mBase = modo === "cotas" && temCuba(d) ? 15 : 5;
  const s = Math.min((larg - mEsq - mDir) / C, (alt - mTopo - mBase) / P);
  const x0 = x + mEsq + (larg - mEsq - mDir - C * s) / 2, y0 = y + mTopo; // canto fundo-esquerda do tampo
  const xF = x0 + C * s, yF = y0 + P * s;
  const par = 2.2; // espessura desenhada da parede
  pr.ret(x0 - (d.lateralEsquerda === "parede" ? par : 0), y0 - par, C * s + (d.lateralEsquerda === "parede" ? par : 0) + (d.lateralDireita === "parede" ? par : 0), par, { fundo: COR.parede });
  if (d.lateralEsquerda === "parede") pr.ret(x0 - par, y0, par, P * s + 3, { fundo: COR.parede });
  if (d.lateralDireita === "parede") pr.ret(xF, y0, par, P * s + 3, { fundo: COR.parede });
  pr.ret(x0, y0, C * s, P * s, { fundo: pedra, cor: COR.preto, esp: 0.35 });
  const fr = Math.max(PADRAO.frontaoEsp * s, 0.9);
  pr.ret(x0, y0, C * s, fr, { fundo: COR.bege, cor: COR.preto, esp: 0.2 }); pr.hachura(x0, y0, C * s, fr, 1);
  if (d.lateralEsquerda === "parede") { pr.ret(x0, y0 + fr, fr, P * s - fr, { fundo: COR.bege, cor: COR.preto, esp: 0.2 }); pr.hachura(x0, y0 + fr, fr, P * s - fr, 1); }
  if (d.lateralDireita === "parede") { pr.ret(xF - fr, y0 + fr, fr, P * s - fr, { fundo: COR.bege, cor: COR.preto, esp: 0.2 }); pr.hachura(xF - fr, y0 + fr, fr, P * s - fr, 1); }
  const cx = x0 + eixoCuba(d) * s;
  let cuba: { x: number; y: number; l: number; a: number } | null = null;
  if (temCuba(d)) {
    const l = d.cubaLargura! * s, a = d.cubaProfundidade! * s;
    const cy = y0 + fr + (P * s - fr) / 2 + (d.torneira.startsWith("Mesa") ? Math.min(1.5, (P * s - fr - a) / 4) : 0);
    cuba = { x: cx - l / 2, y: cy - a / 2, l, a };
    pr.ret(cuba.x, cuba.y, l, a, { fundo: COR.branco, cor: COR.preto, esp: 0.3, raio: Math.min(2, l / 6, a / 6) });
    if (d.cubaTipo === "Esculpida") pr.ret(cuba.x + 1, cuba.y + 1, l - 2, a - 2, { cor: COR.cinza, esp: 0.12, raio: 1 });
    pr.circulo(cx, cy, 0.9, { cor: COR.preto, esp: 0.2 }); // válvula centralizada
    if (d.torneira.startsWith("Mesa")) pr.circulo(cx, (y0 + fr + cuba.y) / 2, 0.7, { fundo: COR.branco, cor: COR.preto, esp: 0.25 });
  }
  return { s, x0, y0, xF, yF, cx, cuba, par, fr };
}

function cena(d: DadosBancada): { solidos: Solido[]; azimute: number; alvos: Record<string, V3> } {
  const C = d.comprimento!, P = d.profundidade!, H = (d.alturaTampo ?? PADRAO.alturaTampo), e = PADRAO.tampo;
  const pedra = corPedra(d.pedra), parede: V3 = [228, 226, 220], piso: V3 = [214, 208, 198], louca: V3 = [248, 248, 246], metal: V3 = [176, 180, 186];
  // A câmera fica do lado em que não há parede lateral (parede do lado da câmera é omitida, como em corte).
  const cameraDireita = !(d.lateralDireita === "parede" && d.lateralEsquerda !== "parede");
  const s: Solido[] = [];
  const cx = eixoCuba(d);
  s.push({ min: [-0.25, -0.45, -0.03], max: [C + 0.25, P + 0.1, 0], cor: piso, semArestas: true });
  s.push({ min: [-0.25, P, 0], max: [C + 0.25, P + 0.1, 1.3], cor: parede });
  if (d.lateralEsquerda === "parede" && cameraDireita) s.push({ min: [-0.1, -0.2, 0], max: [0, P, 1.3], cor: parede });
  if (d.lateralDireita === "parede" && !cameraDireita) s.push({ min: [C, -0.2, 0], max: [C + 0.1, P, 1.3], cor: parede });
  const recorte = temCuba(d) && d.cubaTipo !== "Sobrepor"; // semiencaixe é desenhada como recorte (ilustrativo)
  const cl = d.cubaLargura ?? 0, cp = d.cubaProfundidade ?? 0;
  const cy = (P - PADRAO.frontaoEsp) / 2 - (d.torneira.startsWith("Mesa") ? Math.min(0.03, (P - cp) / 4) : 0); // y = 0 na frente
  if (recorte) {
    const x1 = cx - cl / 2, x2 = cx + cl / 2, y1 = cy - cp / 2, y2 = cy + cp / 2;
    s.push({ min: [0, 0, H - e], max: [x1, P, H], cor: pedra, pedra: true }, { min: [x2, 0, H - e], max: [C, P, H], cor: pedra, pedra: true });
    s.push({ min: [x1, 0, H - e], max: [x2, y1, H], cor: pedra, pedra: true, semArestas: true }, { min: [x1, y2, H - e], max: [x2, P, H], cor: pedra, pedra: true, semArestas: true });
    const fundo = H - 0.13, cb = d.cubaTipo === "Esculpida" ? pedra : louca, tx = d.cubaTipo === "Esculpida";
    s.push({ min: [x1, y1, fundo - 0.02], max: [x2, y2, fundo], cor: cb, pedra: tx });
    s.push({ min: [x1 - 0.02, y1 - 0.02, fundo - 0.02], max: [x1, y2 + 0.02, H - e], cor: cb, pedra: tx }, { min: [x2, y1 - 0.02, fundo - 0.02], max: [x2 + 0.02, y2 + 0.02, H - e], cor: cb, pedra: tx });
    s.push({ min: [x1, y2, fundo - 0.02], max: [x2, y2 + 0.02, H - e], cor: cb, pedra: tx }, { min: [x1, y1 - 0.02, fundo - 0.02], max: [x2, y1, H - e], cor: cb, pedra: tx });
    s.push({ min: [cx - 0.022, cy - 0.022, fundo], max: [cx + 0.022, cy + 0.022, fundo + 0.004], cor: metal });
  } else {
    s.push({ min: [0, 0, H - e], max: [C, P, H], cor: pedra, pedra: true });
    if (temCuba(d)) {
      const y1 = cy - cp / 2, y2 = cy + cp / 2, z1 = H, z2 = H + 0.13;
      const x1 = cx - cl / 2, x2 = cx + cl / 2, t = 0.02;
      s.push({ min: [x1, y1, z1], max: [x2, y2, z1 + 0.02], cor: louca });
      s.push({ min: [x1, y1, z1], max: [x1 + t, y2, z2], cor: louca }, { min: [x2 - t, y1, z1], max: [x2, y2, z2], cor: louca }, { min: [x1, y1, z1], max: [x2, y1 + t, z2], cor: louca }, { min: [x1, y2 - t, z1], max: [x2, y2, z2], cor: louca });
    }
  }
  s.push({ min: [0, P - PADRAO.frontaoEsp, H], max: [C, P, H + PADRAO.frontaoAlt], cor: pedra, pedra: true });
  if (d.lateralEsquerda === "parede") s.push({ min: [0, 0, H], max: [PADRAO.frontaoEsp, P - PADRAO.frontaoEsp, H + PADRAO.frontaoAlt], cor: pedra, pedra: true });
  if (d.lateralDireita === "parede") s.push({ min: [C - PADRAO.frontaoEsp, 0, H], max: [C, P - PADRAO.frontaoEsp, H + PADRAO.frontaoAlt], cor: pedra, pedra: true });
  s.push({ min: [0, 0, H - (d.saia ?? PADRAO.saia)], max: [C, e, H - e], cor: pedra, pedra: true });
  if (d.lateralEsquerda === "aberta") s.push({ min: [0, e, H - (d.saia ?? PADRAO.saia)], max: [e, P, H - e], cor: pedra, pedra: true });
  if (d.lateralDireita === "aberta") s.push({ min: [C - e, e, H - (d.saia ?? PADRAO.saia)], max: [C, P, H - e], cor: pedra, pedra: true });
  const alvos: Record<string, V3> = {
    "Frontão 10 cm": [C * (cameraDireita ? 0.82 : 0.18), P - 0.01, H + PADRAO.frontaoAlt],
    "Tampo 2 cm": [C * (cameraDireita ? 0.9 : 0.1), P * 0.35, H],
    [`Saia ${cm(d.saia ?? PADRAO.saia)}`]: [C * (cameraDireita ? 0.8 : 0.2), 0, H - 0.12],
  };
  if (temCuba(d)) alvos[`Cuba ${d.cubaTipo.toLowerCase()}`] = [cx, cy, recorte ? H - 0.13 : H + 0.05];
  if (d.torneira.startsWith("Mesa") || d.torneira === "Parede") {
    const alta = /alta|monocomando/i.test(d.torneira), parede = d.torneira === "Parede";
    const ty = parede ? P - PADRAO.frontaoEsp - 0.02 : Math.min(P - PADRAO.frontaoEsp - 0.03, cy + cp / 2 + 0.05);
    const tz = parede ? H + 0.25 : H, th = parede ? 0.03 : alta ? 0.26 : 0.12;
    if (!parede) s.push({ min: [cx - 0.015, ty - 0.015, tz], max: [cx + 0.015, ty + 0.015, tz + th], cor: metal });
    s.push({ min: [cx - 0.012, ty - 0.14, tz + th - 0.025], max: [cx + 0.012, ty + (parede ? 0.02 : 0.015), tz + th], cor: metal });
    alvos["Torneira"] = [cx, ty - 0.06, tz + th];
  }
  return { solidos: s, azimute: cameraDireita ? -55 : -125, alvos };
}

export async function gerarPranchaMarmoraria(empresa: Empresa, d: DadosBancada, situacao?: Buffer | null): Promise<ResultadoPrancha> {
  const C = d.comprimento!, P = d.profundidade!;
  const pr = new Prancha("A4");
  const logo = await imagem(empresa.marca.logoPrancha ?? empresa.marca.logoEscuro);
  const pedra = hexRGB(corPedra(d.pedra).map((x) => x + (255 - x) * 0.45) as V3);
  const sub = `Bancada  ·  ${d.ambiente}  ·  ${d.pedra}`;
  const avisos: string[] = [];
  if (!pr.fonteOk) avisos.push("Fonte Montserrat não encontrada: a prancha saiu em Helvetica.");

  // ================= FOLHA 1 =================
  pr.novaFolha();
  moldura(pr, empresa, logo, d, "MARMORARIA", sub, 1, 2);

  // ---- Vista superior ----
  tituloBloco(pr, "Vista superior", 10, 27);
  const g = planta(pr, d, 10, 30, 132, 68, pedra, "cotas");
  pr.cotaH(g.x0, g.xF, g.y0 - g.par, g.y0 - g.par - 6, metros(C));
  pr.cotaV(g.y0, g.yF, g.x0 - (d.lateralEsquerda === "parede" ? g.par : 0), g.x0 - (d.lateralEsquerda === "parede" ? g.par : 0) - 6, metros(P), { lado: "esq" });
  if (g.cuba) {
    // cotas em cadeia na frente: ponta esquerda até a cuba, largura da cuba, cuba até a ponta direita
    const e1 = eixoCuba(d) - d.cubaLargura! / 2, e2 = C - eixoCuba(d) - d.cubaLargura! / 2;
    pr.cotaH(g.x0, g.cuba.x, g.yF, g.yF + 6, metros(e1), { estreita: "abaixo" });
    pr.cotaH(g.cuba.x, g.cuba.x + g.cuba.l, g.yF, g.yF + 6, metros(d.cubaLargura!), { estreita: "abaixo" });
    pr.cotaH(g.cuba.x + g.cuba.l, g.xF, g.yF, g.yF + 6, metros(e2), { estreita: "abaixo" });
    pr.cotaV(g.cuba.y, g.cuba.y + g.cuba.a, g.xF + (d.lateralDireita === "parede" ? g.par : 0), g.xF + (d.lateralDireita === "parede" ? g.par : 0) + 5, metros(d.cubaProfundidade!));
  }
  // marca do corte A (no eixo da cuba, ou no meio da bancada)
  const xa = g.cuba ? g.cx : (g.x0 + g.xF) / 2;
  pr.linhaConferida(xa, g.y0 - g.par - 2.5, xa, g.yF + 0.5, { cor: COR.azul, esp: 0.2, traco: [1.6, 0.8] });
  pr.texto("A", xa + 1, g.y0 - g.par - 5.2, { tam: 6.5, fonte: "forte", cor: COR.azul });

  // ---- Vista frontal ----
  tituloBloco(pr, "Vista frontal", 10, 101);
  const sv = Math.min(g.s, 30), H = (d.alturaTampo ?? PADRAO.alturaTampo);
  const yPiso = 147, yTopo = yPiso - H * sv, yFr = yTopo - PADRAO.frontaoAlt * sv, ySaia = yTopo + (d.saia ?? PADRAO.saia) * sv;
  const fx0 = g.x0, fxF = g.x0 + C * g.s;
  pr.linha(fx0 - 8, yPiso, fxF + 8, yPiso, { esp: 0.4 });
  if (d.lateralEsquerda === "parede") pr.ret(fx0 - g.par, yFr - 3, g.par, yPiso - yFr + 3, { fundo: COR.parede });
  if (d.lateralDireita === "parede") pr.ret(fxF, yFr - 3, g.par, yPiso - yFr + 3, { fundo: COR.parede });
  pr.ret(fx0, yFr, C * g.s, PADRAO.frontaoAlt * sv, { fundo: COR.bege, cor: COR.preto, esp: 0.3 });
  pr.ret(fx0, yTopo, C * g.s, (d.saia ?? PADRAO.saia) * sv, { fundo: pedra, cor: COR.preto, esp: 0.35 });
  pr.linha(g.cx, yFr - 1.5, g.cx, ySaia + 2, { cor: COR.cinza, esp: 0.12, traco: [2, 0.7] });
  const xd = fxF + (d.lateralDireita === "parede" ? g.par : 0), xe = fx0 - (d.lateralEsquerda === "parede" ? g.par : 0);
  pr.cotaV(yFr, yTopo, xd, xd + 5, `frontão ${metros(PADRAO.frontaoAlt)}`);
  pr.cotaV(yTopo, ySaia, xd, xd + 5, `saia ${metros((d.saia ?? PADRAO.saia))}`);
  pr.cotaV(yTopo, yPiso, xe, xe - 6, metros(H), { lado: "esq" });

  // ---- Corte A ----
  tituloBloco(pr, "Corte A", 10, 151);
  const sc = Math.min(52 / P, 55), cy0 = 180, wx = 22; // cy0 = topo do tampo; wx = face da parede
  const e = Math.max(PADRAO.tampo * sc, 1), cxF = wx + P * sc;
  pr.ret(wx - 5, cy0 - 14, 5, 24, { fundo: COR.parede }); pr.hachura(wx - 5, cy0 - 14, 5, 24, 1.4, "#8A8A8A");
  pr.ret(wx, cy0 - PADRAO.frontaoAlt * sc, e, PADRAO.frontaoAlt * sc, { fundo: pedra, cor: COR.preto, esp: 0.3 });
  pr.ret(wx, cy0, P * sc, e, { fundo: pedra, cor: COR.preto, esp: 0.3 });
  pr.ret(cxF - e, cy0 + e, e, (d.saia ?? PADRAO.saia) * sc - e, { fundo: pedra, cor: COR.preto, esp: 0.3 });
  const gy = cy0 + e, gx2 = cxF - e - PADRAO.grapaFolgaSaia * sc;
  pr.ret(wx - PADRAO.grapaEmbutida * sc, gy, gx2 - (wx - PADRAO.grapaEmbutida * sc), 0.03 * sc, { fundo: COR.dourado, cor: COR.preto, esp: 0.2 });
  const chamadas: [number, number, string][] = [
    [wx + e / 2, cy0 - PADRAO.frontaoAlt * sc * 0.6, "Frontão 2 x 10 cm"],
    [wx + P * sc * 0.72, cy0 + e / 2, "Tampo 2 cm"],
    [wx + P * sc * 0.45, gy + 0.015 * sc, "Grapa: metalon 40x30 mm ou barra Ø40 mm"],
    [cxF - e / 2, cy0 + (d.saia ?? PADRAO.saia) * sc * 0.7, `Saia ${cm(d.saia ?? PADRAO.saia)}`],
  ];
  chamadas.forEach(([ax, ay, rot], i) => pr.chamada(ax, ay, cxF + 9, cy0 - 9 + i * 4.6, rot));
  pr.cotaH(wx, cxF, cy0 + (d.saia ?? PADRAO.saia) * sc, cy0 + (d.saia ?? PADRAO.saia) * sc + 3.5, metros(P));

  // ---- Perspectiva ----
  tituloBloco(pr, "Perspectiva isométrica (ilustrativa)", 156, 27);
  const c3 = cena(d);
  const iw = 96, ih = 84, r = await renderizar(c3.solidos, Math.round(iw * 8.6), Math.round(ih * 8.6), { azimute: c3.azimute });
  pr.ret(156, 31, iw, ih, { fundo: COR.offwhite });
  pr.imagem(r.png, 156, 31, iw, ih);
  const rot = Object.entries(c3.alvos).map(([nome, p]) => { const [u, v] = r.projetar(p); return { nome, x: 156 + u * iw, y: 31 + v * ih }; }).sort((a, b) => a.y - b.y);
  rot.forEach((t, i) => pr.chamada(t.x, t.y, 255, 40 + i * 9, t.nome, { sobreImagem: true }));

  // ---- Notas ----
  tituloBloco(pr, "Notas", 156, 119);
  const notas = [
    `Pedra: ${d.pedra}. Cor da perspectiva meramente ilustrativa.`,
    `Tampo com 2 cm; frontão com 2 cm de espessura e 10 cm de altura; saia de ${cm(d.saia ?? PADRAO.saia)}. Cantos em meia esquadria.` + (d.saia ? " Sanitário acessível: topo do tampo a 0,80 m e 0,73 m livres embaixo (ABNT NBR 9050:2020, itens 7.5 e 7.10.3)." : ""),
    [d.lateralEsquerda === "aberta" ? "Lateral esquerda aberta: sem frontão, com saia." : "Lateral esquerda encostada na parede: com frontão.", d.lateralDireita === "aberta" ? "Lateral direita aberta: sem frontão, com saia." : "Lateral direita encostada na parede: com frontão."].join(" "),
    temCuba(d) ? `Cuba ${d.cubaTipo.toLowerCase()} de ${metros(d.cubaLargura!)} x ${metros(d.cubaProfundidade!)}, com o eixo a ${metros(eixoCuba(d))} da ponta esquerda.` + (d.cubaTipo === "Esculpida" ? " Fundo fixo, válvula click centralizada e faixa de escoamento de 1 cm." : " Conferir o recorte com o modelo da cuba.") : "Bancada sem cuba.",
    `Torneira: ${d.torneira.toLowerCase()}. Conferir a furação com o modelo.`,
    d.revestimentosDefinidos === "sim" ? `Revestimentos: piso ${d.revestimentoPiso || "a definir"}; parede ${d.revestimentoParede || "a definir"}; porta ${d.corPorta || "a definir"}; pintura ${d.pintura || "a definir"}.` : "Revestimentos, cor da porta e pintura: a definir.",
    `Suposições: topo do tampo a ${metros((d.alturaTampo ?? PADRAO.alturaTampo))} do piso acabado; cuba centralizada na profundidade útil do tampo; profundidade do bojo da cuba conforme o modelo.`,
    ...(d.observacoes.trim() ? [d.observacoes.trim()] : []),
  ];
  let yn = 123;
  for (const n of notas) { pr.circulo(157, yn + 1.2, 0.5, { fundo: COR.dourado }); yn += pr.paragrafo(n, 159.5, yn, 127, { tam: 6.2 }) + 1.3; }

  // ================= FOLHA 2 =================
  pr.novaFolha();
  moldura(pr, empresa, logo, d, "MARMORARIA", `${sub}  ·  Fixação e lista de peças`, 2, 2);
  tituloBloco(pr, `Fixação: opção ${d.grapas} (${d.grapas === "A" ? "2 barras laterais" : "4 barras: 2 laterais e 2 de reforço"})`, 10, 27);
  const f = planta(pr, d, 10, 30, 140, situacao ? 62 : 90, pedra, "fixacao");
  const largBarra = Math.max(0.04 * f.s, 1.3), folga = PADRAO.grapaFolgaRecorte * f.s;
  const fimBarra = f.yF - (PADRAO.tampo + PADRAO.grapaFolgaSaia) * f.s, iniBarra = f.y0 - PADRAO.grapaEmbutida * f.s;
  const limE = f.cuba ? f.cuba.x - folga - largBarra : Infinity, limD = f.cuba ? f.cuba.x + f.cuba.l + folga : -Infinity;
  const xs: number[] = [Math.min(f.x0 + C * f.s * 0.08, limE), Math.max(f.xF - C * f.s * 0.08 - largBarra, limD)];
  if (d.grapas === "B") {
    if (f.cuba) { xs.push(Math.max(limE, xs[0] + largBarra + 2), Math.min(limD, xs[1] - largBarra - 2)); }
    else xs.push(f.x0 + (C * f.s) / 3 - largBarra / 2, f.x0 + (2 * C * f.s) / 3 - largBarra / 2);
  }
  const barras = [...new Set(xs.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  for (const bx of barras) pr.ret(bx, iniBarra, largBarra, fimBarra - iniBarra, { fundo: COR.dourado, cor: COR.preto, esp: 0.2, traco: [1.2, 0.6], opacidade: 0.75 });
  // chamadas em cotovelo: a do alvo mais à direita fica na linha mais próxima, para as linhas não cruzarem textos
  const meio = (f.x0 + f.xF) / 2;
  const abaixo: [number, number, string][] = [[barras[barras.length - 1] + largBarra / 2, fimBarra - 0.6, "Ponta a 3 a 4 cm da saia"]];
  if (f.cuba) abaixo.push([f.cuba.x + f.cuba.l * 0.25, f.cuba.y + f.cuba.a, "Mínimo de 5 cm do recorte"]);
  // testa as combinações de lado e de linha e usa a primeira em que nenhuma linha cruza um texto
  const larguras = abaixo.map((c) => pr.larguraTexto(c[2], 6.5, "medio") + 3.5);
  let melhor: { ordem: number[]; lados: ("dir" | "esq")[] } | null = null;
  const ordens = abaixo.length === 2 ? [[0, 1], [1, 0]] : [[0]];
  busca: for (const ordem of ordens) for (let m = 0; m < 1 << abaixo.length; m++) {
    const lados = abaixo.map((_, i) => ((m >> i) & 1 ? "esq" : "dir") as "dir" | "esq");
    const faixa = (i: number): [number, number] => (lados[i] === "dir" ? [abaixo[i][0], abaixo[i][0] + larguras[i]] : [abaixo[i][0] - larguras[i], abaixo[i][0]]);
    let ok = abaixo.every((_, i) => faixa(i)[0] > 12 && faixa(i)[1] < 148);
    // o texto da linha de cima não pode ser cruzado pela descida do texto da linha de baixo
    if (ok && ordem.length === 2) { const [cima, baixo] = ordem; const [x1, x2] = faixa(cima); ok = !(abaixo[baixo][0] > x1 - 1 && abaixo[baixo][0] < x2 + 1); }
    if (ok) { melhor = { ordem, lados }; break busca; }
  }
  if (melhor) melhor.ordem.forEach((i, k) => pr.chamadaVertical(abaixo[i][0], abaixo[i][1], f.yF + 5 + k * 4.5, abaixo[i][2], { lado: melhor!.lados[i] }));
  const bTopo = barras[0] + largBarra / 2;
  pr.chamadaVertical(bTopo, iniBarra + 0.5, f.y0 - 8, "Embutir cerca de 8 cm na parede", { lado: bTopo > meio ? "esq" : "dir" });
  pr.cotaV(f.y0, f.yF, f.xF + (d.lateralDireita === "parede" ? f.par : 0), f.xF + (d.lateralDireita === "parede" ? f.par : 0) + 5, metros(P));

  if (!situacao) {
    // ---- Detalhe ampliado da fixação (corte) ----
    tituloBloco(pr, "Detalhe da fixação (corte ampliado)", 10, 124);
    const sd = Math.min(95 / P, 150), dy = 152, dw = 30, e2 = Math.max(PADRAO.tampo * sd, 1.6), dF = dw + P * sd;
    pr.ret(dw - 14, dy - PADRAO.frontaoAlt * sd - 4, 14, PADRAO.frontaoAlt * sd + (d.saia ?? PADRAO.saia) * sd + 8, { fundo: COR.parede }); pr.hachura(dw - 14, dy - PADRAO.frontaoAlt * sd - 4, 14, PADRAO.frontaoAlt * sd + (d.saia ?? PADRAO.saia) * sd + 8, 1.6, "#8A8A8A");
    pr.ret(dw, dy - PADRAO.frontaoAlt * sd, e2, PADRAO.frontaoAlt * sd, { fundo: pedra, cor: COR.preto, esp: 0.3 });
    pr.ret(dw, dy, P * sd, e2, { fundo: pedra, cor: COR.preto, esp: 0.3 });
    pr.ret(dF - e2, dy + e2, e2, (d.saia ?? PADRAO.saia) * sd - e2, { fundo: pedra, cor: COR.preto, esp: 0.3 });
    const g1 = dw - PADRAO.grapaEmbutida * sd, g2 = dF - e2 - PADRAO.grapaFolgaSaia * sd, gh = 0.03 * sd;
    pr.ret(g1, dy + e2, g2 - g1, gh, { fundo: COR.dourado, cor: COR.preto, esp: 0.25 });
    const yc = dy + (d.saia ?? PADRAO.saia) * sd + 5;
    pr.cotaH(g1, dw, dy + e2 + gh, yc, "0,08 m", { estreita: "abaixo" });
    pr.cotaH(g2, dF - e2, dy + e2 + gh, yc, "0,03 a 0,04 m", { estreita: "abaixo" });
    pr.chamadaVertical((dw + g2) / 2, dy + e2 + gh / 2, dy - PADRAO.frontaoAlt * sd - 2, "Grapa: metalon 40x30 mm ou barra Ø40 mm, sob o tampo", { lado: "dir" });
  }

  if (situacao) {
    tituloBloco(pr, "Planta de situação", 10, 112);
    pr.ret(10, 116, 140, 76, { cor: COR.begeLinha, esp: 0.3 });
    pr.imagem(situacao, 11, 117, 138, 74);
  }

  // ---- Lista de peças ----
  tituloBloco(pr, "Lista de peças de pedra (medidas externas)", 156, 27);
  const col = [156, 196, 208, 233, 258], cab = ["Peça", "Qtd.", "Comprimento", "Largura", "Espessura"];
  pr.ret(156, 31, 131, 6, { fundo: COR.azul });
  cab.forEach((t, i) => pr.texto(t.toUpperCase(), col[i] + 1.5, 32.7, { tam: 5.8, fonte: "forte", cor: COR.branco }));
  const pecas = pecasBancada(d);
  pecas.forEach((p, i) => {
    const y = 37 + i * 6;
    if (i % 2 === 0) pr.ret(156, y, 131, 6, { fundo: COR.offwhite });
    [p.nome, String(p.qtd), metros(p.comprimento), metros(p.largura), metros(p.espessura)].forEach((t, k) => pr.texto(t, col[k] + 1.5, y + 1.7, { tam: 6.5, fonte: k === 0 ? "medio" : "normal" }));
  });
  let y2 = 37 + pecas.length * 6 + 2;
  y2 += pr.paragrafo("Medidas externas das peças prontas. Cantos em meia esquadria: descontar os encontros na fabricação. Recortes de cuba e furação de torneira conforme a vista superior e o modelo das peças.", 156, y2, 131, { tam: 6, cor: COR.cinza }) + 5;

  // ---- Legenda e critérios ----
  tituloBloco(pr, "Critérios de fixação", 156, y2); y2 += 4.5;
  const crit = [
    "Grapas em barra de metalon 40x30 mm ou barra Ø40 mm, embutidas cerca de 8 cm na parede e apoiadas sob o tampo.",
    "Ponta da barra a 3 a 4 cm da saia. Barras nas laterais, fora de ligações hidráulicas, engate de água, válvula e sifão.",
    "Afastamento mínimo de 5 cm do recorte da cuba ou do cooktop.",
    d.grapas === "A" ? "Opção A: 2 barras laterais (indicada para bancadas curtas, até cerca de 1,00 m)." : "Opção B: 4 barras, sendo 2 laterais e 2 de reforço (indicada para vãos maiores ou apoio de equipamentos).",
    "A posição das barras no desenho é indicativa: ajustar em obra respeitando os critérios acima.",
  ];
  for (const n of crit) { pr.circulo(157, y2 + 1.2, 0.5, { fundo: COR.dourado }); y2 += pr.paragrafo(n, 159.5, y2, 127, { tam: 6.2 }) + 1.3; }
  y2 += 3; tituloBloco(pr, "Legenda", 156, y2); y2 += 4.5;
  const leg: [string, string][] = [[COR.parede, "Parede"], [pedra, "Pedra (tampo e saia)"], [COR.bege, "Frontão (hachurado em planta)"], [COR.dourado, "Grapa (barra de fixação)"]];
  leg.forEach(([cor, t], i) => { pr.ret(156, y2 + i * 5, 6, 3.2, { fundo: cor, cor: COR.preto, esp: 0.15 }); pr.texto(t, 164, y2 + i * 5 + 0.3, { tam: 6.2 }); });

  const sobreposicoes = pr.verificarSobreposicoes();
  if (sobreposicoes.length) avisos.push(`A conferência automática achou ${sobreposicoes.length} sobreposição(ões) de texto ou cota. Revise a prancha antes de enviar.`);
  return { pdf: await pr.fechar(), folhas: 2, sobreposicoes, avisos };
}
