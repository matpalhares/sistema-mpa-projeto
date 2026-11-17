// Exemplos de marcenaria para os testes: um móvel por medidas e o mesmo móvel como arquivo do SketchUp (JSON do exportador).
import { movelPorMedidas, respostasMarcenariaIniciais, type ModeloBruto, type MovelParam, type RespostasMarcenaria } from "../src/lib/marcenaria/modelo";

export const RESP_MARC = (b: Partial<RespostasMarcenaria> = {}): RespostasMarcenaria => respostasMarcenariaIniciais({
  cliente: "Cliente de Teste", local: "Rua de Teste, 100, Urupês-SP", data: "2026-11-16", espCaixa: "18 mm", acabamentoCaixa: "MDF Branco TX", acabamentoFrentes: "MDF Freijó",
  veio: "sim", portas: "Sobrepostas", puxador: "Cava (sem puxador)", corredica: "Telescópica", dobradica: "Com amortecimento", alturaLateralGaveta: 120, conferido: true, ...b });

export const BALCAO: MovelParam = { nome: "Balcão da cozinha", ambiente: "Cozinha", L: 1800, P: 550, A: 850, rodape: "sim", rodapeAltura: 100, rodapeRecuo: 50, fundo: "sim",
  modulos: [{ tipo: "portas", portas: 2, gavetas: 0, prateleiras: 1, largura: null }, { tipo: "gavetas", portas: 0, gavetas: 3, prateleiras: 0, largura: 500 }, { tipo: "aberto", portas: 0, gavetas: 0, prateleiras: 2, largura: null }] };
export const ROUPEIRO: MovelParam = { nome: "Roupeiro do quarto", ambiente: "Suíte", L: 2400, P: 600, A: 2600, rodape: "sim", rodapeAltura: 80, rodapeRecuo: 40, fundo: "sim",
  modulos: [{ tipo: "portas", portas: 2, gavetas: 0, prateleiras: 4, largura: null }, { tipo: "portas", portas: 2, gavetas: 0, prateleiras: 2, largura: null }, { tipo: "portas", portas: 1, gavetas: 0, prateleiras: 5, largura: 450 }] };

// O balcão "exportado do SketchUp": girado (frente no maior Y), fora da origem, metade das peças sem nome útil.
export function modeloSketchUp(): ModeloBruto {
  const m = movelPorMedidas(BALCAO, RESP_MARC());
  return { versao: "mpa-marcenaria-1", cores: { "MDF Branco TX": [240, 238, 232, 255], "MDF Freijó": [176, 132, 92, 255] },
    pecas: [
      ...m.pecas.map((p, i) => ({ caminho: ["Balcão SketchUp"], nome: i % 2 ? `Grupo#${i}` : `${p.nome.replace(/ /g, "_")}_${i}`, material: p.papel === "porta" || p.papel === "frente_gaveta" ? "MDF Freijó" : "MDF Branco TX",
        dims_mm: [p.C, p.L, p.E], bbox_mm: [[3000 + m.L - p.x1, 500 + m.P - p.y1, 20 + p.z0], [3000 + m.L - p.x0, 500 + m.P - p.y0, 20 + p.z1]] as [number[], number[]], caixa_ratio: 1 })),
      { caminho: ["Balcão SketchUp"], nome: "Corrediça Telescópica 450 mm", dims_mm: [450, 45, 12], bbox_mm: [[3100, 600, 200], [3112, 1050, 245]], caixa_ratio: 0.4 },
    ] };
}
