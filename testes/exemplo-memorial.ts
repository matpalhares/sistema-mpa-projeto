import fs from "node:fs";
import { EMPRESAS_INICIAIS } from "../src/lib/marca";
import { gerarMemorialDocx, memorialInicial } from "../src/lib/documentos/memorial";
import { converterParaPdf, verificar } from "../src/lib/documentos/comum";
import { PERGUNTAS_SERVICOS } from "../src/lib/documentos/opcoes-memorial";
const saida = process.argv[2] || ".";
export const dadosTeste = () => {
  const d = memorialInicial({ proprietario: "Cliente de Teste", obra: "Residência de teste", endereco: "Rua de Teste, 100", municipio: "Urupês-SP", tipoObra: "Residencial: reforma e ampliação",
    areaTerreno: 300, areaAConstruir: 40.5, areaExistenteReformada: 80, areaExistenteMantida: 20, leituraConfirmada: true });
  for (const q of PERGUNTAS_SERVICOS) d.servicos[q.chave] = { resposta: q.opcoes[0], detalhe: q.chave === "bancadas" ? "Preto São Gabriel, espessura 2 cm" : "" };
  d.esquadrias = [{ codigo: "J1", tipo: "Janela de correr", material: "Alumínio preto", largura: "1,50 m", altura: "1,20 m", quantidade: "2" }];
  d.ambientes = [
    { nome: "Sala", areaM2: 22.4, piso: { tipo: "Porcelanato", marca: "MarcaTesteXYZ", modelo: "ModeloTeste900", medida: "90x90 cm" }, paredes: { tipo: "Pintura acrílica", marca: "TintaTesteQW", modelo: "", medida: "" }, teto: { tipo: "Forro de gesso com pintura", marca: "", modelo: "", medida: "" }, esquadrias: "J1" },
    { nome: "Banheiro", areaM2: 4, piso: { tipo: "Porcelanato", marca: "", modelo: "", medida: "60x60 cm" }, paredes: { tipo: "", marca: "", modelo: "", medida: "" }, teto: { tipo: "Forro de gesso com pintura", marca: "", modelo: "", medida: "" }, esquadrias: "" },
  ];
  return d;
};
if (process.argv[1]?.includes("exemplo-memorial")) (async () => {
  for (const tipo of ["completo", "simplificado"] as const) {
    const docx = await gerarMemorialDocx(EMPRESAS_INICIAIS[0], dadosTeste(), tipo);
    fs.writeFileSync(`${saida}/memorial_${tipo}.docx`, docx);
    const pdf = await converterParaPdf(docx);
    if (pdf) fs.writeFileSync(`${saida}/memorial_${tipo}.pdf`, pdf);
    console.log(tipo, await verificar(pdf));
  }
})();
