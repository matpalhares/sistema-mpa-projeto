// Perguntas do memorial, com opções clicáveis (regra permanente: perguntar, nunca assumir).
// As opções são alternativas construtivas comuns para o usuário escolher; "Outro" abre texto livre.
// O que ficar sem resposta sai como "a definir" (amarelo) no documento.
export interface PerguntaServico {
  chave: string;
  secao: string; // subseção 4.x do memorial
  pergunta: string;
  rotulo: string; // como aparece no documento
  opcoes: string[];
  dicaDetalhe: string; // o que cabe no campo de detalhe (só memorial completo)
}

export const SECOES_SERVICOS = [
  { id: "4.1", titulo: "Serviços preliminares e demolições" },
  { id: "4.2", titulo: "Fundações, estrutura e alvenaria" },
  { id: "4.3", titulo: "Cobertura e impermeabilização" },
  { id: "4.4", titulo: "Instalações" },
  { id: "4.5", titulo: "Esquadrias" },
  { id: "4.6", titulo: "Revestimentos, forro e pintura" },
  { id: "4.7", titulo: "Louças, metais, bancadas e marcenaria" },
  { id: "4.8", titulo: "Áreas externas, limpeza e entrega" },
];

export const PERGUNTAS_SERVICOS: PerguntaServico[] = [
  { chave: "preliminares", secao: "4.1", rotulo: "Serviços preliminares", pergunta: "Quais serviços preliminares a obra terá?", opcoes: ["Limpeza do terreno, locação da obra e instalações provisórias", "Proteção das áreas existentes e instalações provisórias", "Não se aplica"], dicaDetalhe: "Ex.: tapume, ligações provisórias" },
  { chave: "demolicoes", secao: "4.1", rotulo: "Demolições e retiradas", pergunta: "Haverá demolições ou retiradas?", opcoes: ["Demolição de alvenarias e retirada de revestimentos indicados em projeto", "Retirada de revestimentos, louças e esquadrias indicados em projeto", "Não haverá demolições"], dicaDetalhe: "Ex.: quais paredes e ambientes" },
  { chave: "fundacoes", secao: "4.2", rotulo: "Fundações", pergunta: "Qual o tipo de fundação?", opcoes: ["Estacas ou brocas com blocos e vigas baldrame", "Sapatas isoladas com vigas baldrame", "Radier", "Fundação existente mantida", "Conforme projeto estrutural"], dicaDetalhe: "Ex.: profundidade, dimensões" },
  { chave: "estrutura", secao: "4.2", rotulo: "Estrutura", pergunta: "Qual o sistema estrutural?", opcoes: ["Concreto armado (pilares, vigas e lajes)", "Alvenaria estrutural", "Estrutura metálica", "Light Steel Frame", "Estrutura existente mantida", "Conforme projeto estrutural"], dicaDetalhe: "Ex.: tipo de laje, fck" },
  { chave: "alvenaria", secao: "4.2", rotulo: "Alvenaria e vedações", pergunta: "Como serão as paredes?", opcoes: ["Blocos cerâmicos", "Blocos de concreto", "Tijolo maciço", "Drywall", "Placas sobre perfis de aço (Steel Frame)"], dicaDetalhe: "Ex.: espessura, marca do bloco" },
  { chave: "cobertura", secao: "4.3", rotulo: "Cobertura", pergunta: "Qual o tipo de cobertura?", opcoes: ["Telha cerâmica sobre estrutura de madeira", "Telha metálica termoacústica com platibanda", "Telha de fibrocimento com platibanda", "Laje impermeabilizada", "Cobertura existente mantida"], dicaDetalhe: "Ex.: inclinação, marca da telha" },
  { chave: "impermeabilizacao", secao: "4.3", rotulo: "Impermeabilização", pergunta: "Onde haverá impermeabilização?", opcoes: ["Vigas baldrame, áreas molhadas e lajes expostas", "Vigas baldrame e áreas molhadas", "Somente áreas molhadas"], dicaDetalhe: "Ex.: tipo de manta ou argamassa" },
  { chave: "eletrica", secao: "4.4", rotulo: "Instalações elétricas", pergunta: "Como serão as instalações elétricas?", opcoes: ["Novas, embutidas, conforme projeto elétrico", "Adequação e ampliação das instalações existentes", "Existentes mantidas"], dicaDetalhe: "Ex.: padrão de entrada, marca de tomadas" },
  { chave: "hidraulica", secao: "4.4", rotulo: "Água fria e quente", pergunta: "Como serão as instalações de água?", opcoes: ["Novas, em tubos de PVC soldável (água fria)", "Novas, com água fria e água quente", "Adequação das instalações existentes", "Existentes mantidas"], dicaDetalhe: "Ex.: aquecedor, reservatório" },
  { chave: "esgoto", secao: "4.4", rotulo: "Esgoto sanitário", pergunta: "Para onde vai o esgoto?", opcoes: ["Ligado à rede pública de esgoto", "Fossa séptica e sumidouro", "Ligação existente mantida"], dicaDetalhe: "Ex.: caixas de inspeção e gordura" },
  { chave: "pluviais", secao: "4.4", rotulo: "Águas pluviais", pergunta: "Como serão conduzidas as águas da chuva?", opcoes: ["Calhas e condutores até a sarjeta", "Calhas e condutores até caixas de areia e rede de drenagem", "Sistema existente mantido"], dicaDetalhe: "Ex.: material das calhas" },
  { chave: "esquadrias", secao: "4.5", rotulo: "Esquadrias", pergunta: "Qual o material das esquadrias?", opcoes: ["Alumínio com vidro", "Madeira", "Ferro ou aço com vidro", "PVC com vidro", "Portas internas de madeira e janelas de alumínio com vidro"], dicaDetalhe: "Ex.: cor, linha, tipo de vidro" },
  { chave: "revestimentos", secao: "4.6", rotulo: "Revestimentos", pergunta: "Como serão os revestimentos de piso e parede?", opcoes: ["Piso em porcelanato e paredes das áreas molhadas em revestimento cerâmico", "Piso cerâmico e paredes das áreas molhadas em revestimento cerâmico", "Conforme quadro de acabamentos por ambiente"], dicaDetalhe: "Ex.: formatos, marcas, rejunte" },
  { chave: "forro", secao: "4.6", rotulo: "Forro", pergunta: "Qual o tipo de forro?", opcoes: ["Forro de gesso acartonado", "Laje com acabamento em gesso liso", "Forro de PVC", "Forro de madeira", "Sem forro (laje ou telhado aparente)"], dicaDetalhe: "Ex.: sancas, tabicas" },
  { chave: "pintura", secao: "4.6", rotulo: "Pintura", pergunta: "Como será a pintura?", opcoes: ["Tinta acrílica sobre massa nas paredes internas e textura ou tinta acrílica nas externas", "Tinta acrílica nas paredes internas e externas", "Conforme quadro de acabamentos por ambiente"], dicaDetalhe: "Ex.: cores, marcas, acabamento" },
  { chave: "loucasMetais", secao: "4.7", rotulo: "Louças e metais", pergunta: "Como serão as louças e os metais?", opcoes: ["Louças brancas e metais cromados", "Louças e metais conforme especificação do projeto de interiores", "Existentes mantidos"], dicaDetalhe: "Ex.: marcas, modelos, acabamento" },
  { chave: "bancadas", secao: "4.7", rotulo: "Bancadas", pergunta: "De que serão as bancadas?", opcoes: ["Granito", "Mármore", "Quartzo industrializado", "Porcelanato", "Não se aplica"], dicaDetalhe: "Ex.: nome da pedra, espessura" },
  { chave: "marcenaria", secao: "4.7", rotulo: "Marcenaria", pergunta: "Haverá marcenaria planejada?", opcoes: ["Marcenaria planejada conforme projeto de interiores", "Não faz parte desta obra"], dicaDetalhe: "Ex.: padrão do MDF, ferragens" },
  { chave: "externas", secao: "4.8", rotulo: "Áreas externas", pergunta: "Como serão as áreas externas?", opcoes: ["Piso externo antiderrapante, calçada e muros de divisa", "Piso externo antiderrapante e paisagismo", "Áreas externas existentes mantidas"], dicaDetalhe: "Ex.: tipo de piso, portões" },
  { chave: "limpeza", secao: "4.8", rotulo: "Limpeza e entrega", pergunta: "Como será a entrega da obra?", opcoes: ["Limpeza final, retirada de entulho e teste das instalações antes da entrega"], dicaDetalhe: "" },
];

