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
