// Regras puras da proposta (usadas na tela e no servidor).
import type { DadosProposta } from "../tipos";

export interface CalculoPagamento { aVista: number | null; parcelaSemJuros: number | null }
export function calcularPagamento(d: DadosProposta): CalculoPagamento {
  if (d.valorTotal == null) return { aVista: null, parcelaSemJuros: null };
  const aVista = Math.round(d.valorTotal * (1 - d.descontoAVista / 100) * 100) / 100;
  const parcelaSemJuros = d.parcelasSemJuros > 0 ? Math.round((d.valorTotal / d.parcelasSemJuros) * 100) / 100 : null;
  return { aVista, parcelaSemJuros };
}

export function pendenciasProposta(d: DadosProposta): string[] {
  const f: string[] = [];
  if (!d.perfil) f.push("Para quem é a proposta (comércio ou residência)");
  if (!d.clienteNome.trim()) f.push("Nome do cliente");
  if (!d.objetivo.trim()) f.push("Projeto (objetivo da proposta)");
  if (!d.tipoContratacao.trim()) f.push("Tipo de contratação");
  if (d.escopo.filter((e) => e.titulo.trim()).length === 0) f.push("Itens do escopo");
  if (d.etapas.some((e) => e.titulo.trim() && e.itens.filter((i) => i.trim()).length === 0)) f.push("Itens de alguma etapa");
  if (d.valorTotal == null) f.push("Valor do investimento");
  if (d.validadeDias == null) f.push("Validade da proposta");
  if (d.itensExtras.some((i) => i.descricao.trim() && i.valor == null)) f.push("Valor de item extra");
  return f;
}

const temPreco = (t: string) => /R\$\s*\d|\d+\s*reais/i.test(t);
export function errosProposta(d: DadosProposta): string[] {
  const e: string[] = [];
  const n = d.etapas.filter((x) => x.titulo.trim()).length;
  if (n < 4 || n > 6) e.push(`A proposta precisa ter de 4 a 6 etapas (hoje tem ${n}).`);
  if (d.diferenciais.some((x) => temPreco(x.titulo + " " + x.texto))) e.push('A seção "Por que investir em um bom projeto" não pode citar preço.');
  if (d.valorTotal != null && d.valorTotal <= 0) e.push("O valor do investimento precisa ser maior que zero.");
  if (d.escopo.filter((x) => x.titulo.trim()).length > 10) e.push("O escopo cabe em uma página com até 10 itens. Junte itens parecidos.");
  return e;
}
