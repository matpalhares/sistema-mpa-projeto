import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistema MPA Projeto", short_name: "MPA Projeto", lang: "pt-BR",
    description: "Projetos, propostas e memoriais",
    start_url: "/", display: "standalone", background_color: "#F7F4EE", theme_color: "#0D2F63",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
