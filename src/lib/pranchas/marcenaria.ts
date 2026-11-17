// Pranchas de MARCENARIA (A4 paisagem). Por móvel: visão geral, vista interna e cortes, explodida, cartões de fabricação.
// Uma vez por conjunto: lista de peças, ferragens, resumo de materiais e plano de corte (sugestão).
import type { Empresa } from "../tipos";
import { dataBR } from "../formato";
import { imagem } from "../documentos/comum";
import { COR, Prancha, type Sobreposicao } from "./folha";
import { renderizar, type Solido, type V3 } from "./iso";
import { NOME_PAPEL, PADRAO_MARC, corredicaPara, ehFrente, ehGavetaInterna, ferragens, itemDaPeca, listaDePecas, materialDe, planoDeCorte, type Chapa, type ItemLista, type Movel, type Peca, type RespostasMarcenaria } from "../marcenaria/modelo";

export interface ResultadoMarcenaria { pdf: Buffer; folhas: number; sobreposicoes: Sobreposicao[]; avisos: string[]; itens: ItemLista[]; chapas: Chapa[] }

const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1, useGrouping: false });
const claro = (c: [number, number, number], f = 0.35) => "#" + c.map((x) => Math.round(x + (255 - x) * f).toString(16).padStart(2, "0")).join("");
const titulo = (pr: Prancha, t: string, x: number, y: number) => pr.texto(t.toUpperCase(), x, y, { tam: 6.5, fonte: "forte", cor: COR.dourado, espaco: 0.8 });
function caber(pr: Prancha, t: string, larg: number, tam: number) { if (pr.larguraTexto(t, tam) <= larg) return t; let s = t; while (s.length > 3 && pr.larguraTexto(s + "…", tam) > larg) s = s.slice(0, -1); return s + "…"; }

interface Ctx { pr: Prancha; empresa: Empresa; logo: Buffer | null; r: RespostasMarcenaria; total: number; itens: ItemLista[] }

function moldura(c: Ctx, sub: string, estimativa = false) {
  const { pr, empresa, r } = c, m = empresa.marca, L = pr.largura, A = pr.altura;
  pr.novaFolha();
  if (c.logo) pr.imagem(c.logo, 10, 7.5, 24, 14);
  pr.texto("MARCENARIA", 38, 8.5, { tam: 15, fonte: "forte", cor: COR.azul, espaco: 1.2 });
  pr.texto(caber(pr, sub, 140, 7.5), 38, 16.5, { tam: 7.5, cor: COR.cinza });
  pr.texto(caber(pr, `Cliente: ${r.cliente || "a definir"}`, 95, 7), L - 10, 8, { tam: 7, fonte: "medio", cor: COR.azul, alinhar: "dir" });
  pr.texto(caber(pr, `Local: ${r.local || "a definir"}`, 95, 6.5), L - 10, 12.2, { tam: 6.5, cor: COR.cinza, alinhar: "dir" });
  pr.texto(`Data: ${dataBR(r.data)}  ·  Revisão: R${String(r.revisao).padStart(2, "0")}`, L - 10, 16.2, { tam: 6.5, cor: COR.cinza, alinhar: "dir" });
  pr.linha(10, 23.5, L - 10, 23.5, { cor: COR.dourado, esp: 0.5 });
  pr.linha(10, A - 14, L - 10, A - 14, { cor: COR.begeLinha, esp: 0.3 });
  pr.texto(`${m.telefone}  ·  ${m.email}  ·  ${m.instagram}  ·  ${m.responsavelTecnico}  ·  ${m.registro}`, 10, A - 12.4, { tam: 6, cor: COR.cinza });
  pr.texto(`FOLHA ${String(pr.folha).padStart(2, "0")}/${String(c.total).padStart(2, "0")}`, L - 10, A - 12.4, { tam: 6.5, fonte: "forte", cor: COR.azul, alinhar: "dir" });
  pr.texto(`CONFERIR MEDIDAS NO LOCAL ANTES DA EXECUÇÃO.  MEDIDAS EM MILÍMETROS.  DESENHO SEM ESCALA.${estimativa ? "  ESTIMATIVA: PEÇAS GERADAS POR REGRA." : ""}`, L / 2, A - 8, { tam: 6.5, fonte: "forte", cor: COR.vermelho, alinhar: "centro" });
}

// Projeção de uma vista dentro de uma área da folha. h = eixo horizontal, v = eixo vertical do móvel.
type Eixo = "x" | "y" | "z";
interface Vista { X: (v: number) => number; Y: (v: number) => number; s: number; x0: number; y0: number; l: number; a: number }
function vista(area: { x: number; y: number; l: number; a: number }, larg: number, alt: number, mg: { esq?: number; topo?: number; dir?: number; base?: number } = {}, inverteV = true): Vista {
  const e = mg.esq ?? 4, t = mg.topo ?? 4, d = mg.dir ?? 4, b = mg.base ?? 4;
  const s = Math.min((area.l - e - d) / larg, (area.a - t - b) / alt);
  const x0 = area.x + e + (area.l - e - d - larg * s) / 2, y0 = area.y + t + (area.a - t - b - alt * s) / 2;
  return { s, x0, y0, l: larg * s, a: alt * s, X: (v) => x0 + v * s, Y: (v) => (inverteV ? y0 + (alt - v) * s : y0 + v * s) };
}
const faixa = (p: Peca, e: Eixo): [number, number] => (e === "x" ? [p.x0, p.x1] : e === "y" ? [p.y0, p.y1] : [p.z0, p.z1]);
function retDaPeca(v: Vista, p: Peca, h: Eixo, ve: Eixo) {
  const [a, b] = faixa(p, h), [c, d] = faixa(p, ve), x = v.X(a), y = Math.min(v.Y(c), v.Y(d));
  return { x, y, l: Math.max(0.25, v.X(b) - x), a: Math.max(0.25, Math.abs(v.Y(d) - v.Y(c))) };
}

