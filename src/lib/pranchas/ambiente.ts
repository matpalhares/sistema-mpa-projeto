// Modelo de um ambiente de área molhada (banheiro, lavabo): é dele que saem o executivo A3 e as pranchas de marmoraria.
// O modelo vem da leitura da planta (IA) e é conferido pelo usuário; as peças e acabamentos vêm das perguntas obrigatórias.
// Coordenadas em metros. Origem no canto interno noroeste; x cresce para leste (direita da planta), y para sul (baixo).
// Posições "ao longo da parede": nas paredes N e S medem-se a partir da parede oeste; nas paredes L e O, a partir da parede norte.
import { PADRAO, bancadaInicial, type DadosBancada } from "./regras-bancada";

export type Parede = "N" | "S" | "L" | "O";
export const NOME_PAREDE: Record<Parede, string> = { N: "NORTE", S: "SUL", L: "LESTE", O: "OESTE" };

export interface Porta { parede: Parede; inicio: number; largura: number; altura: number; abre: "dentro" | "fora"; dobradica: "inicio" | "fim" }
export interface Box { parede: Parede; profundidade: number } // faixa de ponta a ponta junto a essa parede
export interface Chuveiro { parede: Parede; pos: number; registros: 1 | 2 }
export interface Vaso { parede: Parede; eixo: number }
export interface BancadaAmb { parede: Parede; inicio: number; comprimento: number; profundidade: number; cubas: number[] } // cubas: eixo a partir do início da bancada

// Recorte da planta enviada, para o usuário marcar as peças em cima. x0/y0: pixel do canto interno noroeste do ambiente.
export interface RecortePlanta { imagem: string; largura: number; altura: number; x0: number; y0: number; pxPorM: number }

export interface Ambiente {
  recorte?: RecortePlanta | null;
  incluir?: boolean; // false = o usuário não quer detalhar este ambiente (vazio = detalhar)
  nome: string;
  largura: number; // x (leste-oeste)
  comprimento: number; // y (norte-sul)
  espessuraParede: number; // só para o desenho
  porta: Porta | null;
  box: Box | null;
  chuveiro: Chuveiro | null;
  ralo: { x: number; y: number } | null;
  vasos: Vaso[];
  bancadas: BancadaAmb[];
  acessivel: "sim" | "nao" | ""; // pergunta obrigatória quando há vaso: barras de apoio (PNE)
  observacoesLeitura: string;
}

// Perguntas obrigatórias: o sistema pergunta sempre, nunca assume.
export interface RespostasAmbiente {
  pedra: string;
  cubaTipo: string;
  cubaLargura: number | null;
  cubaProfundidade: number | null;
  torneira: string;
  vasoTipo: string;
  espelho: "sim" | "nao" | "";
  chuveiroTipo: string;
  boxTipo: string;
  revestimentosDefinidos: "sim" | "nao" | "";
  revestimentoPiso: string; revestimentoParede: string; corPorta: string; pintura: string;
  grapas: "A" | "B" | "auto" | "";
  cliente: string; local: string; data: string; revisao: number; origemPlanta: string;
  modeloConferido: boolean;
}

export const TIPOS_VASO = ["Caixa acoplada", "Válvula de descarga na parede", "Suspenso com caixa embutida"];
export const TIPOS_CHUVEIRO = ["Ducha com braço saindo da parede", "Ducha de teto", "Chuveiro elétrico"];
export const TIPOS_BOX = ["Vidro temperado, porta de abrir", "Vidro temperado, de correr", "Vidro fixo (sem porta)", "Sem box"];

// Alturas padrão do escritório (skill detalhamento-areas-molhadas), a partir do piso acabado.
export const ALTURA = { peDireito: 3.0, chuveiro: 2.1, registro: 1.1, valvulaDescarga: 1.0, espelhoDe: 1.15, espelhoAte: 2.1, box: 2.0, porta: 2.1, lavatorioAF: 0.6, lavatorioES: 0.5, vasoAF: 0.25, vasoAFAfastamento: 0.25, vasoEsgotoEixo: 0.3, cortePerspectiva: 2.6 };

