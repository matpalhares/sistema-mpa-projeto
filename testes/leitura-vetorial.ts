// Teste manual: npx tsx testes/leitura-vetorial.ts <planta.pdf> [pasta de saída dos recortes]
import fs from "node:fs";
import { lerPlantaVetorial, recortarAmbientes } from "../src/lib/leitura-vetorial";

(async () => {
  const pdf = fs.readFileSync(process.argv[2]);
  const t0 = Date.now();
  const l = await lerPlantaVetorial(pdf);
  console.log("ok:", l.ok, l.motivo ?? "", "|", l.observacoes, `(${Date.now() - t0} ms)`);
  console.log("rótulos:", l.rotulos.map((r) => r.nome).join(" | "));
  for (const a of l.ambientes) console.log(JSON.stringify(a.ambiente));
  if (process.argv[3] && l.ambientes.length) {
    const t = Date.now(), rs = await recortarAmbientes(pdf, l.ambientes);
    rs.forEach((r, i) => fs.writeFileSync(`${process.argv[3]}/${l.ambientes[i].ambiente.nome.replace(/\W+/g, "_")}.png`, r.png));
    console.log("recortes:", rs.map((r) => `${r.largura}x${r.altura}`).join(", "), `${Date.now() - t} ms`);
  }
})();