// Balões com o número do item: um por tipo de peça, sem encostar em outro balão.
function baloes(c: Ctx, m: Movel, v: Vista, pecas: Peca[], h: Eixo, ve: Eixo, max = 9) {
  const postos: { x: number; y: number }[] = [], vistos = new Set<number>(), R = 2.3;
  for (const p of pecas) {
    const n = itemDaPeca(c.itens, m.nome, p, c.r);
    if (!n || vistos.has(n) || postos.length >= max) continue;
    const q = retDaPeca(v, p, h, ve);
    for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = q.l >= q.a ? q.x + q.l * t : q.x + q.l / 2, y = q.l >= q.a ? q.y + q.a / 2 : q.y + q.a * t;
      if (postos.some((o) => Math.hypot(o.x - x, o.y - y) < 2 * R + 0.8)) continue;
      c.pr.circulo(x, y, R, { fundo: COR.branco, cor: COR.azul, esp: 0.25 });
      c.pr.texto(String(n), x, y - 1.15, { tam: 5.5, fonte: "forte", cor: COR.azul, alinhar: "centro" });
      postos.push({ x, y }); vistos.add(n); break;
    }
  }
}

const porProfundidade = (pecas: Peca[]) => [...pecas].sort((a, b) => b.y0 - a.y0);
const solidos = (pecas: Peca[], desloca: (p: Peca) => V3 = () => [0, 0, 0]): Solido[] => pecas.map((p) => { const d = desloca(p); return { min: [(p.x0 + d[0]) / 1000, (p.y0 + d[1]) / 1000, (p.z0 + d[2]) / 1000], max: [(p.x1 + d[0]) / 1000, (p.y1 + d[1]) / 1000, (p.z1 + d[2]) / 1000], cor: p.cor }; });
// vãos livres entre as chapas verticais (para a cota em cadeia)
function vaos(m: Movel): [number, number][] {
  const vert = m.pecas.filter((p) => (p.papel === "lateral" || p.papel === "divisoria") && p.fino === "X").sort((a, b) => a.x0 - b.x0), r: [number, number][] = [];
  for (let i = 0; i + 1 < vert.length; i++) if (vert[i + 1].x0 - vert[i].x1 > 30) r.push([vert[i].x1, vert[i + 1].x0]);
  return r;
}
function ladoDobradica(m: Movel, p: Peca): { lado: "esq" | "dir"; certo: boolean } {
  const vert = m.pecas.filter((q) => (q.papel === "lateral" || q.papel === "divisoria") && q.fino === "X");
  const perto = (x: number) => vert.some((q) => x >= q.x0 - 25 && x <= q.x1 + 25);
  const e = perto(p.x0), d = perto(p.x1);
  return { lado: d && !e ? "dir" : "esq", certo: e !== d };
}