export const OPCOES_ACABAMENTO = {
  piso: ["Porcelanato", "Piso cerâmico", "Piso vinílico", "Piso laminado", "Madeira", "Cimento queimado", "Granito", "Piso externo antiderrapante", "Existente mantido"],
  paredes: ["Pintura acrílica", "Revestimento cerâmico", "Porcelanato", "Textura", "Papel de parede", "Painel de madeira", "Existente mantido"],
  teto: ["Forro de gesso com pintura", "Laje com pintura", "Forro de PVC", "Forro de madeira", "Telhado aparente", "Existente mantido"],
};

export const TIPOS_OBRA = ["Residencial: construção nova", "Residencial: reforma", "Residencial: reforma e ampliação", "Comercial: construção nova", "Comercial: reforma"];

// Normas citadas pela skill memorial-descritivo do escritório.
export const NORMAS = [
  "NBR 6118 (estruturas de concreto)",
  "NBR 5410 (instalações elétricas de baixa tensão)",
  "NBR 5626 (instalações prediais de água fria e água quente)",
  "NBR 8160 (sistemas prediais de esgoto sanitário)",
  "NBR 10844 (instalações prediais de águas pluviais)",
];

// Medidas e dimensões não podem aparecer no memorial simplificado (prefeitura).
const RE_MEDIDA = /\d+\s*[x×]\s*\d+|\d+[.,]?\d*\s*(cm|mm|m²|m2|kg|pol|")(?![a-zà-ú])|\b\d+[.,]\d+\s*m\b/i;
export const contemMedida = (texto: string) => RE_MEDIDA.test(texto);
