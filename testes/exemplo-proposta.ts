// Gera uma proposta de exemplo com os dados do modelo aprovado (Cris Bebidas), para comparar o visual.
import fs from "node:fs";
import { EMPRESAS_INICIAIS } from "../src/lib/marca";
import { gerarPropostaDocx } from "../src/lib/documentos/proposta";
import { propostaInicial, textosDoPerfil } from "../src/lib/documentos/textos-proposta";
import { converterParaPdf, verificar } from "../src/lib/documentos/comum";
const saida = process.argv[2] || ".";
export const dadosModelo = () => propostaInicial({
  perfil: "comercial", ...textosDoPerfil("comercial"),
  clienteNome: "Cris Bebidas", saudacao: "Olá, equipe da Cris Bebidas.", objetivo: "Projeto para ampliação e estruturação comercial", tipoContratacao: "Projeto de arquitetura e interiores",
  data: "2026-10-28", validadeDias: 15, valorTotal: 4200, parcelasSemJuros: 3, parcelasComJuros: 10,
  escopo: [
    { titulo: "Análise do programa de necessidades", descricao: "Entendo o que o seu negócio precisa hoje e no futuro, para que o projeto nasça alinhado à sua realidade." },
    { titulo: "Fluxograma", descricao: "Organiza o caminho de clientes, produtos e funcionários, evitando gargalos e perdas de tempo." },
    { titulo: "Desenvolvimento do layout interno", descricao: "Define a posição de cada setor, balcão, estoque e circulação de forma eficiente." },
    { titulo: "Planta de ampliação e layout", descricao: "Mostra com precisão o que será construído e como os ambientes se conectam." },
    { titulo: "Maquete 3D digital da fachada", descricao: "Permite enxergar a nova imagem do seu comércio antes mesmo de construir." },
    { titulo: "Maquete 3D digital dos interiores", descricao: "Mostra como os ambientes ficarão por dentro, com proporções, materiais e cores." },
    { titulo: "Imagens fotorrealistas", descricao: "Apresentam o projeto com realismo, facilitando decisões e a aprovação final." },
    { titulo: "Projeto executivo", descricao: "Conjunto de desenhos técnicos e detalhamentos para a execução das obras, com precisão e sem improvisos." },
  ],
  etapas: [
    { titulo: "Levantamento e análise", itens: ["Análise do programa de necessidades", "Fluxograma de clientes, produtos e funcionários"], prazo: "" },
    { titulo: "Layout e ampliação", itens: ["Desenvolvimento do layout interno", "Planta de ampliação e layout"], prazo: "" },
    { titulo: "Maquetes e imagens", itens: ["Maquete 3D digital da fachada", "Maquete 3D digital dos interiores", "Imagens fotorrealistas"], prazo: "" },
    { titulo: "Projeto executivo", itens: ["Desenhos técnicos e detalhamentos para execução das obras", "Entrega final do projeto"], prazo: "" },
  ],
});
if (process.argv[1]?.includes("exemplo-proposta")) (async () => {
  const docx = await gerarPropostaDocx(EMPRESAS_INICIAIS[0], dadosModelo());
  fs.writeFileSync(saida + "/proposta.docx", docx);
  const pdf = await converterParaPdf(docx);
  if (pdf) fs.writeFileSync(saida + "/proposta.pdf", pdf);
  console.log(await verificar(pdf));
})();