// ================= folhas de cada móvel =================
async function folhasDoMovel(c: Ctx, m: Movel, renders: Map<string, Buffer>) {
  const { pr, r } = c, visiveis = m.pecas.filter((p) => p.papel !== "ferragem"), frentes = visiveis.filter((p) => ehFrente(p.papel)), corpo = visiveis.filter((p) => !ehFrente(p.papel));
  const sub = `${m.nome}  ·  ${mm(m.L)} x ${mm(m.P)} x ${mm(m.A)} mm (largura x profundidade x altura)`;
  const render = async (chave: string, s: Solido[], w: number, h: number) => { const k = `${m.nome}|${chave}`; if (!renders.has(k)) renders.set(k, (await renderizar(s, w, h)).png); return renders.get(k)!; };

  // ---------- 1. VISÃO GERAL ----------
  moldura(c, sub, m.estimativa);
  titulo(pr, "Vista frontal", 10, 27);
  const vf = vista({ x: 10, y: 31, l: 140, a: 96 }, m.L, m.A, { esq: 16, topo: 15, dir: 14, base: 3 });
  for (const p of porProfundidade(visiveis)) { const q = retDaPeca(vf, p, "x", "z"); pr.ret(q.x, q.y, q.l, q.a, { fundo: claro(p.cor), cor: COR.preto, esp: ehFrente(p.papel) ? 0.3 : 0.15 }); }
  pr.cotaH(vf.X(0), vf.X(m.L), vf.y0, vf.y0 - 11, mm(m.L));
  const vs = vaos(m);
  if (vs.length > 1) for (const [a, b] of vs) if (pr.larguraTexto(mm(b - a), 6, "medio") + 4 < (b - a) * vf.s) pr.cotaH(vf.X(a), vf.X(b), vf.y0, vf.y0 - 5, mm(b - a), { tam: 6 });
  pr.cotaV(vf.Y(m.A), vf.Y(0), vf.x0, vf.x0 - 6, mm(m.A), { lado: "esq", vertical: true });
  const rod = m.pecas.find((p) => p.papel === "rodape");
  if (rod && (rod.z1 - rod.z0) * vf.s > 2) pr.cotaV(vf.Y(rod.z1), vf.Y(rod.z0), vf.x0 + vf.l, vf.x0 + vf.l + 4, mm(rod.z1 - rod.z0), { tam: 6 });
  baloes(c, m, vf, frentes.length ? frentes : corpo.filter((p) => p.fino !== "Y"), "x", "z");

  titulo(pr, "Vista lateral (transparente)", 156, 27);
  const vl = vista({ x: 156, y: 31, l: 60, a: 96 }, m.P, m.A, { esq: 4, topo: 15, dir: 4, base: 3 });
  for (const p of visiveis) { const q = retDaPeca(vl, p, "y", "z"); pr.ret(q.x, q.y, q.l, q.a, { cor: COR.cinza, esp: 0.15 }); }
  pr.ret(vl.x0, vl.y0, vl.l, vl.a, { cor: COR.preto, esp: 0.3 });
  pr.cotaH(vl.X(0), vl.X(m.P), vl.y0, vl.y0 - 5, mm(m.P), { estreita: "abaixo" });
  pr.texto("frente", vl.x0, vl.y0 + vl.a + 1, { tam: 5.5, cor: COR.cinza });

  titulo(pr, "Perspectiva", 222, 27);
  pr.imagem(await render("iso", solidos(visiveis), 660, 960), 222, 31, 65, 96);

  titulo(pr, "Planta (transparente, frente para baixo)", 10, 131);
  const vp = vista({ x: 10, y: 135, l: 140, a: 56 }, m.L, m.P, { esq: 16, topo: 3, dir: 14, base: 3 });
  for (const p of visiveis) { const q = retDaPeca(vp, p, "x", "y"); pr.ret(q.x, q.y, q.l, q.a, { cor: COR.cinza, esp: 0.15 }); }
  pr.ret(vp.x0, vp.y0, vp.l, vp.a, { cor: COR.preto, esp: 0.3 });
  pr.cotaV(vp.y0, vp.y0 + vp.a, vp.x0, vp.x0 - 6, mm(m.P), { lado: "esq" });

  titulo(pr, "Materiais e ferragens", 156, 131);
  let y = 135.5;
  const mats = new Map<string, [number, number, number]>();
  for (const p of visiveis) { const k = `${materialDe(p, r)}, ${mm(p.E)} mm`; if (!mats.has(k)) mats.set(k, p.cor); }
  for (const [nome, cor] of [...mats].slice(0, 5)) { pr.ret(156, y, 5, 3, { fundo: claro(cor, 0.15), cor: COR.preto, esp: 0.15 }); pr.texto(caber(pr, nome, 120, 6.2), 163, y + 0.2, { tam: 6.2 }); y += 4.6; }
  const linhas = [
    frentes.length ? `Portas e frentes: ${r.portas.toLowerCase() || "a definir"}. Puxador: ${r.puxador || "a definir"}.` : "",
    m.pecas.some((p) => p.papel === "porta") ? `Dobradiça: ${r.dobradica.toLowerCase() || "a definir"}.` : "",
    m.pecas.some((p) => p.papel === "frente_gaveta") ? `Corrediça: ${r.corredica.toLowerCase() || "a definir"}.` : "",
    `Veio da madeira: ${r.veio === "sim" ? "sim, manter o sentido no corte" : r.veio === "nao" ? "não tem" : "a definir"}.`,
    "Como ler: os números nos balões são os itens da lista de peças. Tracejado dourado = porta ou frente. Hachura = peça cortada.",
    m.estimativa ? "ESTIMATIVA: este móvel não veio do SketchUp. As peças foram geradas por regra, com medidas nominais e sem folgas." : "",
  ].filter(Boolean);
  y += 1.5;
  for (const t of linhas) { pr.circulo(157, y + 1.2, 0.5, { fundo: COR.dourado }); y += pr.paragrafo(t, 159.5, y, 127, { tam: 6.2, cor: t.startsWith("ESTIMATIVA") ? COR.vermelho : COR.preto }) + 1.2; }

  // ---------- 2. VISTA INTERNA E CORTES ----------
  moldura(c, sub, m.estimativa);
  titulo(pr, "Vista interna (portas e frentes em tracejado)", 10, 27);
  const vi = vista({ x: 10, y: 31, l: 140, a: 160 }, m.L, m.A, { esq: 8, topo: 8, dir: 8, base: 8 });
  for (const p of porProfundidade(corpo)) { const q = retDaPeca(vi, p, "x", "z"); pr.ret(q.x, q.y, q.l, q.a, { fundo: claro(p.cor, ehGavetaInterna(p.papel) ? 0.7 : 0.35), cor: COR.preto, esp: 0.15 }); }
  let incerto = false;
  for (const p of frentes) {
    const q = retDaPeca(vi, p, "x", "z"); pr.ret(q.x + 0.3, q.y + 0.3, q.l - 0.6, q.a - 0.6, { cor: COR.dourado, esp: 0.35, traco: [1.6, 1] });
    if (p.papel !== "porta") continue;
    const d = ladoDobradica(m, p), n = Math.max(2, Math.ceil((p.z1 - p.z0) > 0 ? (p.z1 - p.z0 <= 900 ? 2 : p.z1 - p.z0 <= 1600 ? 3 : p.z1 - p.z0 <= 2100 ? 4 : 5) : 2)); incerto ||= !d.certo;
    for (let k = 0; k < n; k++) { const z = p.z0 + PADRAO_MARC.dobradicaPonta + ((p.z1 - p.z0 - 2 * PADRAO_MARC.dobradicaPonta) * k) / (n - 1); pr.ret(d.lado === "esq" ? q.x + 0.6 : q.x + q.l - 2.6, vi.Y(z) - 0.8, 2, 1.6, { fundo: COR.dourado, cor: COR.preto, esp: 0.1 }); }
  }
  baloes(c, m, vi, corpo.filter((p) => !ehGavetaInterna(p.papel)), "x", "z");
  const vz = vaos(m), maior = vz.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0], xa = maior ? (maior[0] + maior[1]) / 2 : m.L / 2;
  let zb = m.A / 2; for (let k = 0; k < 20 && corpo.some((p) => p.fino === "Z" && p.z0 <= zb && p.z1 >= zb); k++) zb += 40;
  const marca = (x1: number, y1: number, x2: number, y2: number) => pr.linha(x1, y1, x2, y2, { cor: COR.azul, esp: 0.3, traco: [3, 1] });
  marca(vi.X(xa), vi.y0 - 3, vi.X(xa), vi.y0 + vi.a + 3); marca(vi.x0 - 3, vi.Y(zb), vi.x0 + vi.l + 3, vi.Y(zb));
  pr.texto("A", vi.X(xa), vi.y0 - 6.5, { tam: 7, fonte: "forte", cor: COR.azul, alinhar: "centro" }); pr.texto("A", vi.X(xa), vi.y0 + vi.a + 3.5, { tam: 7, fonte: "forte", cor: COR.azul, alinhar: "centro" });
  pr.texto("B", vi.x0 - 5, vi.Y(zb) - 1.4, { tam: 7, fonte: "forte", cor: COR.azul, alinhar: "centro" }); pr.texto("B", vi.x0 + vi.l + 5, vi.Y(zb) - 1.4, { tam: 7, fonte: "forte", cor: COR.azul, alinhar: "centro" });

  const corte = (v: Vista, cortadas: Peca[], alem: Peca[], h: Eixo, ve: Eixo) => {
    for (const p of alem) { const q = retDaPeca(v, p, h, ve); pr.ret(q.x, q.y, q.l, q.a, { cor: COR.cinza, esp: 0.12 }); }
    for (const p of cortadas) { const q = retDaPeca(v, p, h, ve); pr.ret(q.x, q.y, q.l, q.a, { fundo: COR.bege, cor: COR.preto, esp: 0.3 }); pr.hachura(q.x, q.y, q.l, q.a, 0.9); }
  };
  titulo(pr, "Corte A-A (frente à esquerda)", 156, 27);
  const va = vista({ x: 156, y: 31, l: 62, a: 92 }, m.P, m.A, { esq: 5, topo: 4, dir: 5, base: 4 });
  const cortA = visiveis.filter((p) => p.x0 < xa && p.x1 > xa);
  corte(va, cortA, visiveis.filter((p) => p.x0 >= xa), "y", "z");
  baloes(c, m, va, cortA.filter((p) => !ehFrente(p.papel) && !ehGavetaInterna(p.papel)), "y", "z", 6);
  titulo(pr, "Corte B-B (planta, frente para baixo)", 156, 127);
  const vb = vista({ x: 156, y: 131, l: 131, a: 60 }, m.L, m.P, { esq: 5, topo: 4, dir: 5, base: 4 });
  const cortB = visiveis.filter((p) => p.z0 < zb && p.z1 > zb);
  corte(vb, cortB, visiveis.filter((p) => p.z1 <= zb), "x", "y");
  baloes(c, m, vb, cortB.filter((p) => !ehGavetaInterna(p.papel)), "x", "y", 9);
  titulo(pr, "Legenda", 224, 27);
  let yl = 32;
  const leg: [string, () => void][] = [
    ["Porta ou frente (na frente da caixa)", () => pr.ret(224, yl, 6, 3.2, { cor: COR.dourado, esp: 0.35, traco: [1.6, 1] })],
    ["Peça cortada pelo plano de corte", () => { pr.ret(224, yl, 6, 3.2, { fundo: COR.bege, cor: COR.preto, esp: 0.25 }); pr.hachura(224, yl, 6, 3.2, 0.9); }],
    ["Peça além do corte", () => pr.ret(224, yl, 6, 3.2, { cor: COR.cinza, esp: 0.12 })],
    ...(m.pecas.some((p) => p.papel === "porta") ? [["Dobradiça", () => pr.ret(226, yl + 0.6, 2, 1.6, { fundo: COR.dourado, cor: COR.preto, esp: 0.1 })] as [string, () => void]] : []),
  ];
  for (const [t, d] of leg) { d(); pr.texto(t, 232, yl + 0.3, { tam: 6 }); yl += 5.2; }
  yl += 1;
  if (incerto) yl += pr.paragrafo("O lado das dobradiças foi deduzido pela posição das portas. Confirmar o sentido de abertura antes de furar.", 224, yl, 63, { tam: 6, cor: COR.vermelho }) + 1.5;
  pr.paragrafo("Os números nos balões são os itens da lista de peças, no fim deste caderno.", 224, yl, 63, { tam: 6, cor: COR.cinza });

  // ---------- 3. EXPLODIDA ----------
  moldura(c, sub, m.estimativa);
  titulo(pr, "Vista explodida (caixa, divisórias, prateleiras e frentes)", 10, 27);
  const k = Math.max(m.L, m.A, m.P) * 0.22;
  const desloca = (p: Peca): V3 => p.papel === "porta" || p.papel === "frente_gaveta" ? [0, -1.6 * k, 0] : p.papel === "topo" ? [0, 0, k] : p.papel === "base" ? [0, 0, -0.7 * k] : p.papel === "rodape" ? [0, -0.3 * k, -1.3 * k]
    : p.papel === "fundo" ? [0, 1.4 * k, 0] : p.papel === "lateral" ? [(p.x0 + p.x1) / 2 < m.L / 2 ? -k : k, 0, 0] : [0, 0, 0];
  pr.imagem(await render("explodida", solidos(visiveis.filter((p) => !ehGavetaInterna(p.papel)), desloca), 1500, 850), 10, 32, 277, 150);
  pr.texto("O interior das gavetas está nos cartões de fabricação. A relação das peças está na lista, no fim deste caderno.", 10, 186, { tam: 6.2, cor: COR.cinza });

  // ---------- 4. CARTÕES DE FABRICAÇÃO ----------
  const tem = (papel: string) => m.pecas.some((p) => p.papel === papel);
  const cava = /cava/i.test(r.puxador), corr = corredicaPara(m.P);
  type Cartao = { t: string; linhas: string[]; desenho: (x: number, y: number) => void };
  const chapa = (x: number, y: number, l: number, a: number, h = true) => { pr.ret(x, y, l, a, { fundo: COR.bege, cor: COR.preto, esp: 0.25 }); if (h) pr.hachura(x, y, l, a, 0.9); };
  const cartoes: Cartao[] = [];
  if (tem("porta")) cartoes.push({ t: "Dobradiça", linhas: [`Caneco Ø${PADRAO_MARC.caneco} mm, profundidade ${mm(PADRAO_MARC.canecoProf)} mm.`, `Centro do furo a ${mm(PADRAO_MARC.canecoCentro)} mm da borda da porta.`, `Primeira e última a ${PADRAO_MARC.dobradicaPonta} mm das pontas.`, "Quantidade pela altura da porta: até 900 mm, 2; até 1600, 3; até 2100, 4; acima, 5.", `Tipo: ${r.dobradica.toLowerCase()}. Portas ${r.portas.toLowerCase()}.`],
    desenho: (x, y) => { pr.ret(x + 26, y, 30, 30, { fundo: claro([203, 184, 150]), cor: COR.preto, esp: 0.25 }); for (const dy of [6, 24]) { pr.circulo(x + 31.5, y + dy, 3.2, { fundo: COR.branco, cor: COR.preto, esp: 0.25 }); pr.linha(x + 26, y + dy, x + 31.5, y + dy, { cor: COR.vermelho, esp: 0.15 }); } pr.linha(x + 60, y, x + 60, y + 6, { cor: COR.vermelho, esp: 0.15 }); } });
  if (tem("frente_gaveta")) cartoes.push({ t: "Gaveta", linhas: [`Corrediça ${r.corredica.toLowerCase()}: folga de ${mm(PADRAO_MARC.corredicaFolga)} mm por lado.`, corr ? `Comprimento da corrediça: ${corr} mm (o maior padrão que cabe na profundidade menos ${PADRAO_MARC.corredicaRecuo} mm).` : "Móvel raso: comprimento da corrediça a definir com o fornecedor.", `Fundo de ${PADRAO_MARC.fundoGaveta} mm em rasgo de ${PADRAO_MARC.rasgoGaveta}, a ${PADRAO_MARC.rasgoGavetaAltura} mm da borda de baixo.`],
    desenho: (x, y) => { chapa(x + 14, y, 3, 30); chapa(x + 65, y, 3, 30); chapa(x + 21, y + 6, 2.5, 20); chapa(x + 58.5, y + 6, 2.5, 20); chapa(x + 22.5, y + 22, 37, 1, false); pr.ret(x + 17, y + 14, 4, 3, { fundo: COR.dourado, cor: COR.preto, esp: 0.15 }); pr.ret(x + 61, y + 14, 4, 3, { fundo: COR.dourado, cor: COR.preto, esp: 0.15 }); } });
  if (frentes.length) cartoes.push(cava
    ? { t: "Cava", linhas: [`Cava a ${PADRAO_MARC.cava} na borda da porta ou frente.`, "Fazer na borda de pega: em cima nas frentes de gaveta e portas baixas, embaixo nas portas aéreas.", "Fita de borda aplicada depois da usinagem."], desenho: (x, y) => { pr.poligono([[x + 30, y + 2], [x + 46, y + 2], [x + 52, y + 9], [x + 52, y + 30], [x + 30, y + 30]], { fundo: COR.bege, cor: COR.preto, esp: 0.25 }); pr.linha(x + 46, y + 2, x + 52, y + 9, { cor: COR.vermelho, esp: 0.35 }); } }
    : { t: "Puxador", linhas: [`Modelo: ${r.puxador}.`, "Posição e furação conforme o modelo escolhido: conferir no catálogo do fornecedor antes de furar.", "Alinhar todos os puxadores pela mesma referência (borda da frente)."], desenho: (x, y) => { pr.ret(x + 22, y + 4, 38, 24, { fundo: claro([203, 184, 150]), cor: COR.preto, esp: 0.25 }); pr.ret(x + 33, y + 8, 16, 1.6, { fundo: COR.cinza, cor: COR.preto, esp: 0.15 }); } });
  if (tem("fundo")) cartoes.push({ t: "Fundo da caixa", linhas: [`Fundo de ${PADRAO_MARC.fundoCaixa} mm encaixado em rasgo de ${PADRAO_MARC.rasgoCaixa}.`, "Rasgo nas laterais, na base e no topo.", "Conferir o esquadro da caixa antes de fixar o fundo."],
    desenho: (x, y) => { chapa(x + 20, y + 2, 5, 28); chapa(x + 25, y + 2, 34, 5); chapa(x + 25, y + 25, 34, 5); pr.ret(x + 52, y + 5, 1.6, 22, { fundo: COR.dourado, cor: COR.preto, esp: 0.15 }); } });
  cartoes.push({ t: "Fixação da caixa", linhas: [`Cavilha ${PADRAO_MARC.cavilha} e minifix ${PADRAO_MARC.minifix} nas uniões.`, "Entre laterais, base, topo e divisórias.", "Quantidade e posição: definir na furação, conforme o tamanho de cada união."],
    desenho: (x, y) => { chapa(x + 22, y + 2, 5, 28); chapa(x + 27, y + 20, 34, 5); pr.ret(x + 24, y + 21.7, 9, 1.6, { fundo: COR.dourado, cor: COR.preto, esp: 0.15 }); pr.circulo(x + 40, y + 22.5, 2.2, { fundo: COR.branco, cor: COR.preto, esp: 0.25 }); } });
  if (tem("prateleira")) cartoes.push({ t: "Furação de prateleira", linhas: [`Sistema ${PADRAO_MARC.sistema32}: furos a cada ${PADRAO_MARC.sistema32} mm.`, `Linha de furos a ${PADRAO_MARC.sistema32Frente} mm da frente.`, "Fazer a mesma furação nas duas chapas do vão, para a prateleira ficar no nível."],
    desenho: (x, y) => { pr.ret(x + 24, y + 1, 34, 30, { fundo: claro([228, 217, 196]), cor: COR.preto, esp: 0.25 }); for (let i = 0; i < 6; i++) { pr.circulo(x + 29, y + 4 + i * 4.8, 0.7, { fundo: COR.preto }); pr.circulo(x + 53, y + 4 + i * 4.8, 0.7, { fundo: COR.preto }); } } });
  if (rod) cartoes.push({ t: "Rodapé", linhas: [`Altura de ${mm(rod.z1 - rod.z0)} mm (medida do ${m.estimativa ? "cadastro" : "modelo"}).`, `Recuado ${mm(Math.max(0, rod.y0 - Math.min(...corpo.filter((p) => p.papel === "lateral").map((p) => p.y0), rod.y0)))} mm da frente da caixa.`, "Conferir o nível do piso no local antes de cortar."],
    desenho: (x, y) => { chapa(x + 20, y + 2, 40, 5); chapa(x + 28, y + 7, 4, 16); pr.linha(x + 12, y + 23, x + 70, y + 23, { cor: COR.preto, esp: 0.4 }); } });
  const ripas = m.pecas.filter((p) => p.papel === "ripa");
  if (ripas.length) cartoes.push({ t: "Ripado", linhas: [`${ripas.length} ripa(s) de ${mm(ripas[0].L)} x ${mm(ripas[0].E)} mm, comprimento ${mm(ripas[0].C)} mm (medidas do modelo).`, "Manter o mesmo espaçamento do modelo entre as ripas.", "Fixar as ripas no painel de base antes da montagem."],
    desenho: (x, y) => { for (let i = 0; i < 9; i++) pr.ret(x + 20 + i * 5, y + 2, 3, 28, { fundo: claro([203, 184, 150]), cor: COR.preto, esp: 0.2 }); } });
  if (m.pecas.some((p) => /friso/i.test(p.nome) || Object.keys(p.attrs).some((a) => /friso/i.test(a)))) cartoes.push({ t: "Friso", linhas: [`Friso de ${PADRAO_MARC.friso} da borda.`, "Usinar antes da fita de borda.", "Conferir a posição no modelo."], desenho: (x, y) => { pr.ret(x + 22, y + 2, 38, 28, { fundo: claro([203, 184, 150]), cor: COR.preto, esp: 0.25 }); pr.ret(x + 26, y + 6, 30, 20, { cor: COR.cinza, esp: 0.2 }); } });
  const cols = cartoes.length > 6 ? 4 : 3;
  for (let i = 0; i < cartoes.length; i += cols * 2) {
    moldura(c, sub, m.estimativa);
    titulo(pr, "Cartões de fabricação", 10, 27);
    cartoes.slice(i, i + cols * 2).forEach((ca, j) => {
      const x = 10 + (j % cols) * (cols === 4 ? 69.83 : 93.5), yc = 31 + Math.floor(j / cols) * 77, cw = cols === 4 ? 67.5 : 90;
      pr.ret(x, yc, cw, 74, { cor: COR.begeLinha, esp: 0.3, raio: 2 });
      pr.texto(ca.t.toUpperCase(), x + 4, yc + 3.5, { tam: 7.5, fonte: "forte", cor: COR.azul, espaco: 0.6 });
      ca.desenho(x + (cols === 4 ? -8 : 3), yc + 10);
      let yt = yc + 45;
      for (const t of ca.linhas) { pr.circulo(x + 5, yt + 1.2, 0.5, { fundo: COR.dourado }); yt += pr.paragrafo(t, x + 7.5, yt, cw - 11, { tam: cols === 4 ? 5.6 : 6 }) + 0.9; }
    });
    pr.texto("Valores padrão de mercado: conferir com o catálogo do fornecedor das ferragens antes de furar.", 10, 187.5, { tam: 6.2, fonte: "medio", cor: COR.vermelho });
  }
}

