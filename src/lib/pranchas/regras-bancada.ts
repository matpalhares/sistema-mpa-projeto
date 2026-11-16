// Marmoraria (módulo P05, padrão A): dados, perguntas obrigatórias e padrões fixos do escritório.
// Regras puras (usadas na tela e no servidor). Medidas em metros.

// Padrões fixos da skill detalhamento-areas-molhadas / Projeto_Especificacao.json:
export const PADRAO = {
  tampo: 0.02, // tampo 2 cm
  frontaoEsp: 0.02, frontaoAlt: 0.1, // frontão 2 cm x 10 cm
  saia: 0.2, // saia 20 cm
  alturaTampo: 0.85, // topo do tampo a 0,85 m do piso (saia fecha em 0,65 m)
  faixaEscoamento: 0.01, // cuba esculpida: faixa de escoamento 1 cm
  grapaEmbutida: 0.08, // barra embutida ~8 cm na parede
  grapaFolgaSaia: 0.035, // barra a 3 a 4 cm da saia
  grapaFolgaRecorte: 0.05, // afastamento mínimo de 5 cm de recortes e ligações
};

export const PEDRAS = ["Granito Bege Bahia", "Granito Itaúnas", "Granito Preto São Gabriel", "Granito Verde Ubatuba", "Granito Branco Siena", "Mármore Branco", "Quartzo branco", "Quartzo cinza"];
export const TIPOS_CUBA = ["Esculpida", "Embutir", "Sobrepor", "Semiencaixe", "Sem cuba"] as const;
export const TIPOS_TORNEIRA = ["Mesa, bica baixa", "Mesa, bica alta", "Mesa, monocomando", "Parede", "Sem torneira"];
export const AMBIENTES = ["BWC", "Lavabo", "Cozinha", "Copa", "Área de serviço", "Área gourmet"];

export type Lateral = "parede" | "aberta" | "";
export type OpcaoGrapa = "A" | "B" | "";

export interface DadosBancada {
  nomePrancha: string;
  ambiente: string;
  comprimento: number | null;
  profundidade: number | null;
  lateralEsquerda: Lateral;
  lateralDireita: Lateral;
  pedra: string;
  cubaTipo: string;
  cubaLargura: number | null; // ao longo da bancada
  cubaProfundidade: number | null; // da frente para o fundo
  cubaEixo: number | null; // distância do eixo da cuba até a ponta esquerda; null = centralizada
  cubaCentralizada: boolean | null;
  torneira: string;
  revestimentosDefinidos: "sim" | "nao" | "";
  revestimentoPiso: string;
  revestimentoParede: string;
  corPorta: string;
  pintura: string;
  grapas: OpcaoGrapa;
  cliente: string;
  local: string;
  data: string;
  revisao: number;
  medidasConfirmadas: boolean; // o usuário conferiu as medidas (a leitura da planta é aproximada)
  observacoes: string;
  saia?: number; // altura da saia; padrão 0,20 m. Em sanitário acessível: 0,07 m, para deixar 0,73 m livres (NBR 9050, 7.10.3)
  alturaTampo?: number; // topo do tampo; padrão 0,85 m. Em sanitário acessível: 0,80 m (NBR 9050, 7.5 e)
}

export function bancadaInicial(base: Partial<DadosBancada> = {}): DadosBancada {
  return {
    nomePrancha: "", ambiente: "", comprimento: null, profundidade: null, lateralEsquerda: "", lateralDireita: "",
    pedra: "", cubaTipo: "", cubaLargura: null, cubaProfundidade: null, cubaEixo: null, cubaCentralizada: null, torneira: "",
    revestimentosDefinidos: "", revestimentoPiso: "", revestimentoParede: "", corPorta: "", pintura: "",
    grapas: "", cliente: "", local: "", data: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), revisao: 0,
    medidasConfirmadas: false, observacoes: "", ...base,
  };
}

export const temCuba = (d: DadosBancada) => !!d.cubaTipo && d.cubaTipo !== "Sem cuba";
export const eixoCuba = (d: DadosBancada) => (d.cubaCentralizada || d.cubaEixo == null ? (d.comprimento ?? 0) / 2 : d.cubaEixo);
export const grapaRecomendada = (d: DadosBancada): "A" | "B" => ((d.comprimento ?? 0) <= 1 ? "A" : "B");

