// Regras puras da proposta (usadas na tela e no servidor).
import type { DadosProposta } from "../tipos";

export interface CalculoPagamento { aVista: number | null; parcelaSemJuros: number | null; totalComExtras: number | null }
export function calcularPagamento(d: DadosProposta): CalculoPagamento {
  if (d.valorTotal == null) return { aVista: null, parcelaSemJuros: null, totalComExtras: null };
  const aVista = Math.round(d.valorTotal * (1 - d.descontoAVista / 100) * 100) / 100;
  const parcelaSemJuros = d.parcelasSemJuros > 0 ? Math.round((d.valorTotal / d.parcelasSemJuros) * 100) / 100 : null;
  const extras = d.itensExtras.reduce((s, i) => s + (i.valor ?? 0), 0);
  return { aVista, parcelaSemJuros, totalComExtras: d.valorTotal + extras };
}

export function pendenciasProposta(d: DadosProposta): string[] {
  const f: string[] = [];
  if (!d.clienteNome.trim()) f.push("Nome do cliente");
  if (!d.objetivo.trim()) f.push("Objetivo da proposta");
  if (!d.tipoContratacao.trim()) f.push("Tipo de contratação");
  if (d.escopo.filter((e) => e.trim()).length === 0) f.push("Itens do escopo");
  if (d.valorTotal == null) f.push("Valor do investimento");
  if (d.validadeDias == null) f.push("Validade da proposta");
  if (d.etapas.some((e) => !e.prazo.trim())) f.push("Prazo de alguma etapa");
  if (d.itensExtras.some((i) => i.valor == null)) f.push("Valor de item extra");
  return f;
}

export function errosProposta(d: DadosProposta): string[] {
  const e: string[] = [];
  const n = d.etapas.filter((x) => x.titulo.trim()).length;
  if (n < 4 || n > 6) e.push(`A proposta precisa ter de 4 a 6 etapas (hoje tem ${n}).`);
  if (/R\$\s*\d|\d+\s*reais/i.test(d.porQueInvestir)) e.push('O texto "Por que investir em um bom projeto" não pode citar preço.');
  if (d.valorTotal != null && d.valorTotal <= 0) e.push("O valor do investimento precisa ser maior que zero.");
  return e;
}