// ================= lista de peças, ferragens, materiais e plano de corte =================
function tabela(c: Ctx, tit: string, sub: string, colunas: { t: string; l: number; dir?: boolean }[], linhas: string[][], y0: number | null, vermelhas: Set<number> = new Set()): number {
  const { pr } = c; let y = y0 ?? 0;
  const cabecalho = (cont: boolean) => {
    titulo(pr, tit + (cont ? " (continuação)" : ""), 10, y); y += 5;
    pr.ret(10, y, 277, 5.4, { fundo: COR.azul }); let x = 10;
    for (const col of colunas) { pr.texto(col.t, col.dir ? x + col.l - 1.5 : x + 1.5, y + 1.3, { tam: 6, fonte: "forte", cor: COR.branco, alinhar: col.dir ? "dir" : "esq" }); x += col.l; }
    y += 5.4;
  };
  if (y0 == null || y0 + 10.4 + Math.min(linhas.length, 4) * 4.9 > 186) { moldura(c, sub); y = 27; }
  cabecalho(false);
  linhas.forEach((lin, i) => {
    if (y > 186) { moldura(c, sub); y = 27; cabecalho(true); }
    if (i % 2) pr.ret(10, y, 277, 4.9, { fundo: COR.offwhite });
    let x = 10;
    lin.forEach((t, k) => { const col = colunas[k]; pr.texto(caber(pr, t, col.l - 3, 6), col.dir ? x + col.l - 1.5 : x + 1.5, y + 1.1, { tam: 6, alinhar: col.dir ? "dir" : "esq", cor: vermelhas.has(i) ? COR.vermelho : COR.preto }); x += col.l; });
    y += 4.9;
  });
  return y + 5;
}

