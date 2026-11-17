// Leitura da planta SEM inteligência artificial. Funciona com PDF vetorial (exportado do programa de desenho, com texto de verdade).
// O que sai daqui: nomes dos ambientes, medidas internas (pela cota escrita, conferida com o traço das paredes),
// espessura de parede e porta (vão na parede + arco da folha). Louças, bancada, box e ralo NÃO são adivinhados:
// o usuário marca clicando em cima da planta recortada.
import type { Ambiente, Parede, Porta } from "./pranchas/ambiente";

type M6 = [number, number, number, number, number, number];
type Pt = [number, number];
interface Tri { a: Pt; b: Pt; c: Pt; x1: number; y1: number; x2: number; y2: number }
interface Texto { str: string; x: number; y: number; alt: number; ang: number } // ang: 0 = lido na horizontal da folha; 90 = na vertical
export interface Rotulo { nome: string; x: number; y: number; alt: number }
interface Cota { valor: number; x: number; y: number; vertical: boolean }

export interface AmbienteVetorial { ambiente: Ambiente; caixa: { x1: number; y1: number; x2: number; y2: number }; ptPorM: number }
export interface LeituraVetorial {
  ok: boolean;
  motivo?: string; // por que não deu para ler
  rotulos: Rotulo[]; // todos os ambientes nomeados (serve ao memorial)
  ambientes: AmbienteVetorial[]; // só áreas molhadas
  naoLidos?: { nome: string; motivo: string }[]; // nomes achados mas não lidos, com o motivo
  ptPorM: number | null;
  observacoes: string;
  pagina: { largura: number; altura: number };
}

const MOLHADA = /\b(BWC|B\.?W\.?C\.?|BANH(EIRO)?S?|BANHO|LAVABO|W\.?C\.?|SANIT[ÁA]RIOS?|I\.?S\.?|TOALETE|COZINHAS?|COPAS?|CANTINA|COZ\.?|LAVANDERIA|[ÁA]REA DE SERVI[ÇC]O|CHURRASQUEIRA|GOURMET|DML)\b/i;
const NUMERO = /^\d{0,2}[.,]\d{2}$/;
const mul = (a: M6, b: number[]): M6 => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const cm = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toFixed(2).replace(".", ",");

function hexParaRgb(c: unknown): [number, number, number] | null {
  if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  return null;
}

export async function carregarPagina(pdf: Buffer, numero = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, verbosity: 0 }).promise;
  const page = await doc.getPage(numero);
  return { pdfjs, doc, page };
}

