// Planilha (.xlsx) da marcenaria: peças, ferragens, fita de borda e chapas.
import ExcelJS from "exceljs";
import { PADRAO_MARC, type Chapa, type Ferragem, type ItemLista } from "./modelo";

export async function planilhaMarcenaria(itens: ItemLista[], ferr: Ferragem[], chapas: Chapa[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = "Sistema MPA Projeto";
  const aba = (nome: string, colunas: [string, number][], linhas: (string | number)[][]) => {
    const ws = wb.addWorksheet(nome);
    ws.columns = colunas.map(([header, width]) => ({ header, width }));
    const cab = ws.getRow(1); cab.font = { bold: true, color: { argb: "FFFFFFFF" } }; cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2F63" } };
    for (const l of linhas) ws.addRow(l);
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  aba("Peças", [["Item", 7], ["Móvel", 28], ["Peça", 28], ["Qtd", 7], ["Comprimento (mm)", 18], ["Largura (mm)", 14], ["Espessura (mm)", 15], ["Material", 30], ["Fita de borda", 18], ["Tipo deduzido?", 15]],
    itens.map((i) => [i.item, i.movel, i.nome, i.qtd, i.C, i.L, i.E, i.material, i.fita, i.deduzido ? "sim, conferir" : ""]));
  aba("Ferragens", [["Móvel", 28], ["Ferragem", 50], ["Qtd", 7], ["De onde veio", 24]], ferr.map((f) => [f.movel, f.nome, f.qtd, f.origem === "modelo" ? "modelado no SketchUp" : "calculado por regra"]));
  const fita = new Map<string, number>(); for (const i of itens) if (i.fitaM) fita.set(i.material, (fita.get(i.material) ?? 0) + i.fitaM);
  aba("Fita de borda", [["Material", 30], ["Metros", 12]], [...fita].map(([m, v]) => [m, Math.round(v * 100) / 100]));
  const porMat = new Map<string, { n: number; ap: number }>(); for (const c of chapas) { const k = `${c.material}, ${c.esp} mm`; const o = porMat.get(k) ?? { n: 0, ap: 0 }; o.n++; o.ap += c.aproveitamento; porMat.set(k, o); }
  aba("Chapas", [["Material", 34], [`Chapas ${PADRAO_MARC.chapaC} x ${PADRAO_MARC.chapaL} mm`, 26], ["Aproveitamento médio", 22]], [...porMat].map(([m, o]) => [m, o.n, Math.round((o.ap / o.n) * 100) + "%"]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
