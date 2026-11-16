#!/bin/bash
# Sistema MPA Projeto: clique duas vezes para abrir (Mac).
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run build && (sleep 3 && open http://localhost:3000) & npm run start