// Barras de apoio da bacia sanitária: ABNT NBR 9050:2020, itens 7.6 e 7.7.2.2 (texto da norma fornecido pelo escritório).
// Só o comprimento da bacia não vem da norma: depende do modelo escolhido.
export interface ParametroNBR { chave: string; rotulo: string; valor: number; item: string }
export const NBR9050_PADRAO: ParametroNBR[] = [
  { chave: "altura", rotulo: "Altura do eixo das barras horizontais", valor: 0.75, item: "7.7.2.2.1 e 7.7.2.2.2" },
  { chave: "alturaFundoCaixa", rotulo: "Altura máxima da barra do fundo quando a caixa acoplada não deixa instalar a 0,75 m", valor: 0.89, item: "7.7.2.2.3" },
  { chave: "comprimento", rotulo: "Comprimento mínimo das barras horizontais", valor: 0.8, item: "7.7.2.2.1 e 7.7.2.2.2" },
  { chave: "alemDaBacia", rotulo: "Barra lateral: distância além da borda frontal da bacia", valor: 0.5, item: "7.7.2.2.1" },
  { chave: "eixoLateral", rotulo: "Distância do eixo da bacia até a face da barra lateral", valor: 0.4, item: "7.7.2.2.1" },
  { chave: "fundoAlemEixo", rotulo: "Barra do fundo: quanto passa do eixo da bacia, para o lado da parede lateral", valor: 0.3, item: "7.7.2.2.2" },
  { chave: "verticalComprimento", rotulo: "Comprimento mínimo da barra vertical", valor: 0.7, item: "7.7.2.2.1" },
  { chave: "verticalAcima", rotulo: "Barra vertical: distância acima da barra horizontal", valor: 0.1, item: "7.7.2.2.1" },
  { chave: "verticalAlemDaBacia", rotulo: "Barra vertical: distância da borda frontal da bacia", valor: 0.3, item: "7.7.2.2.1" },
  { chave: "comprimentoBacia", rotulo: "Comprimento da bacia, da parede até a borda frontal", valor: 0.65, item: "não é da norma: conferir no modelo da bacia" },
];
export type NBR = Record<string, number>;
export const nbr = (lista: ParametroNBR[] = NBR9050_PADRAO): NBR => Object.fromEntries(lista.map((p) => [p.chave, p.valor]));

// z1 = altura do eixo (horizontais) ou da base (vertical); z2 = topo da barra vertical
export interface Barra { parede: Parede; de: number; ate: number; tipo: "lateral" | "fundo" | "vertical"; z1: number; z2: number }

// Topo do tampo: padrão do escritório 0,85 m. Em sanitário acessível segue a ABNT NBR 9050:2020, 7.5 e (0,78 a 0,80 m): usa 0,80 m.
export const alturaTampoDe = (a: Ambiente) => (a.acessivel === "sim" ? 0.8 : PADRAO.alturaTampo);

// Saia: padrão 20 cm. Em sanitário acessível a norma pede 0,73 m livres sob o lavatório (7.10.3): com o tampo a 0,80 m, a saia fica com 7 cm.
export const saiaDe = (a: Ambiente) => (a.acessivel === "sim" ? 0.07 : PADRAO.saia);

export const comprimentoParede = (a: Ambiente, p: Parede) => (p === "N" || p === "S" ? a.largura : a.comprimento);
const perpendiculares = (p: Parede): [Parede, Parede] => (p === "N" || p === "S" ? ["O", "L"] : ["N", "S"]);
// distância de um ponto encostado na parede p (a "dist" da parede) medida ao longo de uma parede perpendicular
const aoLongo = (a: Ambiente, p: Parede, dist: number) => (p === "N" || p === "O" ? dist : comprimentoParede(a, p === "S" ? "L" : "N") - dist);

