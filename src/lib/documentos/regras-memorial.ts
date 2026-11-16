// Regras puras do memorial (usadas na tela e no servidor).
import type { Acabamento, DadosMemorial, TipoMemorial } from "../tipos";
import { contemMedida, PERGUNTAS_SERVICOS } from "./opcoes-memorial";

export function areaTotal(d: DadosMemorial): number | null {
  const partes = [d.areaAConstruir, d.areaExistenteReformada, d.areaExistenteMantida];
  if (partes.some((x) => x == null)) return null;
  return Math.round(partes.reduce((s: number, x) => s + (x as number), 0) * 100) / 100;
}

export function pendenciasMemorial(d: DadosMemorial, tipo: TipoMemorial): string[] {
  const f: string[] = [];
  const falta = (v: string | number | null, nome: string) => { if (v == null || String(v).trim() === "") f.push(nome); };
  falta(d.proprietario, "Proprietário"); falta(d.cpfCnpj, "CPF ou CNPJ"); falta(d.endereco, "Endereço da obra");
  falta(d.municipio, "Município"); falta(d.matricula, "Matrícula do imóvel"); falta(d.inscricaoMunicipal, "Inscrição municipal");
  falta(d.tipoObra, "Tipo de obra"); falta(d.rrt, "Número do RRT");
  falta(d.areaTerreno, "Área do terreno"); falta(d.areaAConstruir, "Área a construir");
  falta(d.areaExistenteReformada, "Área existente a reformar"); falta(d.areaExistenteMantida, "Área existente mantida");
  falta(d.taxaOcupacao, "Taxa de ocupação"); falta(d.coeficienteAproveitamento, "Coeficiente de aproveitamento"); falta(d.taxaPermeabilidade, "Taxa de permeabilidade");
  for (const q of PERGUNTAS_SERVICOS) if (!d.servicos[q.chave]?.resposta?.trim()) f.push(q.rotulo);
  if (d.ambientes.length === 0) f.push("Lista de ambientes");
  for (const a of d.ambientes) {
    for (const [k, nome] of [["piso", "piso"], ["paredes", "paredes"], ["teto", "teto"]] as const) {
      if (!a[k].tipo.trim()) f.push(`${a.nome || "Ambiente"}: ${nome}`);
    }
  }
  if (tipo === "completo" && d.esquadrias.length === 0) f.push("Tabela de esquadrias");
  return f;
}

// Bloqueios antes de gerar. No simplificado, nenhuma medida pode estar nos campos genéricos.
export function errosMemorial(d: DadosMemorial, tipo: TipoMemorial): string[] {
  const e: string[] = [];
  if (!d.leituraConfirmada) e.push("Confirme a lista de ambientes antes de gerar (a leitura da planta é aproximada).");
  if (tipo === "simplificado") {
    for (const q of PERGUNTAS_SERVICOS) {
      const r = d.servicos[q.chave]?.resposta ?? "";
      if (contemMedida(r)) e.push(`"${q.rotulo}" tem medida na resposta ("${r}"). No memorial da prefeitura, passe a medida para o campo de detalhe.`);
    }
    for (const a of d.ambientes) for (const k of ["piso", "paredes", "teto"] as const) {
      if (contemMedida(a[k].tipo)) e.push(`${a.nome}: o tipo de ${k} tem medida ("${a[k].tipo}"). Passe a medida para o campo próprio.`);
    }
  }
  return e;
}

export function memorialInicial(base: Partial<DadosMemorial> = {}): DadosMemorial {
  return {
    proprietario: "", cpfCnpj: "", obra: "", endereco: "", municipio: "", matricula: "", inscricaoMunicipal: "", tipoObra: "", rrt: "",
    areaTerreno: null, areaAConstruir: null, areaExistenteReformada: null, areaExistenteMantida: null,
    taxaOcupacao: "", coeficienteAproveitamento: "", taxaPermeabilidade: "", ajusteMunicipio: "",
    servicos: {}, esquadrias: [], ambientes: [], data: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), leituraConfirmada: false, ...base,
  };
}
export const acabamentoVazio = (): Acabamento => ({ tipo: "", marca: "", modelo: "", medida: "" });