export async function gerarPranchasMarcenaria(empresa: Empresa, moveis: Movel[], r: RespostasMarcenaria): Promise<ResultadoMarcenaria> {
  const logo = await imagem(empresa.marca.logoPrancha ?? empresa.marca.logoEscuro);
  const itens = listaDePecas(moveis, r), ferr = ferragens(moveis, r), plano = planoDeCorte(itens, r.veio === "sim");
  const renders = new Map<string, Buffer>();
  const sub = moveis.length === 1 ? moveis[0].nome : `${moveis.length} móveis`;

  const montar = async (total: number) => {
    const pr = new Prancha("A4"), c: Ctx = { pr, empresa, logo, r, total, itens };
    for (const m of moveis) if (m.pecas.length) await folhasDoMovel(c, m, renders);
    const dedu = new Set(itens.map((it, i) => (it.deduzido ? i : -1)).filter((i) => i >= 0));
    let y = tabela(c, "Lista de peças", `${sub}  ·  lista de peças`, [{ t: "ITEM", l: 13 }, { t: "MÓVEL", l: 44 }, { t: "PEÇA", l: 52 }, { t: "QTD", l: 12, dir: true }, { t: "COMPR.", l: 19, dir: true }, { t: "LARG.", l: 19, dir: true }, { t: "ESP.", l: 14, dir: true }, { t: "MATERIAL", l: 68 }, { t: "FITA DE BORDA", l: 36 }],
      itens.map((it) => [String(it.item), it.movel, it.nome + (it.deduzido ? " (deduzido)" : ""), String(it.qtd), mm(it.C), mm(it.L), mm(it.E), it.material, it.fita]), null, dedu);
    if (ferr.length) y = tabela(c, "Ferragens", `${sub}  ·  ferragens`, [{ t: "MÓVEL", l: 60 }, { t: "FERRAGEM", l: 140 }, { t: "QTD", l: 17, dir: true }, { t: "DE ONDE VEIO", l: 60 }], ferr.map((f) => [f.movel, f.nome, String(f.qtd), f.origem === "modelo" ? "modelado no SketchUp" : "calculado por regra"]), y);
    const mats = new Map<string, { m2: number; fita: number; chapas: number }>();
    for (const it of itens) { const k = `${it.material}, ${mm(it.E)} mm`; const o = mats.get(k) ?? { m2: 0, fita: 0, chapas: 0 }; o.m2 += (it.C * it.L * it.qtd) / 1e6; o.fita += it.fitaM; mats.set(k, o); }
    for (const ch of plano.chapas) { const o = mats.get(`${ch.material}, ${mm(ch.esp)} mm`); if (o) o.chapas++; }
    const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    y = tabela(c, "Resumo de materiais", `${sub}  ·  materiais`, [{ t: "MATERIAL", l: 127 }, { t: "ÁREA DE PEÇAS (m²)", l: 50, dir: true }, { t: "FITA DE BORDA (m)", l: 50, dir: true }, { t: `CHAPAS ${PADRAO_MARC.chapaC} x ${PADRAO_MARC.chapaL}`, l: 50, dir: true }], [...mats].map(([k, o]) => [k, n2(o.m2), n2(o.fita), String(o.chapas)]), y);
    if (y < 180) pr.paragrafo("Fita de borda: 4 lados em portas e frentes; 1 lado (frente) em laterais, bases, topos, divisórias e prateleiras. Ferragens calculadas por regra devem ser conferidas com o fornecedor. Itens em vermelho tiveram o tipo deduzido pela posição no modelo.", 10, y, 277, { tam: 6, cor: COR.cinza });
    // plano de corte: duas chapas por folha
    const s = 133 / PADRAO_MARC.chapaC;
    for (let i = 0; i < plano.chapas.length; i += 2) {
      moldura(c, `${sub}  ·  plano de corte (sugestão)`);
      titulo(pr, `Plano de corte: chapa de ${PADRAO_MARC.chapaC} x ${PADRAO_MARC.chapaL} mm, refilo de ${PADRAO_MARC.refilo} mm, serra de ${PADRAO_MARC.serra} mm`, 10, 27);
      plano.chapas.slice(i, i + 2).forEach((ch, j) => {
        const x = 10 + j * 144, yc = 40;
        pr.texto(caber(pr, `Chapa ${i + j + 1} de ${plano.chapas.length}  ·  ${ch.material}, ${mm(ch.esp)} mm`, 130, 7), x, 33, { tam: 7, fonte: "forte", cor: COR.azul });
        pr.ret(x, yc, PADRAO_MARC.chapaC * s, PADRAO_MARC.chapaL * s, { fundo: COR.offwhite, cor: COR.preto, esp: 0.3 });
        for (const p of ch.pecas) {
          const px = x + (PADRAO_MARC.refilo + p.x) * s, py = yc + (PADRAO_MARC.refilo + p.y) * s, l = p.c * s, a = p.l * s;
          pr.ret(px, py, l, a, { fundo: COR.bege, cor: COR.preto, esp: 0.15 });
          if (l > 7 && a > 3.6) pr.texto(String(p.item), px + l / 2, py + a / 2 - 1.2, { tam: 5.5, fonte: "medio", cor: COR.azul, alinhar: "centro" });
        }
        pr.texto(`Aproveitamento: ${Math.round(ch.aproveitamento * 100)}%  ·  ${ch.pecas.length} peça(s)`, x, yc + PADRAO_MARC.chapaL * s + 2.5, { tam: 6.5, cor: COR.cinza });
      });
      pr.paragrafo(`Os números são os itens da lista de peças. ${r.veio === "sim" ? "Acabamento com veio: as peças não foram giradas, o comprimento acompanha o comprimento da chapa." : "Acabamento sem veio: peças podem estar giradas para aproveitar a chapa."} O plano é uma sugestão: o marceneiro pode refazer no programa de corte dele.`, 10, 142, 277, { tam: 6.2, cor: COR.cinza });
      let ya = 153; if (i === 0) for (const f of plano.fora.slice(0, 4)) ya += pr.paragrafo(f, 10, ya, 277, { tam: 6.2, cor: COR.vermelho }) + 1;
    }
    return pr;
  };
  const primeira = await montar(99);
  const total = primeira.folha; await primeira.fechar();
  const pr = await montar(total);
  const avisos: string[] = [...plano.fora];
  if (!pr.fonteOk) avisos.push("Fonte Montserrat não encontrada: a prancha saiu em Helvetica.");
  const sobreposicoes = pr.verificarSobreposicoes();
  if (sobreposicoes.length) avisos.push(`A conferência automática achou ${sobreposicoes.length} sobreposição(ões) de texto ou cota. Revise as pranchas antes de enviar.`);
  avisos.push("Ferragens, veio da madeira e plano de corte são sugestões: conferir com o marceneiro e o catálogo do fornecedor.");
  return { pdf: await pr.fechar(), folhas: total, sobreposicoes, avisos, itens, chapas: plano.chapas };
}
export { NOME_PAPEL };
