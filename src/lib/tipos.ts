// Tipos centrais do Sistema MPA Projeto (Fase 1).
export type Id = string;

export interface Marca {
  definida: boolean; // false = "a definir": documentos dessa empresa ficam bloqueados
  azul: string;
  dourado: string;
  offwhite: string;
  bege: string;
  begeLinha: string;
  fonte: string;
  razaoSocial: string;
  cidade: string;
  telefone: string;
  email: string;
  instagram: string;
  endereco: string;
  responsavelTecnico: string;
  registro: string; // CAU / CREA
  logoClaro?: string; // caminho do logo para fundo escuro
  logoEscuro?: string; // caminho do logo para fundo claro
  marcaDagua?: string;
  qrWhatsapp?: string;
  qrInstagram?: string;
  cabecalhoNome?: string; // ex.: MATHEUS PALHARES
  cabecalhoSub?: string; // ex.: ARQUITETURA + INTERIORES
  assinaturaNome?: string; // ex.: Matheus Palhares
  assinaturaTitulo?: string; // ex.: Arquiteto e Urbanista
  logoBranco?: string;
  logoPrancha?: string; // logo compacto para o cabeçalho das pranchas
}

export interface Empresa {
  id: Id;
  sigla: string;
  nome: string;
  marca: Marca;
}

export interface Usuario {
  id: Id;
  nome: string;
  email: string;
  senhaHash: string;
  empresas: Id[];
}

export interface Cliente {
  id: Id;
  empresaId: Id;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
}

export interface ArquivoRef {
  nome: string;
  caminho: string;
  tamanho: number;
  enviadoEm: string;
  categoria: "planta" | "sketchup" | "contrato" | "outro";
}

export interface Projeto {
  id: Id;
  empresaId: Id;
  clienteId: Id;
  obra: string;
  endereco: string;
  municipio: string;
  tipo: string;
  areaM2: number | null;
  contrato: string;
  contratouExecucao: boolean | null; // null = ainda não respondido (pendência)
  etapaAtual: number; // índice em ETAPAS
  arquivos: ArquivoRef[];
  arquivado: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EtapaProposta {
  titulo: string;
  itens: string[]; // o que acontece na etapa
  prazo: string; // opcional: só aparece se preenchido
}

export interface ItemEscopo {
  titulo: string;
  descricao: string;
}

export interface Diferencial {
  titulo: string;
  texto: string;
}

export interface ItemExtra {
  descricao: string;
  valor: number | null;
}

export type PerfilProposta = "comercial" | "residencial" | "";

export interface DadosProposta {
  perfil: PerfilProposta; // para quem é: define os textos de partida
  clienteNome: string;
  objetivo: string; // "Projeto" na capa
  tipoContratacao: string;
  obra: string;
  local: string;
  data: string; // AAAA-MM-DD
  validadeDias: number | null;
  fraseCapa: string;
  tituloApresentacao: string;
  saudacao: string; // vazio = "Olá, <cliente>."
  carta: string;
  diferenciais: Diferencial[]; // "Por que investir em um bom projeto" (sem preço)
  escopo: ItemEscopo[];
  etapas: EtapaProposta[];
  valorTotal: number | null;
  descontoAVista: number; // %
  parcelasSemJuros: number;
  parcelasComJuros: number;
  observacoes: string;
  itensExtras: ItemExtra[];
  termos: string[];
  missao: string;
  proximosPassos: string[];
}

export interface Verificacao {
  paginas: number | null;
  paginasEmBranco: number[];
  temTravessao: boolean;
  pdfGerado: boolean;
  avisos: string[];
}

export type StatusProposta = "rascunho" | "enviada" | "aprovada" | "recusada";

export interface Proposta {
  id: Id;
  empresaId: Id;
  projetoId: Id | null;
  versao: number;
  status: StatusProposta;
  dados: DadosProposta;
  docx: string | null;
  pdf: string | null;
  verificacao: Verificacao | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Acabamento {
  tipo: string; // genérico, ex.: "Porcelanato". Vazio = a definir
  marca: string; // só no memorial completo
  modelo: string; // só no memorial completo
  medida: string; // só no memorial completo
}

export interface AmbienteMemorial {
  nome: string;
  areaM2: number | null;
  piso: Acabamento;
  paredes: Acabamento;
  teto: Acabamento;
  esquadrias: string; // só no completo
}

export interface Esquadria {
  codigo: string;
  tipo: string;
  material: string;
  largura: string;
  altura: string;
  quantidade: string;
}

export interface RespostaServico {
  resposta: string; // opção genérica; vazio = a definir
  detalhe: string; // marcas, modelos, medidas: só no completo
}

export interface DadosMemorial {
  proprietario: string;
  cpfCnpj: string;
  obra: string;
  endereco: string;
  municipio: string;
  matricula: string;
  inscricaoMunicipal: string;
  tipoObra: string;
  rrt: string;
  areaTerreno: number | null;
  areaAConstruir: number | null;
  areaExistenteReformada: number | null;
  areaExistenteMantida: number | null;
  taxaOcupacao: string;
  coeficienteAproveitamento: string;
  taxaPermeabilidade: string;
  ajusteMunicipio: string;
  servicos: Record<string, RespostaServico>;
  esquadrias: Esquadria[];
  ambientes: AmbienteMemorial[];
  data: string;
  leituraConfirmada: boolean; // o usuário conferiu os ambientes lidos da planta
}

export type TipoMemorial = "completo" | "simplificado";

export interface Memorial {
  id: Id;
  empresaId: Id;
  projetoId: Id;
  revisao: number;
  dados: DadosMemorial;
  saidas: Partial<Record<TipoMemorial, { docx: string; pdf: string | null; verificacao: Verificacao }>>;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VerificacaoPrancha { folhas: number; sobreposicoes: number; avisos: string[] }

// Detalhamento técnico (Fase 2). Por enquanto: marmoraria (bancada, padrão A).
export interface Detalhamento {
  id: Id;
  empresaId: Id;
  projetoId: Id;
  tipo: "marmoraria";
  dados: import("./pranchas/regras-bancada").DadosBancada;
  plantaSituacao: string | null; // imagem da planta (PNG ou JPG) para a folha 2
  pdf: string | null;
  verificacao: VerificacaoPrancha | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const A_DEFINIR = "a definir";
