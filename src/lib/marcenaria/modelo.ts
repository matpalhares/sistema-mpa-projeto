// MARCENARIA: do modelo (SketchUp exportado em JSON, ou móvel descrito por medidas) até a lista de peças, ferragens e plano de corte.
// Tudo em milímetros. Sistema de eixos do móvel: X = largura (da esquerda para a direita, visto de frente),
// Y = profundidade (0 = frente), Z = altura (0 = chão do móvel).
// Os valores "padrão de mercado" vêm da regra de detalhamento do escritório e devem ser conferidos com o catálogo do fornecedor.

export type Papel = "lateral" | "base" | "topo" | "fundo" | "divisoria" | "prateleira" | "rodape" | "travessa" | "porta" | "frente_gaveta" | "lateral_gaveta" | "traseira_gaveta" | "fundo_gaveta" | "painel" | "ripa" | "ferragem" | "outro";
export const NOME_PAPEL: Record<Papel, string> = {
  lateral: "Lateral", base: "Base", topo: "Topo", fundo: "Fundo", divisoria: "Divisória", prateleira: "Prateleira", rodape: "Rodapé", travessa: "Travessa",
  porta: "Porta", frente_gaveta: "Frente de gaveta", lateral_gaveta: "Lateral de gaveta", traseira_gaveta: "Traseira de gaveta", fundo_gaveta: "Fundo de gaveta",
  painel: "Painel", ripa: "Ripa", ferragem: "Ferragem (não é chapa)", outro: "Outra peça",
};
export const PAPEIS = Object.keys(NOME_PAPEL) as Papel[];
const FRENTES: Papel[] = ["porta", "frente_gaveta"];
const INTERIOR_GAVETA: Papel[] = ["lateral_gaveta", "traseira_gaveta", "fundo_gaveta"];
export const ehFrente = (p: Papel) => FRENTES.includes(p);
export const ehGavetaInterna = (p: Papel) => INTERIOR_GAVETA.includes(p);

// Padrões de mercado (regra do escritório). Conferir sempre com o catálogo do fornecedor.
export const PADRAO_MARC = {
  caneco: 35, canecoProf: 12.5, canecoCentro: 21.5, dobradicaPonta: 100, sistema32: 32, sistema32Frente: 37,
  corredicaFolga: 12.7, corredicas: [250, 300, 350, 400, 450, 500, 550], corredicaRecuo: 50,
  fundoGaveta: 3, rasgoGaveta: "4 x 8 mm", rasgoGavetaAltura: 10, fundoCaixa: 6, rasgoCaixa: "6,5 x 8 mm", rasgoProf: 8,
  cavilha: "Ø8 x 30 mm", minifix: "Ø15 mm", cava: "45° (12 x 35 mm)", friso: "3 x 3 mm em V, a 60 mm",
  chapaC: 2750, chapaL: 1840, refilo: 10, serra: 3, espFrente: 18,
};
export const dobradicasPorAltura = (h: number) => (h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2100 ? 4 : 5);
export const corredicaPara = (prof: number) => [...PADRAO_MARC.corredicas].reverse().find((c) => c <= prof - PADRAO_MARC.corredicaRecuo) ?? null;

// ---------- arquivo exportado do SketchUp (versão mpa-marcenaria-1) ----------
export interface PecaBruta { caminho?: string[]; nome?: string; def?: string; oculto?: boolean; tag?: string; material?: string | null; dims_mm: number[]; bbox_mm: [number[], number[]]; caixa_ratio?: number; attrs?: Record<string, unknown> }
export interface ModeloBruto { versao?: string; cores?: Record<string, number[]>; pecas: PecaBruta[] }

export function validarModelo(j: unknown): { ok: true; modelo: ModeloBruto } | { ok: false; erro: string } {
  const m = j as ModeloBruto;
  if (!m || typeof m !== "object" || !Array.isArray(m.pecas)) return { ok: false, erro: "Este arquivo não é o JSON do exportador de marcenaria (falta a lista de peças). Gere o arquivo pelo plugin MPA no SketchUp." };
  const boas = m.pecas.filter((p) => Array.isArray(p?.dims_mm) && p.dims_mm.length === 3 && Array.isArray(p?.bbox_mm) && p.bbox_mm.length === 2 && p.bbox_mm.every((v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n))));
  if (boas.length === 0) return { ok: false, erro: "O arquivo não tem nenhuma peça com medidas. No SketchUp, cada peça precisa ser um grupo ou componente." };
  return { ok: true, modelo: { ...m, pecas: boas } };
}