// Teste T09: sem pedra, cuba e torneira o sistema PERGUNTA antes de gerar. Aqui nada vira "a definir".
export function perguntasEmAberto(d: DadosBancada): string[] {
  const p: string[] = [];
  if (!d.pedra.trim()) p.push("Qual pedra será usada?");
  if (!d.cubaTipo) p.push("Qual o tipo de cuba?");
  if (temCuba(d) && (d.cubaLargura == null || d.cubaProfundidade == null)) p.push("Quais as medidas da cuba (largura e profundidade)?");
  if (temCuba(d) && d.cubaCentralizada == null) p.push("A cuba fica centralizada ou em outra posição?");
  if (temCuba(d) && d.cubaCentralizada === false && d.cubaEixo == null) p.push("Qual a distância do eixo da cuba até a ponta esquerda?");
  if (!d.torneira) p.push("Qual o tipo de torneira?");
  if (!d.revestimentosDefinidos) p.push("Já há definição de revestimentos, cor da porta e pintura?");
  if (d.comprimento == null || d.profundidade == null) p.push("Quais as medidas da bancada (comprimento e profundidade)?");
  if (!d.lateralEsquerda || !d.lateralDireita) p.push("Cada lateral da bancada encosta na parede ou fica aberta?");
  if (!d.grapas) p.push("Qual opção de fixação (grapas): A ou B?");
  if (!d.ambiente.trim()) p.push("Qual o ambiente?");
  return p;
}

export function errosBancada(d: DadosBancada): string[] {
  const e: string[] = [];
  const C = d.comprimento, P = d.profundidade;
  if (C != null && (C < 0.3 || C > 6)) e.push("Comprimento da bancada fora do esperado (entre 0,30 m e 6,00 m). Confira se digitou em metros.");
  if (P != null && (P < 0.25 || P > 1.5)) e.push("Profundidade da bancada fora do esperado (entre 0,25 m e 1,50 m). Confira se digitou em metros.");
  if (temCuba(d) && C != null && P != null && d.cubaLargura != null && d.cubaProfundidade != null) {
    const eixo = eixoCuba(d), meia = d.cubaLargura / 2;
    if (eixo - meia < 0 || eixo + meia > C) e.push("A cuba não cabe nessa posição: ela passa da ponta da bancada. Confira a largura da cuba e a posição do eixo.");
    if (d.cubaProfundidade > P - PADRAO.frontaoEsp) e.push("A cuba é mais funda que a bancada. Confira a profundidade da cuba e da bancada.");
  }
  if (!d.medidasConfirmadas) e.push("Confirme que as medidas foram conferidas (a leitura da planta é aproximada).");
  return e;
}

export interface Peca { nome: string; qtd: number; comprimento: number; largura: number; espessura: number; calculo: string }
// Lista de peças de pedra, em medidas externas (cantos em meia esquadria: o marmorista desconta os encontros).
export function pecasBancada(d: DadosBancada): Peca[] {
  const C = d.comprimento ?? 0, P = d.profundidade ?? 0;
  const pecas: Peca[] = [{ nome: "Tampo", qtd: 1, comprimento: C, largura: P, espessura: PADRAO.tampo, calculo: "comprimento x profundidade da bancada, 2 cm de espessura (padrão)" }];
  pecas.push({ nome: "Frontão de fundo", qtd: 1, comprimento: C, largura: PADRAO.frontaoAlt, espessura: PADRAO.frontaoEsp, calculo: "comprimento da bancada x 10 cm de altura, 2 cm de espessura (padrão)" });
  const paredes = [d.lateralEsquerda, d.lateralDireita].filter((x) => x === "parede").length;
  const abertas = [d.lateralEsquerda, d.lateralDireita].filter((x) => x === "aberta").length;
  if (paredes) pecas.push({ nome: "Frontão lateral", qtd: paredes, comprimento: P, largura: PADRAO.frontaoAlt, espessura: PADRAO.frontaoEsp, calculo: "uma peça para cada lateral encostada na parede: profundidade x 10 cm" });
  pecas.push({ nome: "Saia frontal", qtd: 1, comprimento: C, largura: d.saia ?? PADRAO.saia, espessura: PADRAO.tampo, calculo: d.saia ? "comprimento da bancada x altura da saia reduzida do sanitário acessível (NBR 9050)" : "comprimento da bancada x 20 cm de altura (padrão)" });
  if (abertas) pecas.push({ nome: "Saia lateral", qtd: abertas, comprimento: P, largura: d.saia ?? PADRAO.saia, espessura: PADRAO.tampo, calculo: "uma peça para cada lateral aberta (sem frontão, com saia): profundidade x 20 cm" });
  return pecas;
}