export function barrasDoAmbiente(a: Ambiente, n: NBR, caixaAcoplada: boolean): { barras: Barra[]; avisos: string[] } {
  const barras: Barra[] = [], avisos: string[] = [];
  const m = (v: number) => v.toFixed(2).replace(".", ",");
  for (const v of a.vasos) {
    const L = comprimentoParede(a, v.parede);
    const [ini, fim] = perpendiculares(v.parede);
    const perto = v.eixo <= L - v.eixo ? ini : fim;
    const dist = Math.min(v.eixo, L - v.eixo);
    const sinal = perto === ini ? -1 : 1;
    // fundo (7.7.2.2.2): 0,80 m mín., passando 0,30 m do eixo para o lado da parede lateral. Com caixa acoplada (7.7.2.2.3): até 0,89 m.
    const f1 = v.eixo + sinal * n.fundoAlemEixo, f2 = f1 - sinal * n.comprimento, zf = caixaAcoplada ? n.alturaFundoCaixa : n.altura;
    barras.push({ parede: v.parede, de: Math.max(0, Math.min(f1, f2)), ate: Math.min(L, Math.max(f1, f2)), tipo: "fundo", z1: zf, z2: zf });
    // lateral (7.7.2.2.1): 0,80 m mín., terminando 0,50 m além da borda frontal da bacia
    const fimBarra = n.comprimentoBacia + n.alemDaBacia, iniBarra = fimBarra - n.comprimento;
    const p1 = aoLongo(a, v.parede, iniBarra), p2 = aoLongo(a, v.parede, fimBarra);
    barras.push({ parede: perto, de: Math.max(0, Math.min(p1, p2)), ate: Math.max(p1, p2), tipo: "lateral", z1: n.altura, z2: n.altura });
    // vertical (7.7.2.2.1): 0,70 m mín., 0,10 m acima da horizontal, a 0,30 m da borda frontal da bacia
    const pv = aoLongo(a, v.parede, n.comprimentoBacia + n.verticalAlemDaBacia);
    barras.push({ parede: perto, de: pv, ate: pv, tipo: "vertical", z1: n.altura + n.verticalAcima, z2: n.altura + n.verticalAcima + n.verticalComprimento });
    // 0,40 m do eixo até a face da barra + barra (30 a 45 mm) e afastamento (40 mm mín., 110 mm máx. até a face externa): parede entre ~0,47 e 0,51 m do eixo
    if (dist < n.eixoLateral + 0.07 - 0.005 || dist > n.eixoLateral + 0.11 + 0.005) avisos.push(`${a.nome}: o eixo do vaso está a ${m(dist)} m da parede lateral. Para a barra lateral ficar a ${m(n.eixoLateral)} m do eixo (NBR 9050, 7.7.2.2.1), a parede deve ficar entre ${m(n.eixoLateral + 0.07)} e ${m(n.eixoLateral + 0.11)} m do eixo. Ajuste a posição do vaso ou use barra lateral fixa ou articulada (7.7.2.2.4).`);
    if (pv > comprimentoParede(a, perto) || pv < 0) avisos.push(`${a.nome}: a parede lateral é curta para a barra vertical a ${m(n.verticalAlemDaBacia)} m da borda frontal da bacia (NBR 9050, 7.7.2.2.1).`);
    if (caixaAcoplada) avisos.push(`${a.nome}: com caixa acoplada, a barra do fundo foi posta a ${m(n.alturaFundoCaixa)} m (NBR 9050, 7.7.2.2.3). Conferir se fica a pelo menos 0,04 m acima da tampa da caixa do modelo escolhido.`);
  }
  if (a.porta && a.porta.abre === "dentro") avisos.push(`${a.nome}: a porta abre para dentro. A NBR 9050 (item 7.5, alínea f) pede que a porta de eixo vertical do sanitário acessível abra para o lado externo, com puxador horizontal interno de no mínimo 0,40 m.`);
  if (a.bancadas.length) avisos.push(`${a.nome}: por ser acessível, a bancada segue a NBR 9050 no lugar do padrão do escritório: tampo a 0,80 m (em vez de ${m(PADRAO.alturaTampo)} m) e saia de 7 cm (em vez de 20 cm), para deixar 0,73 m livres embaixo (itens 7.5 e 7.10.3). Sifão e ligações devem ficar protegidos ou recuados.`);
  avisos.push(`${a.nome}: conferir na NBR 9050 (itens 7.5 e 7.7.1) a área de giro e a área de transferência; o sistema ainda não verifica essas áreas.`);
  return { barras, avisos };
}

// Lateral da bancada encosta em parede? Sai da geometria, sem perguntar.
export function lateraisDaBancada(a: Ambiente, b: BancadaAmb): { inicio: "parede" | "aberta"; fim: "parede" | "aberta" } {
  const L = comprimentoParede(a, b.parede);
  return { inicio: b.inicio < 0.03 ? "parede" : "aberta", fim: b.inicio + b.comprimento > L - 0.03 ? "parede" : "aberta" };
}
// Quem olha a bancada de frente: nas paredes N e L a ponta "início" fica à esquerda; nas paredes S e O, à direita.
const inverte = (p: Parede) => p === "S" || p === "O";

