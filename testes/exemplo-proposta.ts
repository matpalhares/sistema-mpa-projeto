import fs from "node:fs";
import { EMPRESAS_INICIAIS } from "../src/lib/marca";
import { gerarPropostaDocx } from "../src/lib/documentos/proposta";
import { propostaInicial } from "../src/lib/documentos/textos-proposta";
import { converterParaPdf, verificar } from "../src/lib/documentos/comum";
const saida = process.argv[2] || ".";
(async () => {
  const d = propostaInicial({ clienteNome: "Cliente de Teste", objetivo: "Projeto de arquitetura e interiores", tipoContratacao: "Projeto de arquitetura e interiores", obra: "Residência de teste", local: "Urupês-SP",
    escopo: ["Levantamento e briefing", "Estudo preliminar com layout", "Maquete 3D e imagens", "Projeto executivo completo"], valorTotal: 12000, validadeDias: 15,
    itensExtras: [{ descricao: "Visita técnica adicional", valor: null }] });
  d.etapas[0].prazo = "1 semana";
  const docx = await gerarPropostaDocx(EMPRESAS_INICIAIS[0], d);
  fs.writeFileSync(saida + "/proposta.docx", docx);
  const pdf = await converterParaPdf(docx);
  if (pdf) fs.writeFileSync(saida + "/proposta.pdf", pdf);
  console.log(await verificar(pdf));
})();
