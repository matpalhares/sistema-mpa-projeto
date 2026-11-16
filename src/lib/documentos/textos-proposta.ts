// Textos de partida da proposta. Tudo é editável na tela antes de gerar.
// A carta vem da skill orcamento-mpa (sem travessão longo, por regra da marca).
import type { DadosProposta, EtapaProposta } from "../tipos";
import { hoje } from "../formato";

export const TIPOS_CONTRATACAO = [
  "Projeto de arquitetura",
  "Projeto de interiores",
  "Projeto de arquitetura e interiores",
  "Construção (execução da obra)",
  "Mão de obra",
  "Outro",
];

export const CARTA_PADRAO =
  "Acredito que projetos excepcionais não começam nas paredes: começam em uma conversa. É nessa conversa que eu entendo quem você é, como vive, o que valoriza e qual versão do seu espaço vai refletir tudo isso.\n\n" +
  "Preparei esta proposta pensando no que conversamos. Nas próximas páginas explico o que vou entregar, como o trabalho acontece em cada etapa e o investimento previsto.\n\n" +
  "Fico à disposição para ajustar o que for preciso.";

export const POR_QUE_INVESTIR_PADRAO =
  "Um bom projeto é o que faz a obra acontecer sem sustos. Ele antecipa as decisões no papel, quando mudar ainda é simples, e entrega a cada profissional da obra a informação exata do que deve ser feito.\n\n" +
  "Com o projeto completo em mãos, você compara orçamentos sobre a mesma base, evita retrabalho e desperdício de material e sabe o que esperar de cada fase.\n\n" +
  "O resultado é um espaço pensado para a sua rotina, com conforto, funcionalidade e identidade, e não apenas uma planta bonita.";

export const ETAPAS_PADRAO: EtapaProposta[] = [
  { titulo: "Briefing", descricao: "Conversa inicial para entender a rotina, as necessidades e as referências.", prazo: "" },
  { titulo: "Estudo preliminar", descricao: "Primeira proposta de layout e conceito, apresentada em reunião para os ajustes.", prazo: "" },
  { titulo: "Maquete 3D e imagens", descricao: "Modelo tridimensional e imagens realistas para visualizar o resultado antes da obra.", prazo: "" },
  { titulo: "Projeto executivo", descricao: "Desenhos técnicos completos para orçar e executar.", prazo: "" },
  { titulo: "Detalhamentos e entrega", descricao: "Detalhamentos, especificações e entrega final do material.", prazo: "" },
];

// Termos de partida: são condições comerciais do escritório, não normas. Revise antes de enviar.
export const TERMOS_PADRAO = [
  "Esta proposta é válida até a data indicada na capa.",
  "O início dos trabalhos acontece após a assinatura desta proposta e a confirmação do pagamento conforme a forma escolhida.",
  "Alterações de escopo solicitadas depois da aprovação de cada etapa podem gerar aditivo de prazo e de valor.",
  "Não estão inclusos: taxas de órgãos públicos, cartório, projetos complementares e itens não descritos no escopo.",
];

export function propostaInicial(base: Partial<DadosProposta> = {}): DadosProposta {
  return {
    clienteNome: "", objetivo: "", tipoContratacao: "", obra: "", local: "", data: hoje(), validadeDias: null,
    carta: CARTA_PADRAO, porQueInvestir: POR_QUE_INVESTIR_PADRAO, escopo: [], etapas: ETAPAS_PADRAO.map((e) => ({ ...e })),
    valorTotal: null, descontoAVista: 5, parcelasSemJuros: 6, parcelasComJuros: 12,
    observacoes: "", itensExtras: [], termos: [...TERMOS_PADRAO], ...base,
  };
}
