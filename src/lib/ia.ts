// Leitura aproximada da planta pela API do Claude (visão). Só roda no servidor; a chave fica no .env.local.
// A leitura NUNCA vai direto para o documento: o usuário confere e confirma a lista de ambientes.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY;

const Leitura = z.object({
  ambientes: z.array(z.object({
    nome: z.string(),
    areaM2: z.number().nullable(),
  })),
  observacoes: z.string(),
});
export type LeituraPlanta = z.infer<typeof Leitura>;

const INSTRUCAO =
  "Esta é a planta baixa de um projeto de arquitetura brasileiro. Liste os ambientes que aparecem nomeados na planta, " +
  "na ordem em que um memorial descritivo os listaria. Para cada ambiente, informe a área em m² somente se ela estiver " +
  "escrita na planta; se não estiver escrita, use null (não estime nem calcule). Não inclua ambientes que você não consegue ler. " +
  "Em observacoes, diga em uma ou duas frases o que ficou ilegível ou duvidoso, em português do Brasil.";

export async function lerPlanta(arquivo: Buffer, mime: string): Promise<LeituraPlanta> {
  const client = new Anthropic();
  const dados = arquivo.toString("base64");
  const bloco = mime === "application/pdf"
    ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: dados } } as const)
    : ({ type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: dados } } as const);
  const resposta = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    messages: [{ role: "user", content: [bloco, { type: "text", text: INSTRUCAO }] }],
    output_config: { format: zodOutputFormat(Leitura) },
  });
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) throw new Error("A leitura automática não devolveu resultado. Preencha os ambientes à mão.");
  return resposta.parsed_output;
}

// ---------- Leitura das áreas molhadas (banheiros e lavabos) ----------
// Devolve os ambientes já no modelo do sistema. É uma leitura aproximada: o usuário compara o desenho gerado com a planta antes de gerar as pranchas.
const ParedeZ = z.enum(["N", "S", "L", "O"]);
const AmbienteLido = z.object({
  nome: z.string(),
  largura: z.number(),
  comprimento: z.number(),
  espessuraParede: z.number(),
  porta: z.object({ parede: ParedeZ, inicio: z.number(), largura: z.number(), abre: z.enum(["dentro", "fora"]), dobradica: z.enum(["inicio", "fim"]) }).nullable(),
  box: z.object({ parede: ParedeZ, profundidade: z.number() }).nullable(),
  chuveiro: z.object({ parede: ParedeZ, pos: z.number(), registros: z.number() }).nullable(),
  ralo: z.object({ x: z.number(), y: z.number() }).nullable(),
  vasos: z.array(z.object({ parede: ParedeZ, eixo: z.number() })),
  bancadas: z.array(z.object({ parede: ParedeZ, inicio: z.number(), comprimento: z.number(), profundidade: z.number(), cubas: z.array(z.number()) })),
  observacoesLeitura: z.string(),
});
const LeituraMolhadas = z.object({ escala: z.string(), ambientes: z.array(AmbienteLido), observacoes: z.string() });
export type LeituraAreasMolhadas = z.infer<typeof LeituraMolhadas>;

const INSTRUCAO_MOLHADAS = `Esta é a planta baixa de um projeto de arquitetura brasileiro. Leia SOMENTE os banheiros, lavabos e BWCs (ambientes com vaso sanitário, lavatório ou chuveiro) e devolva cada um no modelo abaixo. Medidas em metros.

Sistema de coordenadas de cada ambiente: origem no canto interno superior esquerdo da planta como ela está na imagem; "N" é a parede de cima, "S" a de baixo, "O" a da esquerda e "L" a da direita. "largura" é a medida interna horizontal na imagem; "comprimento" é a medida interna vertical. Posições ao longo das paredes N e S são medidas a partir da parede O (esquerda); posições ao longo das paredes O e L são medidas a partir da parede N (cima).

Para cada ambiente:
- nome: como está escrito na planta (ex.: "BWC 1", "Lavabo").
- largura e comprimento: medidas internas. Use as cotas escritas. Se não houver cota, meça pela escala da planta usando uma medida cotada como referência.
- espessuraParede: use 0.15 se não der para ler.
- porta: parede em que está, "inicio" (distância do começo da parede até o começo do vão), "largura" do vão, se abre para "dentro" ou para "fora" do ambiente e se a dobradiça está no lado do "inicio" ou do "fim" do vão. null se não houver.
- box: se houver box de chuveiro, a parede em que a faixa do box encosta e a "profundidade" da faixa (o box vai de ponta a ponta dessa parede). null se não houver.
- chuveiro: parede em que está fixado e "pos" ao longo dela; "registros" = 1 ou 2. null se não houver.
- ralo: posição x (a partir da parede O) e y (a partir da parede N). null se não aparecer.
- vasos: para cada vaso sanitário, a parede em que encosta e o "eixo" (posição do centro do vaso ao longo dessa parede).
- bancadas: para cada bancada de lavatório, a parede em que encosta pelo fundo, "inicio" ao longo da parede, "comprimento", "profundidade" e "cubas" (posição do eixo de cada cuba medida a partir do início da bancada).
- observacoesLeitura: o que ficou duvidoso ou foi medido pela escala em vez de cota, em português.

Não invente peças que não estão desenhadas. Se uma medida for estimada pela escala, diga isso em observacoesLeitura. Em "escala", escreva a escala indicada na planta ou "não indicada". Ambientes que não sejam retangulares: descreva o retângulo principal e avise em observacoesLeitura.`;

export async function lerAreasMolhadas(arquivo: Buffer, mime: string): Promise<LeituraAreasMolhadas> {
  const client = new Anthropic();
  const dados = arquivo.toString("base64");
  const bloco = mime === "application/pdf"
    ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: dados } } as const)
    : ({ type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: dados } } as const);
  const resposta = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(LeituraMolhadas) },
    messages: [{ role: "user", content: [bloco, { type: "text", text: INSTRUCAO_MOLHADAS }] }],
  });
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) throw new Error("A leitura automática não devolveu resultado.");
  return resposta.parsed_output;
}
