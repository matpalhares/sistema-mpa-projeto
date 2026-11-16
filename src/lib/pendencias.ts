// "Falta preencher": pendências sempre visíveis. Nada é assumido: o que falta aparece aqui.
import type { Cliente, Empresa, Memorial, Projeto, Proposta } from "./tipos";
import { faltaNaMarca } from "./marca";
import { pendenciasProposta } from "./documentos/regras-proposta";
import { pendenciasMemorial } from "./documentos/regras-memorial";

export interface Pendencia { texto: string; link: string; onde: string }

export function pendenciasProjeto(p: Projeto, cliente: Cliente | null): Pendencia[] {
  const l: Pendencia[] = [];
  const link = `/projetos/${p.id}`;
  const add = (texto: string) => l.push({ texto, link: link + "?aba=dados", onde: p.obra });
  if (!p.endereco.trim()) add("Endereço da obra");
  if (!p.municipio.trim()) add("Município");
  if (!p.tipo.trim()) add("Tipo de projeto");
  if (p.areaM2 == null) add("Área do projeto");
  if (p.contratouExecucao == null) add("O cliente contratou a execução da obra?");
  if (!p.contrato.trim()) add("Número ou referência do contrato");
  if (cliente && !cliente.telefone.trim()) add("Telefone do cliente");
  return l;
}

export function pendenciasGerais(empresa: Empresa, projetos: Projeto[], clientes: Cliente[], propostas: Proposta[], memoriais: Memorial[]): Pendencia[] {
  const l: Pendencia[] = [];
  if (!empresa.marca.definida) l.push({ texto: `Marca da ${empresa.sigla}: ${faltaNaMarca(empresa.marca).join(", ")}`, link: "/empresas", onde: "Empresas e marcas" });
  for (const p of projetos.filter((x) => !x.arquivado)) l.push(...pendenciasProjeto(p, clientes.find((c) => c.id === p.clienteId) ?? null));
  for (const pr of propostas.filter((x) => x.status === "rascunho")) {
    for (const t of pendenciasProposta(pr.dados)) l.push({ texto: t, link: `/propostas/${pr.id}`, onde: `Proposta ${pr.dados.clienteNome || "sem cliente"}` });
  }
  for (const m of memoriais) {
    const n = pendenciasMemorial(m.dados, "simplificado").length;
    if (n) l.push({ texto: `${n} campo(s) a definir`, link: `/memoriais/${m.id}`, onde: `Memorial ${m.dados.obra || ""}` });
  }
  return l;
}
