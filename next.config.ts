import type { NextConfig } from "next";

// Só para rodar atrás de um endereço de prévia (proxy): lista de domínios aceitos nas ações, separados por vírgula.
const origens = (process.env.MPA_ORIGENS ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  ...(origens.length ? { experimental: { serverActions: { allowedOrigins: origens } } } : {}),
  serverExternalPackages: ["pdfjs-dist", "docx", "sharp", "pdfkit", "@napi-rs/canvas"],
  outputFileTracingIncludes: { "/**": ["./recursos/**"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