export function bancadaDoAmbiente(a: Ambiente, i: number, r: RespostasAmbiente): DadosBancada {
  const b = a.bancadas[i], lat = lateraisDaBancada(a, b), inv = inverte(b.parede);
  const eixo = b.cubas.length ? (inv ? b.comprimento - b.cubas[0] : b.cubas[0]) : null;
  const semCuba = b.cubas.length === 0;
  return bancadaInicial({
    nomePrancha: a.bancadas.length > 1 ? `${a.nome} - B${i + 1}` : a.nome, ambiente: a.nome,
    comprimento: b.comprimento, profundidade: b.profundidade,
    lateralEsquerda: inv ? lat.fim : lat.inicio, lateralDireita: inv ? lat.inicio : lat.fim,
    pedra: r.pedra, cubaTipo: semCuba ? "Sem cuba" : r.cubaTipo, cubaLargura: semCuba ? null : r.cubaLargura, cubaProfundidade: semCuba ? null : r.cubaProfundidade,
    cubaCentralizada: eixo == null ? null : Math.abs(eixo - b.comprimento / 2) < 0.005, cubaEixo: eixo,
    torneira: semCuba ? "Sem torneira" : r.torneira, revestimentosDefinidos: r.revestimentosDefinidos, revestimentoPiso: r.revestimentoPiso, revestimentoParede: r.revestimentoParede, corPorta: r.corPorta, pintura: r.pintura,
    grapas: r.grapas === "A" || r.grapas === "B" ? r.grapas : b.comprimento <= 1 ? "A" : "B",
    cliente: r.cliente, local: r.local, data: r.data, revisao: r.revisao, medidasConfirmadas: r.modeloConferido, alturaTampo: alturaTampoDe(a), saia: a.acessivel === "sim" ? saiaDe(a) : undefined,
  });
}

export function respostasIniciais(base: Partial<RespostasAmbiente> = {}): RespostasAmbiente {
  return {
    pedra: "", cubaTipo: "", cubaLargura: null, cubaProfundidade: null, torneira: "", vasoTipo: "", espelho: "", chuveiroTipo: "", boxTipo: "",
    revestimentosDefinidos: "", revestimentoPiso: "", revestimentoParede: "", corPorta: "", pintura: "", grapas: "auto",
    cliente: "", local: "", data: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), revisao: 0, origemPlanta: "", modeloConferido: false, ...base,
  };
}

export const ativos = (l: Ambiente[]) => l.filter((a) => a.incluir !== false);

export function perguntasDoAmbiente(a: Ambiente, r: RespostasAmbiente): string[] {
  const p: string[] = [];
  const temBancada = a.bancadas.length > 0, temCubas = a.bancadas.some((b) => b.cubas.length > 0);
  if (temBancada && !r.pedra.trim()) p.push("Qual pedra será usada nas bancadas?");
  if (temCubas && !r.cubaTipo) p.push("Qual o tipo de cuba?");
  if (temCubas && r.cubaTipo && (r.cubaLargura == null || r.cubaProfundidade == null)) p.push("Quais as medidas da cuba (largura e profundidade)?");
  if (temCubas && !r.torneira) p.push("Qual o tipo de torneira?");
  if (a.vasos.length && !r.vasoTipo) p.push("Qual o tipo de vaso sanitário?");
  if (a.vasos.length && !a.acessivel) p.push(`${a.nome}: terá barras de acessibilidade (PNE)?`);
  if (temBancada && !r.espelho) p.push("Haverá espelho sobre a bancada?");
  if (a.chuveiro && !r.chuveiroTipo) p.push("Qual o tipo de chuveiro?");
  if (a.box && !r.boxTipo) p.push("Como será o box?");
  if (!r.revestimentosDefinidos) p.push("Já há definição de revestimentos, cor da porta e pintura?");
  return p;
}

