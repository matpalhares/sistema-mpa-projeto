# Sistema MPA Projeto: imagem para hospedagem (Railway, Render, Fly.io ou servidor próprio).
# Os dados ficam em /dados: ligue um volume (disco persistente) nesse caminho para não perder nada ao atualizar.
FROM node:22-bookworm-slim

# LibreOffice gera os PDFs das propostas e memoriais
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-writer fontconfig ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# A fonte Montserrat precisa estar instalada para o LibreOffice usar nos PDFs
RUN mkdir -p /usr/share/fonts/truetype/montserrat \
 && cp recursos/fontes/*.ttf /usr/share/fonts/truetype/montserrat/ \
 && fc-cache -f \
 && npm run build

ENV NODE_ENV=production \
    MPA_PASTA_DADOS=/dados \
    MPA_HTTPS=1 \
    HOME=/tmp \
    PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT}"]
