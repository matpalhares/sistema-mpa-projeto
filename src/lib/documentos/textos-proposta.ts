// Textos de partida da proposta, no modelo aprovado (Proposta Cris Bebidas). Tudo é editável na tela.
import type { DadosProposta, Diferencial, EtapaProposta, PerfilProposta } from "../tipos";
import { hoje } from "../formato";

export const TIPOS_CONTRATACAO = [
  "Projeto de arquitetura",
  "Projeto de interiores",
  "Projeto de arquitetura e interiores",
  "Construção (execução da obra)",
  "Mão de obra",
  "Outro",
];

interface TextosPerfil { fraseCapa: string; tituloApresentacao: string; carta: string; diferenciais: Diferencial[]; missao: string; proximosPassos: string[] }

// COMERCIAL: textos do modelo Cris Bebidas (do próprio escritório).
// RESIDENCIAL: mesma estrutura; carta e missão vêm da skill orcamento-mpa, em 1ª pessoa.
// Os diferenciais 2 e 3 do residencial são uma adaptação sugerida: revise.
export const TEXTOS: Record<"comercial" | "residencial", TextosPerfil> = {
  comercial: {
    fraseCapa: "Cada detalhe foi pensado especialmente para o seu negócio.",
    tituloApresentacao: "Uma conversa que começa pelo seu negócio",
    carta:
      "É com grande satisfação que apresento esta proposta. Entendo que um espaço comercial bem pensado não é apenas um lugar de venda: é a base para o seu negócio crescer com organização, eficiência e uma imagem que valorize a sua marca.\n\n" +
      "Neste trabalho, vou analisar com atenção as necessidades do seu negócio, organizar o fluxo de trabalho e de atendimento e transformar tudo isso em um projeto claro, visual e pronto para ser executado.\n\n" +
      "Conte comigo em cada etapa. Meu compromisso é entregar um projeto funcional, bonito e que faça sentido para a sua realidade.",
    diferenciais: [
      { titulo: "Evita desperdício", texto: "Decisões tomadas no papel custam muito menos do que correções feitas durante a obra." },
      { titulo: "Organiza o fluxo", texto: "Um layout bem pensado reduz deslocamentos, facilita a reposição e melhora o atendimento ao cliente." },
      { titulo: "Valoriza a sua marca", texto: "Fachada e interiores atraentes ajudam a conquistar, encantar e fidelizar clientes." },
      { titulo: "Dá segurança na execução", texto: "Com o projeto executivo detalhado, a equipe de obra trabalha com precisão e sem improvisos." },
    ],
    missao: "Meu compromisso vai muito além de entregar um projeto. Quero entregar um espaço que faça o seu negócio crescer com organização e uma imagem à altura do seu trabalho.",
    proximosPassos: ["Revise esta proposta com atenção", "Assine e retorne uma via", "Realizo o levantamento inicial", "Seu projeto começa"],
  },
  residencial: {
    fraseCapa: "Cada detalhe foi pensado especialmente para você.",
    tituloApresentacao: "Uma conversa que começa por você",
    carta:
      "Acredito que projetos excepcionais não começam nas paredes: começam em uma conversa. É nessa conversa que eu entendo quem você é, como vive, o que valoriza e qual versão do seu espaço vai refletir tudo isso.\n\n" +
      "Preparei esta proposta pensando no que conversamos. Nas próximas páginas explico o que vou entregar, como o trabalho acontece em cada etapa e o investimento previsto.\n\n" +
      "Conte comigo em cada etapa. Meu compromisso é entregar um projeto funcional, bonito e que faça sentido para a sua realidade.",
    diferenciais: [
      { titulo: "Evita desperdício", texto: "Decisões tomadas no papel custam muito menos do que correções feitas durante a obra." },
      { titulo: "Organiza a rotina", texto: "Um layout bem pensado reduz deslocamentos e deixa cada ambiente do jeito que a sua rotina pede." },
      { titulo: "Valoriza o seu imóvel", texto: "Ambientes bem resolvidos e com identidade valorizam o imóvel e o dia a dia de quem vive nele." },
      { titulo: "Dá segurança na execução", texto: "Com o projeto executivo detalhado, a equipe de obra trabalha com precisão e sem improvisos." },
    ],
    missao: "Meu compromisso vai muito além de entregar um projeto. Quero entregar o verdadeiro lar que você e sua família merecem.",
    proximosPassos: ["Revise esta proposta com atenção", "Assine e retorne uma via", "Realizo o briefing inicial", "Seu projeto exclusivo começa"],
  },
};

export const FRASE_CAPA_DESTAQUE = "Com precisão. Com beleza. Com você.";

export const ETAPAS_PADRAO: EtapaProposta[] = [
  { titulo: "Levantamento e análise", itens: ["Análise do programa de necessidades"], prazo: "" },
  { titulo: "Estudo e layout", itens: ["Desenvolvimento do layout"], prazo: "" },
  { titulo: "Maquetes e imagens", itens: ["Maquete 3D digital", "Imagens fotorrealistas"], prazo: "" },
  { titulo: "Projeto executivo", itens: ["Desenhos técnicos e detalhamentos para execução das obras", "Entrega final do projeto"], prazo: "" },
];

// Termos do modelo aprovado. A validade (1º item) é escrita automaticamente a partir dos dias informados.
export const TERMOS_PADRAO = [
  "As condições de pagamento são as descritas na seção Investimento.",
  "O escopo contempla somente os itens descritos nesta proposta. Qualquer item adicional será tratado em novo orçamento.",
  "A execução da obra não está inclusa nesta proposta.",
  "Os trabalhos têm início após o aceite desta proposta.",
];

export function textosDoPerfil(perfil: PerfilProposta): Pick<DadosProposta, "fraseCapa" | "tituloApresentacao" | "carta" | "diferenciais" | "missao" | "proximosPassos"> {
  const t = TEXTOS[perfil === "comercial" ? "comercial" : "residencial"];
  return { ...t, diferenciais: t.diferenciais.map((d) => ({ ...d })), proximosPassos: [...t.proximosPassos] };
}

export function propostaInicial(base: Partial<DadosProposta> = {}): DadosProposta {
  return {
    perfil: "", clienteNome: "", objetivo: "", tipoContratacao: "", obra: "", local: "", data: hoje(), validadeDias: null,
    saudacao: "", ...textosDoPerfil(""),
    escopo: [], etapas: ETAPAS_PADRAO.map((e) => ({ ...e, itens: [...e.itens] })),
    valorTotal: null, descontoAVista: 5, parcelasSemJuros: 6, parcelasComJuros: 12,
    observacoes: "", itensExtras: [], termos: [...TERMOS_PADRAO], ...base,
  };
}