export async function lerPlantaVetorial(pdf: Buffer): Promise<LeituraVetorial> {
  const { pdfjs, page } = await carregarPagina(pdf);
  const vp = page.getViewport({ scale: 1 });
  const pagina = { largura: vp.width, altura: vp.height };
  const falha = (motivo: string): LeituraVetorial => ({ ok: false, motivo, rotulos: [], ambientes: [], ptPorM: null, observacoes: "", pagina });

  // ---------- textos ----------
  const tc = await page.getTextContent();
  const textos: Texto[] = [];
  for (const it of tc.items as { str: string; transform: number[]; width: number; height: number }[]) {
    if (!it.str?.trim()) continue;
    const m = mul(vp.transform as M6, it.transform);
    const alt = Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]);
    let ang = Math.round((Math.atan2(m[1], m[0]) * 180) / Math.PI);
    ang = ((ang % 180) + 180) % 180; // 0..179
    // centro aproximado do texto
    const larg = it.width * (Math.hypot(m[0], m[1]) / (Math.hypot(it.transform[0], it.transform[1]) || 1));
    const ux = m[0] / (Math.hypot(m[0], m[1]) || 1), uy = m[1] / (Math.hypot(m[0], m[1]) || 1);
    textos.push({ str: it.str.trim(), x: m[4] + (ux * larg) / 2 + (uy * alt) / 2 * 0.7, y: m[5] + (uy * larg) / 2 - (ux * alt) / 2 * 0.7, alt, ang });
  }
  if (textos.length < 3) return falha("Este PDF não tem texto legível (parece foto ou escaneado). A leitura sem a chave só funciona com PDF exportado direto do programa de desenho.");

  const reto = (t: Texto) => t.ang <= 3 || t.ang >= 177 || Math.abs(t.ang - 90) <= 3;
  const cotas: Cota[] = textos.filter((t) => NUMERO.test(t.str) && reto(t)).map((t) => ({ valor: Number(t.str.replace(",", ".")), x: t.x, y: t.y, vertical: Math.abs(t.ang - 90) <= 3 })).filter((c) => c.valor > 0.3 && c.valor < 60);

  // rótulos: junta linhas próximas ("BWC" + "PNE")
  const palavras = textos.filter((t) => /[A-Za-zÀ-ú]{2,}/.test(t.str) && reto(t) && t.ang <= 3);
  const usados = new Set<number>(); const rotulos: Rotulo[] = [];
  palavras.forEach((t, i) => {
    if (usados.has(i)) return;
    const grupo = [t]; usados.add(i);
    let mudou = true;
    while (mudou) { mudou = false; palavras.forEach((o, k) => { if (usados.has(k) || Math.abs(o.alt - t.alt) > t.alt * 0.25) return; if (grupo.some((g) => Math.abs(g.x - o.x) < t.alt * 6 && Math.abs(g.y - o.y) < t.alt * 2.2)) { grupo.push(o); usados.add(k); mudou = true; } }); }
    grupo.sort((a, b) => a.y - b.y || a.x - b.x);
    rotulos.push({ nome: grupo.map((g) => g.str).join(" ").replace(/\s+/g, " "), x: grupo.reduce((s, g) => s + g.x, 0) / grupo.length, y: grupo.reduce((s, g) => s + g.y, 0) / grupo.length, alt: t.alt });
  });

  // ---------- traços: paredes (preenchimento) e arcos (portas) ----------
  const ops = await page.getOperatorList();
  const O = pdfjs.OPS;
  let ctm = [...vp.transform] as M6, cor: unknown = null; const pilha: [M6, unknown][] = [];
  const porCor = new Map<string, Tri[]>(); const pontos: number[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const f = ops.fnArray[i], a = ops.argsArray[i];
    if (f === O.save) pilha.push([ctm, cor]);
    else if (f === O.restore) { const p = pilha.pop(); if (p) [ctm, cor] = p; }
    else if (f === O.transform) ctm = mul(ctm, a);
    else if (f === O.setFillRGBColor) cor = a[0];
    else if (f === O.constructPath) {
      const pinta = a[0] as number, d = a[1]?.[0] as Float32Array | undefined;
      if (!d || pinta === O.endPath) continue;
      const T = (x: number, y: number): Pt => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
      const subs: Pt[][] = []; let atual: Pt[] = []; let nCurvas = 0, j = 0;
      while (j < d.length) {
        const c = d[j++];
        if (c === 0) { atual = [T(d[j], d[j + 1])]; subs.push(atual); j += 2; }
        else if (c === 1) { atual.push(T(d[j], d[j + 1])); j += 2; }
        else if (c === 2) { nCurvas++; atual.push(T(d[j + 4], d[j + 5])); j += 6; }
        else if (c === 3) { nCurvas++; atual.push(T(d[j + 2], d[j + 3])); j += 4; }
      }
      const preenche = pinta !== O.stroke && pinta !== O.closeStroke;
      const rgb = hexParaRgb(cor);
      if (preenche && rgb && nCurvas === 0) {
        const [r, g, b] = rgb;
        // parede: cinza neutro (nem branco, nem preto puro de linha)
        if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r >= 40 && r <= 190) {
          const lista = porCor.get(cor as string) ?? []; porCor.set(cor as string, lista);
          for (const s of subs) { if (s.length < 3) continue; for (let k = 1; k + 1 < s.length; k++) { const [p, q, t] = [s[0], s[k], s[k + 1]]; lista.push({ a: p, b: q, c: t, x1: Math.min(p[0], q[0], t[0]), y1: Math.min(p[1], q[1], t[1]), x2: Math.max(p[0], q[0], t[0]), y2: Math.max(p[1], q[1], t[1]) }); } }
        }
      }
      // pontos dos traços finos (linhas e arcos): servem para achar o arco da folha da porta
      const mm = a[2] as Float32Array | undefined;
      if (mm) { const [p, q] = [T(mm[0], mm[1]), T(mm[2], mm[3])]; if (Math.abs(p[0] - q[0]) < 40 && Math.abs(p[1] - q[1]) < 40) for (const s of subs) for (const pt of s) pontos.push(pt[0], pt[1]); }
    }
  }
  // a cor de parede é o cinza com mais área preenchida
  let paredes: Tri[] = []; let maior = 0;
  for (const lista of porCor.values()) { const area = lista.reduce((s, t) => s + Math.abs((t.b[0] - t.a[0]) * (t.c[1] - t.a[1]) - (t.c[0] - t.a[0]) * (t.b[1] - t.a[1])) / 2, 0); if (lista.length >= 8 && area > maior) { maior = area; paredes = lista; } }

  const molhadas = rotulos.filter((r) => MOLHADA.test(r.nome));
  const base = { rotulos, pagina };
  if (paredes.length === 0) return { ok: false, motivo: "Não encontrei paredes preenchidas nesta planta (o traço das paredes não está pintado de cinza). Consigo ler os nomes dos ambientes, mas não as medidas com segurança.", ambientes: [], ptPorM: null, observacoes: "", ...base };
  if (molhadas.length === 0) return { ok: false, motivo: "Não encontrei nenhum ambiente com nome de banheiro, BWC, lavabo ou sanitário escrito na planta.", ambientes: [], ptPorM: null, observacoes: "", ...base };

  // grade para achar parede rápido
  const CEL = 8, grade = new Map<number, Tri[]>(), chave = (gx: number, gy: number) => gx * 100003 + gy;
  for (const t of paredes) for (let gx = Math.floor(t.x1 / CEL); gx <= Math.floor(t.x2 / CEL); gx++) for (let gy = Math.floor(t.y1 / CEL); gy <= Math.floor(t.y2 / CEL); gy++) { const k = chave(gx, gy); let l = grade.get(k); if (!l) grade.set(k, (l = [])); l.push(t); }
  const sinal = (p: Pt, q: Pt, r: Pt) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const naParede = (x: number, y: number) => {
    const l = grade.get(chave(Math.floor(x / CEL), Math.floor(y / CEL))); if (!l) return false;
    for (const t of l) { if (x < t.x1 - 0.05 || x > t.x2 + 0.05 || y < t.y1 - 0.05 || y > t.y2 + 0.05) continue; const p: Pt = [x, y], d1 = sinal(p, t.a, t.b), d2 = sinal(p, t.b, t.c), d3 = sinal(p, t.c, t.a); if (!((d1 < -0.01 || d2 < -0.01 || d3 < -0.01) && (d1 > 0.01 || d2 > 0.01 || d3 > 0.01))) return true; }
    return false;
  };
  const PASSO = 0.1, LIMITE = Math.max(pagina.largura, pagina.altura) * 0.4;
  const raio = (x: number, y: number, dx: number, dy: number): number | null => { for (let d = 0; d < LIMITE; d += PASSO) if (naParede(x + dx * d, y + dy * d)) return d; return null; };
  // Face da parede a partir das batidas dos raios. Raios que passam pela porta vão mais longe; saliências (pilar) batem antes.
  // Sem escala conhecida: o grupo mais próximo com 30% dos raios. Com escala: aceita 15% (porta larga em parede curta),
  // mas se logo atrás (menos de 0,45 m) houver um grupo com mais da metade dos raios, o da frente é saliência.
  const moda = (v: number[], S: number | null): { valor: number; fracao: number } | null => {
    if (!v.length) return null; const m = new Map<number, number>();
    for (const x of v) { const k = Math.round(x / 0.3); m.set(k, (m.get(k) ?? 0) + 1); }
    const fr = (k: number) => ((m.get(k) ?? 0) + (m.get(k + 1) ?? 0)) / v.length;
    const grupos = [...m.keys()].sort((a, b) => a - b), minimo = S ? 0.15 : 0.3;
    let melhor = grupos.find((k) => fr(k) >= minimo);
    if (melhor == null) return null;
    if (S) { const atras = grupos.find((k) => k > melhor! + 1 && (k - melhor!) * 0.3 < 0.45 * S && fr(k) >= 0.5); if (atras != null && fr(melhor) < 0.5) melhor = atras; }
    const perto = v.filter((x) => { const k = Math.round(x / 0.3); return k === melhor || k === melhor! + 1; }), valor = perto.reduce((a, x) => a + x, 0) / perto.length;
    return { valor, fracao: 1 - v.filter((x) => x < valor - 0.6).length / v.length }; // fracao = parte dos raios que não bateu antes da face
  };

  // ---------- caixa interna de cada ambiente ----------
  interface Caixa { r: Rotulo; x1: number; y1: number; x2: number; y2: number; regular: boolean }
  const naoLidos: { nome: string; motivo: string }[] = [];
  const acharCaixas = (S: number | null) => { const caixas: Caixa[] = []; naoLidos.length = 0;
  for (const r of molhadas) {
    if (naParede(r.x, r.y)) { naoLidos.push({ nome: r.nome, motivo: 'o nome está escrito em cima de uma parede, não dentro do ambiente' }); continue; }
    // os raios sempre saem de perto do nome do ambiente (que está dentro dele), varrendo a faixa já conhecida
    const d0 = r.alt * 1.5;
    let x1 = r.x - d0, x2 = r.x + d0, y1 = r.y - d0, y2 = r.y + d0, regular = true, falhou = false;
    const faixa = (de: number, ate: number) => Array.from({ length: 21 }, (_, k) => de + ((ate - de) * (k + 1)) / 22);
    for (let volta = 0; volta < 3 && !falhou; volta++) {
      const cima = moda(faixa(x1, x2).map((x) => raio(x, r.y, 0, -1)).filter((d): d is number => d != null), S), baixo = moda(faixa(x1, x2).map((x) => raio(x, r.y, 0, 1)).filter((d): d is number => d != null), S);
      if (!cima || !baixo) { falhou = true; break; }
      [y1, y2] = [r.y - cima.valor, r.y + baixo.valor];
      const esq = moda(faixa(y1, y2).map((y) => raio(r.x, y, -1, 0)).filter((d): d is number => d != null), S), dir = moda(faixa(y1, y2).map((y) => raio(r.x, y, 1, 0)).filter((d): d is number => d != null), S);
      if (!esq || !dir) { falhou = true; break; }
      [x1, x2] = [r.x - esq.valor, r.x + dir.valor];
      regular = Math.min(esq.fracao, dir.fracao, cima.fracao, baixo.fracao) >= 0.85;
    }
    if (falhou) { naoLidos.push({ nome: r.nome, motivo: 'não consegui fechar as paredes em volta: ambiente aberto, parede fora do padrão ou nome longe do ambiente' }); continue; }
    if (x2 - x1 > 3 && y2 - y1 > 3) caixas.push({ r, x1, y1, x2, y2, regular }); else naoLidos.push({ nome: r.nome, motivo: 'o espaço encontrado é pequeno demais' });
  }
  return caixas; };
  let caixas = acharCaixas(null);
  if (caixas.length === 0) return { ok: false, motivo: "Achei os nomes dos banheiros, mas não consegui fechar as paredes em volta deles.", ambientes: [], ptPorM: null, observacoes: "", ...base };

  // ---------- escala: compara o traço com as cotas escritas dentro ou junto de cada ambiente ----------
  const cotasDe = (c: Caixa, vertical: boolean) => { const mx = (c.x2 - c.x1) * 0.35 + 4, my = (c.y2 - c.y1) * 0.35 + 4; return cotas.filter((k) => k.vertical === vertical && k.x > c.x1 - mx && k.x < c.x2 + mx && k.y > c.y1 - my && k.y < c.y2 + my); };
  const razoes: number[] = [];
  for (const c of caixas) { for (const k of cotasDe(c, false)) razoes.push((c.x2 - c.x1) / k.valor); for (const k of cotasDe(c, true)) razoes.push((c.y2 - c.y1) / k.valor); }
  let ptPorM: number | null = null, votos = 0;
  for (const s of razoes) { const n = razoes.filter((x) => Math.abs(x - s) / s < 0.012); if (n.length > votos) { votos = n.length; ptPorM = n.reduce((a, b) => a + b, 0) / n.length; } }
  let escalaPorTexto = false;
  if (votos < 2) {
    const esc = textos.map((t) => /^(?:ESC(?:ALA)?\.?\s*)?1\s*[:/]\s*(\d{2,3})$/i.exec(t.str)).find(Boolean);
    if (esc) { ptPorM = 72 / 0.0254 / Number(esc[1]); escalaPorTexto = true; } else if (votos < 1) ptPorM = null;
  }
  if (!ptPorM) return { ok: false, motivo: "Não consegui confirmar a escala: as cotas escritas não bateram com o traço das paredes e a planta não indica escala (ex.: 1:50).", ambientes: [], ptPorM: null, observacoes: "", ...base };
  const S = ptPorM;
  caixas = acharCaixas(S); // segunda passada, agora com a escala conhecida

  // ---------- monta cada ambiente ----------
  const ambientes: AmbienteVetorial[] = [];
  for (const c of caixas) {
    const obs: string[] = [];
    const medida = (pt: number, vertical: boolean, nome: string) => {
      const m = pt / S, escritas = cotasDe(c, vertical).filter((k) => Math.abs(k.valor - m) / m < 0.02).sort((a, b) => Math.abs(a.valor - m) - Math.abs(b.valor - m));
      if (escritas.length) return escritas[0].valor;
      const proxima = cotasDe(c, vertical).filter((k) => Math.abs(k.valor - m) / m < 0.15).sort((a, b) => Math.abs(a.valor - m) - Math.abs(b.valor - m))[0];
      obs.push(proxima ? `${nome}: o traço mede ${fmt(cm(m))} m, mas a cota escrita mais próxima é ${fmt(proxima.valor)} m. Usei o traço: conferir qual vale.` : `${nome} de ${fmt(cm(m))} m medida pelo traço (não achei a cota escrita): conferir.`);
      return cm(m);
    };
    const largura = medida(c.x2 - c.x1, false, "Largura"), comprimento = medida(c.y2 - c.y1, true, "Comprimento");
    if (!c.regular) obs.push("O ambiente parece não ser um retângulo simples: usei o retângulo principal.");

    // espessura das paredes
    const esp: number[] = [];
    const mede = (x: number, y: number, dx: number, dy: number) => { let d = 0.3; if (!naParede(x + dx * d, y + dy * d)) return; while (d < S && naParede(x + dx * d, y + dy * d)) d += 0.1; esp.push(d - 0.1); };
    for (const f of [0.25, 0.5, 0.75]) { const x = c.x1 + (c.x2 - c.x1) * f, y = c.y1 + (c.y2 - c.y1) * f; mede(x, c.y1, 0, -1); mede(x, c.y2, 0, 1); mede(c.x1, y, -1, 0); mede(c.x2, y, 1, 0); }
    esp.sort((a, b) => a - b);
    const espPt = esp.length ? esp[Math.floor(esp.length / 2)] : 0.15 * S;
    const espessuraParede = cm(Math.min(0.4, Math.max(0.08, espPt / S)));

    // vãos: trechos sem parede logo atrás da face interna
    interface Vao { parede: Parede; de: number; ate: number }
    const vaos: Vao[] = [];
    const lado = (parede: Parede) => {
      const horizontal = parede === "N" || parede === "S", L = horizontal ? c.x2 - c.x1 : c.y2 - c.y1, fora = Math.min(espPt * 0.5, 0.08 * S);
      const ponto = (t: number): Pt => parede === "N" ? [c.x1 + t, c.y1 - fora] : parede === "S" ? [c.x1 + t, c.y2 + fora] : parede === "O" ? [c.x1 - fora, c.y1 + t] : [c.x2 + fora, c.y1 + t];
      let ini: number | null = null;
      for (let t = 0; t <= L + 0.05; t += 0.1) { const [x, y] = ponto(Math.min(t, L)); const vazio = t < L && !naParede(x, y); if (vazio && ini == null) ini = t; if (!vazio && ini != null) { if ((t - ini) / S >= 0.5 && (t - ini) / S <= 2.2) vaos.push({ parede, de: ini, ate: t }); ini = null; } }
    };
    (["N", "S", "O", "L"] as Parede[]).forEach(lado);

    // porta: vão na parede com o arco da folha (quarto de círculo com centro na dobradiça)
    let porta: Porta | null = null; const semArco: Vao[] = [];
    for (const v of vaos) {
      const w = v.ate - v.de, horizontal = v.parede === "N" || v.parede === "S";
      const face = v.parede === "N" ? c.y1 : v.parede === "S" ? c.y2 : v.parede === "O" ? c.x1 : c.x2, dentroSinal = v.parede === "N" || v.parede === "O" ? 1 : -1;
      const a0 = (horizontal ? c.x1 : c.y1) + v.de, a1 = a0 + w;
      let achou: { abre: "dentro" | "fora"; dobradica: "inicio" | "fim" } | null = null, cobertura = 0;
      for (const abre of ["dentro", "fora"] as const) for (const dobradica of ["inicio", "fim"] as const) {
        const cAl = dobradica === "inicio" ? a0 : a1, dirAl = dobradica === "inicio" ? 1 : -1;
        const dirPe = abre === "dentro" ? dentroSinal : -dentroSinal, cPe = abre === "dentro" ? face : face - dentroSinal * espPt;
        const baldes = new Map<number, Set<number>>();
        for (let k = 0; k < pontos.length; k += 2) {
          const al = ((horizontal ? pontos[k] : pontos[k + 1]) - cAl) * dirAl, pe = ((horizontal ? pontos[k + 1] : pontos[k]) - cPe) * dirPe;
          if (al < -0.05 * w || pe < -0.05 * w || al > 1.15 * w || pe > 1.15 * w) continue;
          const d = Math.hypot(al, pe); if (d < 0.7 * w || d > 1.12 * w) continue;
          const ang = Math.floor((Math.atan2(pe, al) * 180) / Math.PI / 10); if (ang < 1 || ang > 7) continue; // sem as pontas (folha e parede)
          const rb = Math.round(d / (0.04 * w));
          for (const b of [rb, rb + 1]) { let st = baldes.get(b); if (!st) baldes.set(b, (st = new Set())); st.add(ang); }
        }
        let melhor = 0; for (const st of baldes.values()) melhor = Math.max(melhor, st.size);
        if (melhor >= 5 && melhor > cobertura) { cobertura = melhor; achou = { abre, dobradica }; }
      }
      if (achou && !porta) porta = { parede: v.parede, inicio: cm(v.de / S), largura: cm(w / S), altura: 2.1, ...achou };
      else if (!achou) semArco.push(v);
    }
    if (!porta && semArco.length === 1) { const v = semArco[0]; porta = { parede: v.parede, inicio: cm(v.de / S), largura: cm((v.ate - v.de) / S), altura: 2.1, abre: "dentro", dobradica: "inicio" }; obs.push("Achei o vão da porta, mas não o arco da folha: conferir para que lado abre e a dobradiça."); }
    else if (!porta) obs.push("Não identifiquei a porta: marque na planta ao lado.");
    if (porta) obs.push(`Vão da porta de ${fmt(porta.largura)} m medido pelo traço: conferir.`);
    obs.push("Vaso, bancada, cubas, box, chuveiro e ralo: marque clicando em cima da planta.");

    ambientes.push({
      ambiente: { nome: c.r.nome, largura, comprimento, espessuraParede, porta, box: null, chuveiro: null, ralo: null, vasos: [], bancadas: [], acessivel: "", observacoesLeitura: obs.join(" ") },
      caixa: { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 }, ptPorM: S,
    });
  }
  const escala = Math.round(72 / 0.0254 / S);
  const observacoes = `Leitura feita pelo texto e pelo traço do PDF, sem inteligência artificial. Escala do desenho: cerca de 1:${escala}${escalaPorTexto ? " (pela indicação escrita)" : ` (conferida com ${votos} cota(s) escrita(s))`}.`;
  const aviso = naoLidos.length
    ? ` ATENÇÃO: achei ${molhadas.length} nome(s) de áreas molhadas e li ${ambientes.length}. Não li: ${naoLidos.map((n) => `${n.nome} (${n.motivo})`).join('; ')}. Para esses, use "+ Adicionar ambiente à mão" e digite as medidas da planta.`
    : ` Li todos os ${ambientes.length} ambiente(s) com nome de área molhada que achei na planta.`;
  return { ok: true, ambientes, naoLidos: [...naoLidos], ptPorM: S, observacoes: observacoes + aviso, ...base };
}