export function errosDoAmbiente(a: Ambiente, r: RespostasAmbiente): string[] {
  const e: string[] = [];
  if (!(a.largura > 0.6 && a.largura < 15 && a.comprimento > 0.6 && a.comprimento < 15)) e.push(`${a.nome}: medidas do ambiente fora do esperado. Confira a leitura da planta.`);
  for (const b of a.bancadas) {
    if (b.inicio < -0.001 || b.inicio + b.comprimento > comprimentoParede(a, b.parede) + 0.02) e.push(`${a.nome}: a bancada passa do tamanho da parede. Confira a leitura.`);
    for (const c of b.cubas) if (r.cubaLargura != null && (c - r.cubaLargura / 2 < 0 || c + r.cubaLargura / 2 > b.comprimento)) e.push(`${a.nome}: a cuba não cabe na posição lida. Confira a largura da cuba e a planta.`);
    if (r.cubaProfundidade != null && b.cubas.length && r.cubaProfundidade > b.profundidade - PADRAO.frontaoEsp) e.push(`${a.nome}: a cuba é mais funda que a bancada.`);
  }
  for (const v of a.vasos) if (v.eixo < 0.2 || v.eixo > comprimentoParede(a, v.parede) - 0.2) e.push(`${a.nome}: o eixo do vaso está a menos de 20 cm de uma parede. Confira a leitura.`);
  if (a.porta && a.porta.inicio + a.porta.largura > comprimentoParede(a, a.porta.parede) + 0.02) e.push(`${a.nome}: a porta passa do tamanho da parede. Confira a leitura.`);
  if (!r.modeloConferido) e.push("Confirme que o desenho lido confere com a planta (a leitura automática é aproximada).");
  return e;
}

// Ambientes do executivo de referência do escritório (Escola Recriarte), usados nos testes.
export const EXEMPLOS: Record<string, Ambiente> = {
  bwc1: { nome: "BWC 1", largura: 2.79, comprimento: 1.5, espessuraParede: 0.15, observacoesLeitura: "", acessivel: "nao",
    porta: { parede: "L", inicio: 0.59, largura: 0.8, altura: 2.1, abre: "dentro", dobradica: "fim" },
    box: { parede: "O", profundidade: 0.86 }, chuveiro: { parede: "N", pos: 0.45, registros: 2 }, ralo: { x: 0.1, y: 0.1 },
    vasos: [{ parede: "N", eixo: 1.33 }], bancadas: [{ parede: "N", inicio: 1.84, comprimento: 0.95, profundidade: 0.5, cubas: [0.47] }] },
  bwc2pne: { nome: "BWC 2 (PNE)", largura: 1.49, comprimento: 1.98, espessuraParede: 0.15, observacoesLeitura: "", acessivel: "sim",
    porta: { parede: "O", inicio: 0.08, largura: 0.8, altura: 2.1, abre: "fora", dobradica: "fim" },
    box: null, chuveiro: null, ralo: null,
    vasos: [{ parede: "S", eixo: 0.98 }], bancadas: [{ parede: "L", inicio: 0, comprimento: 0.6, profundidade: 0.5, cubas: [0.3] }] },
  lavabo: { nome: "Lavabo", largura: 1.2, comprimento: 1.6, espessuraParede: 0.15, observacoesLeitura: "", acessivel: "nao",
    porta: { parede: "S", inicio: 0.2, largura: 0.7, altura: 2.1, abre: "dentro", dobradica: "inicio" },
    box: null, chuveiro: null, ralo: null, vasos: [{ parede: "N", eixo: 0.4 }], bancadas: [{ parede: "L", inicio: 0.7, comprimento: 0.9, profundidade: 0.4, cubas: [0.45] }] },
  suite: { nome: "BWC Suíte", largura: 1.6, comprimento: 3.0, espessuraParede: 0.15, observacoesLeitura: "", acessivel: "nao",
    porta: { parede: "N", inicio: 0.1, largura: 0.7, altura: 2.1, abre: "dentro", dobradica: "inicio" },
    box: { parede: "S", profundidade: 0.95 }, chuveiro: { parede: "L", pos: 2.5, registros: 1 }, ralo: { x: 0.8, y: 2.55 },
    vasos: [{ parede: "L", eixo: 1.65 }], bancadas: [{ parede: "O", inicio: 0.6, comprimento: 1.2, profundidade: 0.5, cubas: [0.6] }] },
};
