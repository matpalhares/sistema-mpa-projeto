// Download de arquivos. Só entrega arquivos da empresa do usuário logado.
import { lerArquivo } from "@/lib/arquivos";
import { contexto } from "@/lib/sessao";

const TIPOS: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", json: "application/json",
};

export async function GET(req: Request) {
  const { empresas } = await contexto();
  const url = new URL(req.url);
  const c = url.searchParams.get("c") ?? "";
  if (c.includes("..") || !empresas.some((e) => c.startsWith(e.id + "/"))) return new Response("Sem acesso", { status: 403 });
  const buf = await lerArquivo(c);
  if (!buf) return new Response("Arquivo não encontrado", { status: 404 });
  const nome = c.split("/").pop()!.replace(/^\d{13}_/, "");
  const ext = nome.split(".").pop()!.toLowerCase();
  const ver = url.searchParams.get("ver") === "1" && ["pdf", "png", "jpg", "jpeg", "webp"].includes(ext);
  return new Response(new Uint8Array(buf), { headers: {
    "Content-Type": TIPOS[ext] ?? "application/octet-stream",
    "Content-Disposition": `${ver ? "inline" : "attachment"}; filename="${nome}"`,
    "Cache-Control": "private, no-store",
  } });
}
