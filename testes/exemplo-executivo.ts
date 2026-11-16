// Gera o executivo dos ambientes de referência (Escola Recriarte) e outros, para conferir contra as pranchas do escritório.
import fs from "node:fs";
import { EMPRESAS_INICIAIS } from "../src/lib/marca";
import { gerarExecutivo } from "../src/lib/pranchas/executivo";
import { EXEMPLOS, respostasIniciais, type RespostasAmbiente } from "../src/lib/pranchas/ambiente";
const saida = process.argv[2] || ".";
export const RESP = (extra: Partial<RespostasAmbiente> = {}) => respostasIniciais({ pedra: "Granito Bege Bahia", cubaTipo: "Embutir", cubaLargura: 0.3, cubaProfundidade: 0.3, torneira: "Mesa, bica baixa", vasoTipo: "Caixa acoplada", espelho: "sim", chuveiroTipo: "Ducha com braço saindo da parede", boxTipo: "Vidro temperado, porta de abrir", revestimentosDefinidos: "nao", cliente: "Escola Recriarte Urupês", local: "Rua General Osório, 207, Bairro Mundo Novo, Urupês-SP", data: "2026-10-19", origemPlanta: "Estudo Preliminar Escola", modeloConferido: true, ...extra });
export const CASOS_EXE: [string, RespostasAmbiente][] = [["bwc1", RESP()], ["bwc2pne", RESP()], ["lavabo", RESP({ vasoTipo: "Válvula de descarga na parede", cubaTipo: "Sobrepor", espelho: "nao" })], ["suite", RESP({ cubaTipo: "Esculpida", cubaLargura: 0.5, pedra: "Granito Preto São Gabriel" })]];
if (process.argv[1]?.includes("exemplo-executivo")) (async () => {
  for (const [nome, r] of CASOS_EXE) {
    const res = await gerarExecutivo(EMPRESAS_INICIAIS[0], EXEMPLOS[nome], r);
    fs.writeFileSync(`${saida}/executivo_${nome}.pdf`, res.pdf);
    console.log(nome, res.sobreposicoes.length, "sobreposições", res.sobreposicoes.slice(0, 8).map((s) => `F${s.folha}: ${s.a} x ${s.b}`), res.avisos);
  }
})();