// Recortes da planta em PNG, um por ambiente, para o usuário marcar as peças em cima.
// x0/y0 = posição, em pixels, do canto interno noroeste do ambiente dentro da imagem.
export interface RecorteGerado { png: Buffer; largura: number; altura: number; x0: number; y0: number; pxPorM: number }
export async function recortarAmbientes(pdf: Buffer, itens: { caixa: { x1: number; y1: number; x2: number; y2: number }; ptPorM: number }[], pxPorM = 150): Promise<RecorteGerado[]> {
  const { pdfjs, page } = await carregarPagina(pdf);
  const { createCanvas } = await import("@napi-rs/canvas");
  // caixa de cada traço na folha, para desenhar só o que cai dentro do recorte (a planta inteira tem centenas de milhares de traços)
  const base = page.getViewport({ scale: 1 }), ops = await page.getOperatorList(), O = pdfjs.OPS, n = ops.fnArray.length;
  const cx = new Float32Array(n * 4); let ctm = [...base.transform] as M6; const pilha: M6[] = [];
  for (let i = 0; i < n; i++) {
    const f = ops.fnArray[i], a = ops.argsArray[i];
    if (f === O.save) pilha.push(ctm); else if (f === O.restore) ctm = pilha.pop() ?? ctm; else if (f === O.transform) ctm = mul(ctm, a);
    else if (f === O.constructPath && a[2]) {
      const mm = a[2] as Float32Array, xs = [mm[0], mm[2]], ys = [mm[1], mm[3]]; let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const x of xs) for (const y of ys) { const px = ctm[0] * x + ctm[2] * y + ctm[4], py = ctm[1] * x + ctm[3] * y + ctm[5]; x1 = Math.min(x1, px); y1 = Math.min(y1, py); x2 = Math.max(x2, px); y2 = Math.max(y2, py); }
      cx.set([x1, y1, x2, y2], i * 4);
    } else cx[i * 4] = NaN;
  }
  const saida: RecorteGerado[] = [];
  for (const { caixa, ptPorM } of itens) {
    const z = pxPorM / ptPorM, margem = 0.6 * ptPorM;
    const x0 = caixa.x1 - margem, y0 = caixa.y1 - margem, x9 = caixa.x2 + margem, y9 = caixa.y2 + margem, w = Math.ceil((x9 - x0) * z), h = Math.ceil((y9 - y0) * z);
    const canvas = createCanvas(w, h), ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    const viewport = page.getViewport({ scale: z, offsetX: -x0 * z, offsetY: -y0 * z });
    const operationsFilter = (i: number) => { const k = i * 4; if (ops.fnArray[i] !== O.constructPath || Number.isNaN(cx[k])) return true; return !(cx[k + 2] < x0 || cx[k] > x9 || cx[k + 3] < y0 || cx[k + 1] > y9); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, canvas: canvas as any, viewport, operationsFilter } as any).promise;
    saida.push({ png: canvas.toBuffer("image/png"), largura: w, altura: h, x0: margem * z, y0: margem * z, pxPorM });
  }
  return saida;
}
