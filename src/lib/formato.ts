export const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const numero = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export function dataBR(iso: string) {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function dataExtenso(iso: string) {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
export function somarDias(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
export const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // UTC-03:00
// Regra da marca: sem travessão longo. Troca por vírgula (ou hífen entre números).
export function semTravessao(t: string) {
  return t.replace(/\s*[—―]\s*/g, ", ").replace(/(\d)\s*–\s*(\d)/g, "$1 a $2").replace(/\s*–\s*/g, ", ");
}
export const temTravessao = (t: string) => /[—―–]/.test(t);
