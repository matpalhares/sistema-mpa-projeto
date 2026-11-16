// Teste da leitura sem chave pela tela (precisa do app rodando com o projeto de demonstração).
// Uso: node testes/leitura-telas.mjs http://localhost:3000 <id do conjunto de áreas molhadas> [pasta-de-prints]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [base, id, prints] = process.argv.slice(2);
let falhas = 0;
const conferir = (nome, ok) => { console.log(`${ok ? "  ✓" : "  ✕"} ${nome}`); if (!ok) falhas++; };
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const erros = []; pg.on("pageerror", (e) => erros.push(e.message));
await pg.goto(base);
if (pg.url().includes("/primeiro-acesso")) {
  await pg.fill("input[name=nome]", "Usuário de Teste"); await pg.fill("input[name=email]", "teste@exemplo.com"); await pg.fill("input[name=senha]", "senha-de-teste");
  await pg.click("button:has-text('Criar meu usuário')"); await pg.waitForURL(base + "/");
}
if (pg.url().includes("/login")) { await pg.fill("input[name=email]", "teste@exemplo.com"); await pg.fill("input[name=senha]", "senha-de-teste"); await pg.click("button:has-text('Entrar')"); await pg.waitForURL(base + "/"); }
await pg.goto(`${base}/areas-molhadas/${id}`);
await pg.click("button:has-text('Ler a planta e montar os ambientes')");
await pg.waitForSelector("text=/Li 5 ambiente/", { timeout: 90000 });
conferir("leu 5 ambientes sem a chave", (await pg.locator("svg[aria-label^='Marcar peças']").count()) === 5);
const pne = pg.locator("section", { has: pg.locator("input[value='BWC PNE']") });
conferir("BWC PNE: 1,6 x 1,5 m", (await pne.innerText()).includes("1,6 x 1,5 m"));
conferir("BWC PNE: avisa da cota 1,70 diferente do traço", (await pne.innerText()).includes("1,70"));
const svg = pne.locator("svg[aria-label^='Marcar peças']");
await svg.scrollIntoViewIfNeeded();
const clicar = async (fx, fy) => { const c = await svg.boundingBox(); await pg.mouse.click(c.x + c.width * fx, c.y + c.height * fy); };
await pne.locator("button.opcao:has-text('+ Vaso')").click(); await clicar(0.33, 0.43); // vaso junto da parede da esquerda
conferir("vaso marcado com um clique", (await pne.innerText()).includes("Vaso na parede da esquerda"));
await pne.locator("button.opcao:has-text('+ Bancada')").click(); await clicar(0.68, 0.25); await clicar(0.79, 0.4);
conferir("bancada marcada com dois cliques", /Bancada 0,\d\d x 0,\d\d m/.test(await pne.innerText()));
await clicar(0.74, 0.32); // a ferramenta passa sozinha para a cuba
conferir("cuba marcada em cima da bancada", (await pne.innerText()).includes("1 cuba(s)"));
conferir("pergunta das barras de acessibilidade aparece", (await pne.innerText()).includes("Terá barras de acessibilidade"));
if (prints) await pne.screenshot({ path: `${prints}/leitura-pne.png` });
conferir("sem erro de página", erros.length === 0);
if (erros.length) console.log(erros);
await b.close();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