export interface Peca {
  nome: string; papel: Papel; deduzido: boolean; // deduzido = o papel saiu da posição da peça, não do nome
  material: string; cor: [number, number, number];
  C: number; L: number; E: number; // comprimento, largura, espessura (ordem decrescente)
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  fino: "X" | "Y" | "Z"; chave: string; attrs: Record<string, unknown>;
}
export interface Movel { nome: string; L: number; P: number; A: number; pecas: Peca[]; explicitas: { nome: string; qtd: number }[]; avisos: string[]; estimativa: boolean }

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const meio = (v: number) => Math.round(v * 2) / 2;
const nomeBase = (n: string) => n.replace(/[\s_#-]*\d+$/, "").replace(/_/g, " ").trim() || n;
const FERRAGEM = /corredi|puxador|dobradi|minifix|cavilha|parafuso|sapata|trilho|pistao|suporte|led\b|perfil/;
const POR_NOME: [RegExp, Papel][] = [
  [/painel/, "painel"], [/ripa/, "ripa"], [/lateral.*gaveta/, "lateral_gaveta"], [/(traseira|contra.?frente)/, "traseira_gaveta"], [/fundo.*gaveta/, "fundo_gaveta"],
  [/frente/, "frente_gaveta"], [/porta/, "porta"], [/lateral/, "lateral"], [/divis/, "divisoria"], [/prateleira/, "prateleira"], [/rodape/, "rodape"],
  [/(travessa|regua|sarrafo)/, "travessa"], [/base/, "base"], [/(topo|tampo)/, "topo"], [/fundo/, "fundo"],
];
const papelPeloNome = (nome: string): Papel | null => { const n = semAcento(nome); if (FERRAGEM.test(n)) return "ferragem"; return POR_NOME.find(([r]) => r.test(n))?.[1] ?? null; };
const COR_CAIXA: [number, number, number] = [228, 217, 196], COR_FRENTE: [number, number, number] = [203, 184, 150];

export function chaveDe(movel: string, nome: string, C: number, L: number, E: number) { return `${movel}|${nomeBase(nome)}|${C}x${L}x${E}`; }

// Monta os móveis a partir do arquivo do SketchUp. Cada grupo do primeiro nível vira um móvel.
export function moveisDoModelo(m: ModeloBruto, papeis: Record<string, Papel> = {}, nomePadrao = "Móvel"): Movel[] {
  const grupos = new Map<string, PecaBruta[]>();
  for (const p of m.pecas) { if (p.oculto) continue; const g = p.caminho?.[0] || nomePadrao; grupos.set(g, [...(grupos.get(g) ?? []), p]); }
  return [...grupos.entries()].map(([nome, brutas]) => montarMovel(nome, brutas, m.cores ?? {}, papeis));
}

function montarMovel(nome: string, brutas: PecaBruta[], cores: Record<string, number[]>, papeis: Record<string, Papel>): Movel {
  const avisos: string[] = [], explicitas = new Map<string, number>();
  const chapas: PecaBruta[] = [];
  for (const p of brutas) {
    const n = p.nome || p.def || "Peça";
    if (papelPeloNome(n) === "ferragem") { explicitas.set(nomeBase(n), (explicitas.get(nomeBase(n)) ?? 0) + 1); continue; }
    chapas.push(p);
  }
  if (chapas.length === 0) return { nome, L: 0, P: 0, A: 0, pecas: [], explicitas: [...explicitas].map(([n, qtd]) => ({ nome: n, qtd })), avisos: ["Este grupo só tem ferragens."], estimativa: false };
  const min = [0, 1, 2].map((k) => Math.min(...chapas.map((p) => p.bbox_mm[0][k]))), max = [0, 1, 2].map((k) => Math.max(...chapas.map((p) => p.bbox_mm[1][k])));
  const ext = (p: PecaBruta, k: number) => p.bbox_mm[1][k] - p.bbox_mm[0][k];
  const eixoFino = (p: PecaBruta) => [0, 1, 2].reduce((a, k) => (ext(p, k) < ext(p, a) ? k : a), 0);
  // ---- de que lado fica a frente? ----
  let eixo = max[0] - min[0] < max[1] - min[1] ? 0 : 1, frenteNoMin = true, achou = false;
  const lado = (lista: PecaBruta[], k: number) => lista.filter((p) => (p.bbox_mm[0][k] + p.bbox_mm[1][k]) / 2 < (min[k] + max[k]) / 2).length * 2 >= lista.length;
  const frentes = chapas.filter((p) => { const pp = papelPeloNome(p.nome || p.def || ""); return (pp === "porta" || pp === "frente_gaveta") && eixoFino(p) !== 2; });
  const fundos = chapas.filter((p) => eixoFino(p) !== 2 && Math.min(...p.dims_mm) <= 9 && ext(p, 2) > 0.5 * (max[2] - min[2]));
  if (frentes.length) { eixo = frentes.filter((p) => eixoFino(p) === 0).length * 2 > frentes.length ? 0 : 1; frenteNoMin = lado(frentes, eixo); achou = true; }
  else if (fundos.length) { eixo = fundos.filter((p) => eixoFino(p) === 0).length * 2 > fundos.length ? 0 : 1; frenteNoMin = !lado(fundos, eixo); achou = true; }
  else {
    const perto = (noMin: boolean) => chapas.filter((p) => eixoFino(p) === eixo && (noMin ? p.bbox_mm[0][eixo] - min[eixo] < 60 : max[eixo] - p.bbox_mm[1][eixo] < 60)).length;
    frenteNoMin = perto(true) >= perto(false);
  }
  if (!achou) avisos.push("Não encontrei portas nem fundo para saber qual é a frente do móvel: considerei a face mais estreita voltada para a câmera. Confira as vistas.");
  const o = eixo === 1 ? 0 : 1; // eixo da largura
  const local = (p: PecaBruta) => {
    const [a, b] = p.bbox_mm;
    const y: [number, number] = frenteNoMin ? [a[eixo] - min[eixo], b[eixo] - min[eixo]] : [max[eixo] - b[eixo], max[eixo] - a[eixo]];
    // visto de frente: se a frente está no menor Y (ou no maior X), a largura cresce no sentido do eixo; senão, inverte
    const direto = eixo === 1 ? frenteNoMin : !frenteNoMin;
    const x: [number, number] = direto ? [a[o] - min[o], b[o] - min[o]] : [max[o] - b[o], max[o] - a[o]];
    return { x0: x[0], x1: x[1], y0: y[0], y1: y[1], z0: a[2] - min[2], z1: b[2] - min[2] };
  };
  const L = max[o] - min[o], P = max[eixo] - min[eixo], A = max[2] - min[2];
  const pecas: Peca[] = chapas.map((p) => {
    const n = p.nome || p.def || "Peça", g = local(p), d = [...p.dims_mm].sort((a, b) => b - a).map(meio);
    const dx = g.x1 - g.x0, dy = g.y1 - g.y0, dz = g.z1 - g.z0;
    const fino: Peca["fino"] = dx <= dy && dx <= dz ? "X" : dy <= dz ? "Y" : "Z";
    const cor = p.material && cores[p.material] ? (cores[p.material].slice(0, 3) as [number, number, number]) : COR_CAIXA;
    return { nome: n, papel: "outro" as Papel, deduzido: true, material: p.material || "", cor, C: d[0], L: d[1], E: d[2], ...g, fino, chave: chaveDe(nome, n, d[0], d[1], d[2]), attrs: p.attrs ?? {} };
  });
  // ---- papel de cada peça: pelo nome; sem nome reconhecível, pela posição ----
  for (const p of pecas) { const pn = papelPeloNome(p.nome); if (pn) { p.papel = pn; p.deduzido = false; } }
  const semNome = pecas.filter((p) => p.deduzido);
  for (const p of semNome) {
    if (p.E > 60) { p.papel = "outro"; continue; }
    if (p.fino === "Y" && p.y0 <= 5 && !(p.z1 - p.z0 <= 200 && p.z0 < 30 && p.z1 < A - 30)) p.papel = p.z1 - p.z0 <= 400 && p.x1 - p.x0 >= p.z1 - p.z0 ? "frente_gaveta" : "porta";
  }
  const zonas = pecas.filter((p) => p.papel === "frente_gaveta");
  const naGaveta = (p: Peca) => zonas.some((f) => p.x0 >= f.x0 - 5 && p.x1 <= f.x1 + 5 && p.z0 >= f.z0 - 5 && p.z1 <= f.z1 + 5 && p.y0 >= f.y1 - 1);
  for (const p of semNome) {
    if (p.papel !== "outro" || p.E > 60) continue;
    const dz = p.z1 - p.z0;
    if (p.fino === "Y") {
      if (dz <= 200 && p.z0 < 30 && p.z1 < A - 30) p.papel = "rodape";
      else if (p.y1 >= P - 25) p.papel = p.E <= 9 || dz > 150 ? "fundo" : "travessa";
      else p.papel = naGaveta(p) ? "traseira_gaveta" : "travessa";
    } else if (p.fino === "X") {
      if (p.x0 <= 3 || p.x1 >= L - 3) p.papel = "lateral"; else p.papel = naGaveta(p) ? "lateral_gaveta" : "divisoria";
    } else {
      if (naGaveta(p)) p.papel = "fundo_gaveta"; else if (p.z1 >= A - 3) p.papel = "topo";
      else p.papel = pecas.some((q) => q !== p && q.fino === "Z" && !naGaveta(q) && q.z0 < p.z0 - 1 && q.x0 < p.x1 && q.x1 > p.x0) ? "prateleira" : "base";
    }
  }
  for (const p of pecas) { const forcado = papeis[p.chave]; if (forcado) { p.papel = forcado; p.deduzido = false; } if (ehFrente(p.papel) && p.cor === COR_CAIXA) p.cor = COR_FRENTE; }
  const macicas = pecas.filter((p) => p.E > 60 && p.papel === "outro").length;
  if (macicas) avisos.push(`${macicas} peça(s) com mais de 6 cm de espessura: parecem blocos maciços, não chapas. Se o móvel foi modelado como bloco, descreva-o em "Móvel por medidas".`);
  const ded = pecas.filter((p) => p.deduzido).length;
  if (ded) avisos.push(`${ded} peça(s) sem nome reconhecido: o tipo foi deduzido pela posição. Confira a lista e corrija o que estiver errado.`);
  return { nome, L, P, A, pecas, explicitas: [...explicitas].map(([n, qtd]) => ({ nome: n, qtd })), avisos, estimativa: false };
}

// ---------- móvel descrito por medidas (planta com cotas e legenda, sem SketchUp) ----------
export interface ModuloParam { tipo: "" | "portas" | "gavetas" | "aberto"; portas: number; gavetas: number; prateleiras: number; largura: number | null } // largura vazia = divide igual
export interface MovelParam {
  nome: string; ambiente: string; L: number | null; P: number | null; A: number | null; // mm
  rodape: "" | "sim" | "nao"; rodapeAltura: number | null; rodapeRecuo: number | null; fundo: "" | "sim" | "nao"; modulos: ModuloParam[];
}
export const moduloNovo = (): ModuloParam => ({ tipo: "", portas: 0, gavetas: 0, prateleiras: 0, largura: null });
export const movelParamNovo = (n: number): MovelParam => ({ nome: `Móvel ${n}`, ambiente: "", L: null, P: null, A: null, rodape: "", rodapeAltura: null, rodapeRecuo: null, fundo: "", modulos: [moduloNovo()] });

export function perguntasDoMovelParam(m: MovelParam, r: RespostasMarcenaria): string[] {
  const q: string[] = [], n = m.nome || "móvel";
  if (m.L == null || m.P == null || m.A == null) q.push(`${n}: informe largura, profundidade e altura (marque na planta ou digite).`);
  if (!m.rodape) q.push(`${n}: tem rodapé?`);
  if (m.rodape === "sim" && (m.rodapeAltura == null || m.rodapeRecuo == null)) q.push(`${n}: qual a altura e o recuo do rodapé?`);
  if (!m.fundo) q.push(`${n}: tem fundo (chapa de 6 mm atrás)?`);
  m.modulos.forEach((mo, i) => {
    if (!mo.tipo) q.push(`${n}, módulo ${i + 1}: é de portas, de gavetas ou aberto?`);
    if (mo.tipo === "portas" && mo.portas < 1) q.push(`${n}, módulo ${i + 1}: quantas portas?`);
    if (mo.tipo === "gavetas" && mo.gavetas < 1) q.push(`${n}, módulo ${i + 1}: quantas gavetas?`);
  });
  if (m.modulos.some((mo) => mo.tipo === "gavetas") && r.alturaLateralGaveta == null) q.push("Qual a altura das laterais das gavetas (mm)?");
  return q;
}

export function errosDoMovelParam(m: MovelParam, esp: number): string[] {
  const e: string[] = [], n = m.nome || "móvel";
  if (m.L == null || m.P == null || m.A == null) return e;
  if (m.L < 200 || m.P < 100 || m.A < 200) e.push(`${n}: as medidas estão em milímetros. Confira (ex.: 1,20 m = 1200).`);
  const fixas = m.modulos.reduce((s, mo) => s + (mo.largura ?? 0), 0), livres = m.modulos.filter((mo) => mo.largura == null).length;
  const util = m.L - esp * (m.modulos.length + 1);
  if (fixas > util + 0.5 || (livres === 0 && Math.abs(fixas - util) > 1)) e.push(`${n}: a soma das larguras dos módulos (${fixas} mm) não fecha com o vão interno de ${meio(util)} mm (largura total menos as chapas verticais de ${esp} mm).`);
  if (m.rodape === "sim" && m.rodapeAltura != null && m.rodapeAltura >= m.A) e.push(`${n}: o rodapé é mais alto que o móvel.`);
  return e;
}

// Gera as peças por regra. É ESTIMATIVA: medidas nominais, sem folgas de porta e de gaveta (o marceneiro ajusta).
export function movelPorMedidas(m: MovelParam, r: RespostasMarcenaria): Movel {
  const L = m.L!, P = m.P!, A = m.A!, e = espCaixaMm(r) ?? 18, ef = PADRAO_MARC.espFrente;
  const embutida = r.portas === "Embutidas", temFrente = m.modulos.some((mo) => mo.tipo === "portas" || mo.tipo === "gavetas");
  const y0 = temFrente && !embutida ? ef : 0; // caixa começa atrás das frentes sobrepostas
  const rod = m.rodape === "sim" ? m.rodapeAltura! : 0, fundo = m.fundo === "sim" ? PADRAO_MARC.fundoCaixa : 0;
  const pecas: Peca[] = [];
  const add = (papel: Papel, nome: string, x0: number, x1: number, ya: number, yb: number, z0: number, z1: number) => {
    const d = [x1 - x0, yb - ya, z1 - z0], s = [...d].sort((a, b) => b - a).map(meio);
    const fino: Peca["fino"] = d[0] <= d[1] && d[0] <= d[2] ? "X" : d[1] <= d[2] ? "Y" : "Z";
    pecas.push({ nome, papel, deduzido: false, material: "", cor: ehFrente(papel) ? COR_FRENTE : COR_CAIXA, C: s[0], L: s[1], E: s[2], x0, x1, y0: ya, y1: yb, z0, z1, fino, chave: chaveDe(m.nome, nome, s[0], s[1], s[2]), attrs: {} });
  };
  add("lateral", "Lateral", 0, e, y0, P, rod, A); add("lateral", "Lateral", L - e, L, y0, P, rod, A);
  add("base", "Base", e, L - e, y0, P, rod, rod + e); add("topo", "Topo", e, L - e, y0, P, A - e, A);
  if (rod) add("rodape", "Rodapé", e, L - e, y0 + (m.rodapeRecuo ?? 0), y0 + (m.rodapeRecuo ?? 0) + e, 0, rod);
  const pf = P - (fundo ? 10 + fundo : 0); // fundo encaixado em rasgo, recuado 10 mm da traseira
  const rg = PADRAO_MARC.rasgoProf, fz0 = rod + e - rg, fz1 = A - e + rg, cabeChapa = (a: number, b: number) => Math.max(a, b) <= PADRAO_MARC.chapaC - 2 * PADRAO_MARC.refilo && Math.min(a, b) <= PADRAO_MARC.chapaL - 2 * PADRAO_MARC.refilo;
  const fundoInteiro = !!fundo && cabeChapa(L - 2 * e + 2 * rg, fz1 - fz0); // maior que a chapa: um fundo por módulo
  if (fundoInteiro) add("fundo", "Fundo", e - rg, L - e + rg, pf, pf + fundo, fz0, fz1);
  const util = L - e * (m.modulos.length + 1), fixas = m.modulos.reduce((s, mo) => s + (mo.largura ?? 0), 0), livres = m.modulos.filter((mo) => mo.largura == null).length;
  let x = e; const zi = rod + e, zs = A - e;
  m.modulos.forEach((mo, i) => {
    const w = mo.largura ?? (util - fixas) / Math.max(1, livres), xa = x, xb = x + w;
    if (i < m.modulos.length - 1) add("divisoria", "Divisória", xb, xb + e, y0, pf, zi, zs);
    if (fundo && !fundoInteiro) add("fundo", "Fundo", xa - rg, xb + rg, pf, pf + fundo, fz0, fz1);
    // frentes: sobrepostas cobrem metade da chapa vizinha (a chapa inteira nas pontas); embutidas ficam dentro do vão
    const fa = embutida ? xa : i === 0 ? 0 : xa - e / 2, fb = embutida ? xb : i === m.modulos.length - 1 ? L : xb + e / 2;
    const gz0 = embutida ? zi : rod, gz1 = embutida ? zs : A, fy = 0;
    if (mo.tipo === "portas") {
      const lw = (fb - fa) / mo.portas;
      for (let k = 0; k < mo.portas; k++) add("porta", "Porta", fa + k * lw, fa + (k + 1) * lw, fy, fy + ef, gz0, gz1);
    }
    if (mo.tipo === "gavetas") {
      const h = (gz1 - gz0) / mo.gavetas, corr = corredicaPara(pf - y0) ?? Math.max(100, pf - y0 - PADRAO_MARC.corredicaRecuo), hl = Math.min(r.alturaLateralGaveta ?? 100, h - 20);
      const ga = xa + PADRAO_MARC.corredicaFolga, gb = xb - PADRAO_MARC.corredicaFolga, gy = embutida ? ef : y0;
      for (let k = 0; k < mo.gavetas; k++) {
        const z = gz0 + k * h, zc = Math.max(z, zi) + 15;
        add("frente_gaveta", "Frente de gaveta", fa, fb, fy, fy + ef, z, z + h);
        add("lateral_gaveta", "Lateral de gaveta", ga, ga + e, gy, gy + corr, zc, zc + hl); add("lateral_gaveta", "Lateral de gaveta", gb - e, gb, gy, gy + corr, zc, zc + hl);
        add("traseira_gaveta", "Traseira de gaveta", ga + e, gb - e, gy + corr - e, gy + corr, zc, zc + hl); add("traseira_gaveta", "Contrafrente de gaveta", ga + e, gb - e, gy, gy + e, zc, zc + hl);
        add("fundo_gaveta", "Fundo de gaveta", ga + e - PADRAO_MARC.rasgoProf, gb - e + PADRAO_MARC.rasgoProf, gy + e - PADRAO_MARC.rasgoProf, gy + corr - e + PADRAO_MARC.rasgoProf, zc + PADRAO_MARC.rasgoGavetaAltura, zc + PADRAO_MARC.rasgoGavetaAltura + PADRAO_MARC.fundoGaveta);
      }
    } else for (let k = 1; k <= mo.prateleiras; k++) { const z = zi + ((zs - zi) * k) / (mo.prateleiras + 1); add("prateleira", "Prateleira", xa, xb, y0 + (embutida ? ef : 0), pf, z - e / 2, z + e / 2); }
    x = xb + e;
  });
  return { nome: m.nome, L, P, A, pecas, explicitas: [], estimativa: true, avisos: [`${m.nome}: peças geradas por regra a partir das medidas (ESTIMATIVA). Medidas nominais, sem folgas de porta e de gaveta: o marceneiro ajusta.`] };
}

// ---------- perguntas obrigatórias ----------
export interface RespostasMarcenaria {
  cliente: string; local: string; data: string; revisao: number;
  espCaixa: string; acabamentoCaixa: string; acabamentoFrentes: string; veio: "" | "sim" | "nao";
  portas: string; puxador: string; corredica: string; dobradica: string; alturaLateralGaveta: number | null; conferido: boolean;
}
export const ESPESSURAS = ["15 mm", "18 mm"], TIPOS_PORTA = ["Sobrepostas", "Embutidas"], PUXADORES = ["Cava (sem puxador)", "Puxador barra", "Perfil de alumínio", "Fecho toque (sem puxador)"];
export const CORREDICAS = ["Telescópica", "Oculta com amortecimento"], DOBRADICAS = ["Com amortecimento", "Sem amortecimento"];
export const respostasMarcenariaIniciais = (b: Partial<RespostasMarcenaria> = {}): RespostasMarcenaria => ({ cliente: "", local: "", data: new Date().toISOString().slice(0, 10), revisao: 0, espCaixa: "", acabamentoCaixa: "", acabamentoFrentes: "", veio: "", portas: "", puxador: "", corredica: "", dobradica: "", alturaLateralGaveta: null, conferido: false, ...b });
export const espCaixaMm = (r: RespostasMarcenaria) => { const n = parseFloat(r.espCaixa); return Number.isFinite(n) ? n : null; };

export function perguntasMarcenaria(r: RespostasMarcenaria, moveis: Movel[], params: MovelParam[] = []): string[] {
  const papeis = new Set(moveis.flatMap((m) => m.pecas.map((p) => p.papel)));
  const temPorta = papeis.has("porta") || params.some((m) => m.modulos.some((mo) => mo.tipo === "portas")), temGaveta = papeis.has("frente_gaveta") || params.some((m) => m.modulos.some((mo) => mo.tipo === "gavetas"));
  const q: string[] = [];
  if (!r.espCaixa) q.push("Qual a espessura do MDF da caixa?");
  if (!r.acabamentoCaixa.trim()) q.push("Qual o acabamento (cor) do MDF da caixa?");
  if ((temPorta || temGaveta) && !r.acabamentoFrentes.trim()) q.push("Qual o acabamento (cor) das portas e frentes?");
  if (!r.veio) q.push("O acabamento tem desenho de madeira (veio)?");
  if ((temPorta || temGaveta) && !r.portas) q.push("As portas e frentes são sobrepostas ou embutidas?");
  if ((temPorta || temGaveta) && !r.puxador.trim()) q.push("Qual o puxador?");
  if (temGaveta && !r.corredica.trim()) q.push("Qual a corrediça das gavetas?");
  if (temPorta && !r.dobradica.trim()) q.push("Qual a dobradiça?");
  for (const m of params) q.push(...perguntasDoMovelParam(m, r));
  return [...new Set(q)];
}

// ---------- lista de peças, fita de borda e ferragens ----------
export interface ItemLista { item: number; movel: string; nome: string; papel: Papel; deduzido: boolean; qtd: number; C: number; L: number; E: number; material: string; fita: string; fitaM: number; chave: string }
export const materialDe = (p: Peca, r: RespostasMarcenaria) => p.material || (ehFrente(p.papel) ? r.acabamentoFrentes : r.acabamentoCaixa) || "a definir";

function fitaDe(p: Peca): { texto: string; mm: number } {
  if (ehFrente(p.papel)) return { texto: "4 lados", mm: 2 * (p.C + p.L) };
  if (["prateleira", "base", "topo"].includes(p.papel)) return { texto: "1 lado (frente)", mm: p.x1 - p.x0 };
  if (["lateral", "divisoria"].includes(p.papel)) return { texto: "1 lado (frente)", mm: p.z1 - p.z0 };
  return { texto: "sem fita", mm: 0 };
}

export function listaDePecas(moveis: Movel[], r: RespostasMarcenaria): ItemLista[] {
  const itens: ItemLista[] = [];
  for (const m of moveis) {
    const mapa = new Map<string, ItemLista>();
    const ordem = (p: Peca) => PAPEIS.indexOf(p.papel);
    for (const p of [...m.pecas].sort((a, b) => ordem(a) - ordem(b) || b.C - a.C)) {
      const nome = p.deduzido ? NOME_PAPEL[p.papel] : nomeBase(p.nome), mat = materialDe(p, r), k = `${nome}|${p.papel}|${p.C}|${p.L}|${p.E}|${mat}`, f = fitaDe(p);
      const it = mapa.get(k);
      if (it) { it.qtd++; it.fitaM += f.mm / 1000; } else mapa.set(k, { item: 0, movel: m.nome, nome, papel: p.papel, deduzido: p.deduzido, qtd: 1, C: p.C, L: p.L, E: p.E, material: mat, fita: f.texto, fitaM: f.mm / 1000, chave: p.chave });
    }
    itens.push(...mapa.values());
  }
  itens.forEach((it, i) => (it.item = i + 1));
  return itens;
}
export const itemDaPeca = (itens: ItemLista[], movel: string, p: Peca, r: RespostasMarcenaria) => itens.find((it) => it.movel === movel && it.papel === p.papel && it.C === p.C && it.L === p.L && it.E === p.E && it.material === materialDe(p, r) && it.nome === (p.deduzido ? NOME_PAPEL[p.papel] : nomeBase(p.nome)))?.item ?? 0;

export interface Ferragem { movel: string; nome: string; qtd: number; origem: "modelo" | "regra" }
export function ferragens(moveis: Movel[], r: RespostasMarcenaria): Ferragem[] {
  const f: Ferragem[] = [];
  for (const m of moveis) {
    for (const x of m.explicitas) f.push({ movel: m.nome, nome: x.nome, qtd: x.qtd, origem: "modelo" });
    const tem = (re: RegExp) => m.explicitas.some((x) => re.test(semAcento(x.nome)));
    const portas = m.pecas.filter((p) => p.papel === "porta"), gavetas = m.pecas.filter((p) => p.papel === "frente_gaveta");
    if (portas.length && !tem(/dobradi/)) f.push({ movel: m.nome, nome: `Dobradiça caneco ${PADRAO_MARC.caneco} mm${r.dobradica ? ", " + r.dobradica.toLowerCase() : ""}`, qtd: portas.reduce((s, p) => s + dobradicasPorAltura(p.z1 - p.z0), 0), origem: "regra" });
    if (gavetas.length && !tem(/corredi/)) { const c = corredicaPara(m.P); f.push({ movel: m.nome, nome: `Par de corrediças${r.corredica ? " " + r.corredica.toLowerCase() : ""}${c ? ` ${c} mm` : " (comprimento a definir: o móvel é raso)"}`, qtd: gavetas.length, origem: "regra" }); }
    if (portas.length + gavetas.length && !tem(/puxador/) && r.puxador && !/cava|toque/i.test(r.puxador)) f.push({ movel: m.nome, nome: r.puxador, qtd: portas.length + gavetas.length, origem: "regra" });
  }
  return f;
}

// ---------- plano de corte (sugestão) ----------
export interface PecaCortada { item: number; x: number; y: number; c: number; l: number; girada: boolean }
export interface Chapa { material: string; esp: number; pecas: PecaCortada[]; aproveitamento: number }
export function planoDeCorte(itens: ItemLista[], veio: boolean): { chapas: Chapa[]; fora: string[] } {
  const W = PADRAO_MARC.chapaC - 2 * PADRAO_MARC.refilo, H = PADRAO_MARC.chapaL - 2 * PADRAO_MARC.refilo, k = PADRAO_MARC.serra;
  const grupos = new Map<string, { item: number; c: number; l: number }[]>(), fora: string[] = [];
  for (const it of itens) {
    if (it.papel === "ferragem" || it.E > 60) continue;
    const cabe = (it.C <= W && it.L <= H) || (!veio && it.C <= H && it.L <= W);
    if (!cabe) { fora.push(`Item ${it.item} (${it.nome}, ${it.C} x ${it.L} mm) é maior que a chapa de ${PADRAO_MARC.chapaC} x ${PADRAO_MARC.chapaL} mm: precisa ser dividido em duas peças com emenda.`); continue; }
    const g = `${it.material}|${it.E}`; const lista = grupos.get(g) ?? []; grupos.set(g, lista);
    for (let i = 0; i < it.qtd; i++) lista.push({ item: it.item, c: it.C, l: it.L });
  }
  const chapas: Chapa[] = [];
  for (const [g, lista] of grupos) {
    const [material, esp] = [g.slice(0, g.lastIndexOf("|")), Number(g.slice(g.lastIndexOf("|") + 1))];
    type Faixa = { y: number; alt: number; x: number };
    const abertas: { faixas: Faixa[]; ch: Chapa }[] = [];
    for (const p of lista.sort((a, b) => b.l - a.l || b.c - a.c)) {
      const giros = veio || p.c > H || p.l > W ? [false] : [false, true];
      let posto = false;
      const tentar = (o: { faixas: Faixa[]; ch: Chapa }) => {
        for (const girada of giros) { const c = girada ? p.l : p.c, l = girada ? p.c : p.l; if (c > W) continue;
          for (const f of o.faixas) if (l <= f.alt && f.x + c <= W) { o.ch.pecas.push({ item: p.item, x: f.x, y: f.y, c, l, girada }); f.x += c + k; return true; } }
        const c = p.c > W ? p.l : p.c, l = p.c > W ? p.c : p.l, y = o.faixas.reduce((s, f) => Math.max(s, f.y + f.alt + k), 0);
        if (y + l <= H && c <= W) { o.faixas.push({ y, alt: l, x: c + k }); o.ch.pecas.push({ item: p.item, x: 0, y, c, l, girada: p.c > W }); return true; }
        return false;
      };
      for (const o of abertas) if (tentar(o)) { posto = true; break; }
      if (!posto) { const o = { faixas: [] as Faixa[], ch: { material, esp, pecas: [], aproveitamento: 0 } as Chapa }; abertas.push(o); tentar(o); }
    }
    for (const o of abertas) { o.ch.aproveitamento = o.ch.pecas.reduce((s, p) => s + p.c * p.l, 0) / (PADRAO_MARC.chapaC * PADRAO_MARC.chapaL); chapas.push(o.ch); }
  }
  return { chapas, fora };
}

// Avisos gerais (não bloqueiam): espessura respondida diferente da modelada etc.
export function avisosMarcenaria(moveis: Movel[], r: RespostasMarcenaria): string[] {
  const a: string[] = moveis.flatMap((m) => m.avisos.map((x) => (x.startsWith(m.nome) ? x : `${m.nome}: ${x}`)));
  const e = espCaixaMm(r);
  for (const m of moveis.filter((x) => !x.estimativa)) {
    const esp = [...new Set(m.pecas.filter((p) => ["lateral", "base", "topo", "divisoria", "prateleira"].includes(p.papel)).map((p) => p.E))];
    if (e && esp.length && !esp.includes(e)) a.push(`${m.nome}: você respondeu MDF de ${e} mm para a caixa, mas no modelo as chapas têm ${esp.join(" e ")} mm. A lista usa a medida do modelo.`);
  }
  return a;
}
