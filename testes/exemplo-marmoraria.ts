// Gera pranchas de marmoraria de exemplo, em vários formatos de bancada, e confere sobreposições.
import fs from "node:fs";
import { EMPRESAS_INICIAIS } from "../src/lib/marca";
import { gerarPranchaMarmoraria } from "../src/lib/pranchas/marmoraria";
import { bancadaInicial, type DadosBancada } from "../src/lib/pranchas/regras-bancada";
const saida = process.argv[2] || ".";
const base: Partial<DadosBancada> = { cliente: "Cliente de Teste", local: "Rua de Teste, 100, Centro, Urupês-SP", revestimentosDefinidos: "nao", medidasConfirmadas: true };
export const CASOS: Record<string, DadosBancada> = {
  bwc: bancadaInicial({ ...base, nomePrancha: "BWC Suíte", ambiente: "BWC", comprimento: 1.2, profundidade: 0.5, lateralEsquerda: "parede", lateralDireita: "aberta", pedra: "Granito Bege Bahia", cubaTipo: "Esculpida", cubaLargura: 0.5, cubaProfundidade: 0.3, cubaCentralizada: true, torneira: "Mesa, bica baixa", grapas: "A" }),
  lavabo: bancadaInicial({ ...base, nomePrancha: "Lavabo", ambiente: "Lavabo", comprimento: 0.8, profundidade: 0.45, lateralEsquerda: "parede", lateralDireita: "parede", pedra: "Granito Preto São Gabriel", cubaTipo: "Sobrepor", cubaLargura: 0.38, cubaProfundidade: 0.38, cubaCentralizada: true, torneira: "Parede", grapas: "A" }),
  cozinha: bancadaInicial({ ...base, nomePrancha: "Cozinha", ambiente: "Cozinha", comprimento: 3.2, profundidade: 0.6, lateralEsquerda: "aberta", lateralDireita: "parede", pedra: "Granito Itaúnas", cubaTipo: "Embutir", cubaLargura: 0.56, cubaProfundidade: 0.34, cubaCentralizada: false, cubaEixo: 0.9, torneira: "Mesa, monocomando", grapas: "B", revestimentosDefinidos: "sim", revestimentoPiso: "Porcelanato", revestimentoParede: "Revestimento cerâmico" }),
  cubaDireita: bancadaInicial({ ...base, nomePrancha: "Área de serviço", ambiente: "Área de serviço", comprimento: 2.0, profundidade: 0.6, lateralEsquerda: "parede", lateralDireita: "parede", pedra: "Granito Verde Ubatuba", cubaTipo: "Semiencaixe", cubaLargura: 0.5, cubaProfundidade: 0.4, cubaCentralizada: false, cubaEixo: 1.6, torneira: "Mesa, bica alta", grapas: "B" }),
  estreita: bancadaInicial({ ...base, nomePrancha: "Lavabo 2", ambiente: "Lavabo", comprimento: 0.6, profundidade: 0.4, lateralEsquerda: "aberta", lateralDireita: "parede", pedra: "Mármore Branco", cubaTipo: "Esculpida", cubaLargura: 0.36, cubaProfundidade: 0.26, cubaCentralizada: true, torneira: "Mesa, bica baixa", grapas: "A" }),
  copa: bancadaInicial({ ...base, nomePrancha: "Copa", ambiente: "Copa", comprimento: 1.8, profundidade: 0.55, lateralEsquerda: "aberta", lateralDireita: "aberta", pedra: "Quartzo branco", cubaTipo: "Sem cuba", torneira: "Sem torneira", grapas: "B" }),
};
if (process.argv[1]?.includes("exemplo-marmoraria")) (async () => {
  for (const [nome, d] of Object.entries(CASOS)) {
    const r = await gerarPranchaMarmoraria(EMPRESAS_INICIAIS[0], d);
    fs.writeFileSync(`${saida}/marmoraria_${nome}.pdf`, r.pdf);
    console.log(nome, r.folhas, "folhas;", r.sobreposicoes.length, "sobreposições", r.sobreposicoes.slice(0, 6), r.avisos);
  }
})();
