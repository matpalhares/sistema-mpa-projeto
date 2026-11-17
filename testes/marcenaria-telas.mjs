// Teste da marcenaria pela tela (precisa do app rodando com o projeto de demonstração e a planta).
// Uso: node testes/marcenaria-telas.mjs http://localhost:3000 <arquivo _marcenaria.json> [pasta-de-prints]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [base, json, prints] = process.argv.slice(2);
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
await pg.click("a:has-text('Recriarte')");
await pg.waitForURL(/projetos\//);
await pg.goto(pg.url().split("?")[0] + "?aba=detalhamentos");
await pg.click("button:has-text('Detalhar marcenaria')");
await pg.waitForURL(/marcenaria\//);
conferir("abre a tela de marcenaria com o link do plugin", (await pg.locator("a[href='/plugin/MPA_exportar_marcenaria.rb']").count()) === 1);
conferir("plugin disponível para baixar", (await pg.request.get(base + "/plugin/MPA_exportar_marcenaria.rb")).ok());
// 1. SketchUp
await pg.setInputFiles("input[name=arquivo]", json);
await pg.selectOption("select[name=categoria]", "sketchup");
await pg.click("button:has-text('Enviar')");
await pg.waitForSelector("button:has-text('Ler o modelo')");
await pg.click("button:has-text('Ler o modelo')");
await pg.waitForSelector("text=/Li 1 móvel/", { timeout: 60000 });
conferir("lê o móvel do SketchUp com as medidas", (await pg.locator("body").innerText()).includes("1800 x 550 x 850 mm"));
conferir("mostra a perspectiva do móvel lido", (await pg.locator("img[alt^='Perspectiva do móvel']").count()) === 1);
conferir("sem respostas, o botão de gerar fica travado e lista o que falta", (await pg.locator("button:has-text('Gerar pranchas e planilha')").isDisabled()) && (await pg.locator("body").innerText()).includes("Qual o puxador?"));
// 2. móvel pela planta
await pg.click("button:has-text('Ler a planta')");
await pg.waitForSelector("text=/Ambientes lidos/", { timeout: 90000 });
await pg.click("button:has-text('+ Adicionar móvel por medidas')");
const amb = (await pg.locator("datalist option").first().getAttribute("value")) ?? "";
await pg.fill("input[list='amb-0']", amb);
const medir = pg.locator("button:has-text('Medir na planta')");
if (await medir.count()) {
  await medir.click();
  const svg = pg.locator("svg[aria-label='Planta para medir o móvel']"); await svg.waitFor({ timeout: 90000 }); await svg.scrollIntoViewIfNeeded();
  const c = await svg.boundingBox(); await pg.mouse.click(c.x + 100, c.y + 100); await pg.mouse.click(c.x + 298, c.y + 166);
  const L = await pg.locator("label:has-text('Largura (mm)') input").first().inputValue(), P = await pg.locator("label:has-text('Profundidade (mm)') input").first().inputValue();
  conferir(`dois cliques na planta preenchem largura e profundidade (${L} x ${P} mm)`, Number(L) === 1800 && Number(P) === 600);
  if (prints) await pg.screenshot({ path: `${prints}/marcenaria-medir.png` });
} else conferir("planta com escala: botão de medir aparece", false);
await pg.locator("label:has-text('Altura (mm)') input").first().fill("850");
const movel = pg.locator("div.rounded-xl", { has: pg.locator("input[list='amb-0']") });
await movel.locator("button.opcao:has-text('Sim')").nth(0).click(); await movel.locator("button.opcao:has-text('Sim')").nth(1).click();
await movel.locator("label:has-text('Altura do rodapé') input").fill("100"); await movel.locator("label:has-text('Recuo do rodapé') input").fill("50");
await movel.locator("button.opcao:has-text('Portas')").click(); await movel.locator("button.opcao", { hasText: /^2$/ }).first().click();
await movel.locator("button:has-text('+ Módulo')").click(); await movel.locator("button.opcao:has-text('Gavetas')").nth(1).click(); await movel.locator("button.opcao", { hasText: /^3$/ }).last().click();
// 3. perguntas
const escolher = async (t) => pg.locator("section", { hasText: "Perguntas antes de detalhar" }).locator("button.opcao", { hasText: new RegExp(`^${t}$`) }).first().click();
await escolher("18 mm"); await pg.fill("input[placeholder='ex.: MDF Branco TX']", "MDF Branco TX"); await pg.fill("input[placeholder='ex.: MDF Freijó']", "MDF Freijó");
await pg.locator("section", { hasText: "Perguntas antes de detalhar" }).locator("button.opcao:has-text('Sim')").click();
await escolher("Sobrepostas"); await escolher("Cava \\(sem puxador\\)"); await escolher("Telescópica"); await escolher("Com amortecimento");
await pg.locator("label:has-text('Altura das laterais das gavetas') input").fill("120");
conferir("desenho de frente do móvel por medidas aparece", (await pg.locator("svg[aria-label^='Frente do móvel']").count()) === 1);
conferir("sem marcar a conferência, não gera", await pg.locator("button:has-text('Gerar pranchas e planilha')").isDisabled());
await pg.check("input[type=checkbox]");
await pg.click("button:has-text('Gerar pranchas e planilha')");
await pg.waitForSelector("text=/Pranchas e planilha geradas/", { timeout: 120000 });
const txt = await pg.locator("aside").innerText();
conferir("gera o PDF e a planilha", /Abrir as pranchas \(PDF, \d+ folhas\)/.test(txt) && txt.includes("Baixar a planilha"));
conferir("conferência: nenhum texto ou cota sobreposto", txt.includes("nenhum texto ou cota sobreposto"));
conferir("avisa que o móvel por medidas é estimativa", txt.includes("ESTIMATIVA"));
const pdf = await pg.request.get(base + (await pg.locator("a:has-text('Abrir as pranchas')").getAttribute("href")));
conferir("o PDF abre", pdf.ok() && (await pdf.body()).subarray(0, 4).toString() === "%PDF");
if (prints) { await pg.screenshot({ path: `${prints}/marcenaria-tela.png`, fullPage: true }); (await import("node:fs")).writeFileSync(`${prints}/marcenaria.pdf`, await pdf.body()); }
conferir("sem erro de página", erros.length === 0); if (erros.length) console.log(erros);
await b.close();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
