# Sistema MPA Projeto

Projetos, propostas, memoriais e detalhamentos do escritório. Fase 1 concluída (base e documentos); Fase 2 em andamento (detalhamentos).

## O que já funciona

- Login por e-mail e senha, com as quatro empresas (MPA pronta; LM, Matelli e MPX com marca "a definir").
- Painel em cards, com busca de projetos e a lista "Falta preencher".
- Projetos com as 13 etapas, arquivos (planta, SketchUp, contrato) e a regra da execução:
  as abas Orçamento de obra e Cronograma só aparecem se o cliente contratou a execução.
- Proposta comercial em DOCX e PDF no modelo visual aprovado (Proposta Cris Bebidas), com revisão automática de paginação.
- Memorial descritivo completo e simplificado (prefeitura), em DOCX e PDF.
- Áreas molhadas a partir da planta (Fase 2): o sistema lê os banheiros da planta (precisa da chave do Claude), você confere o desenho de cada ambiente e responde as perguntas obrigatórias (pedra, cuba, torneira, vaso, barras de acessibilidade, espelho, box, revestimentos). Saem o executivo A3 de cada ambiente (planta cotada, vistas, detalhe da bancada, quadro de pontos, notas, carimbo e perspectiva) e a marmoraria de cada bancada. As barras de apoio são locadas pela ABNT NBR 9050:2020, itens 7.6 e 7.7.2.2.
- Marmoraria avulsa (Fase 2): prancha A4 da bancada com vista superior cotada, vista frontal, corte, perspectiva, fixação e lista de peças. O sistema só gera depois de responder pedra, cuba, torneira e medidas, e confere sozinho se algum texto ou cota ficou sobreposto.

## Como abrir no seu computador

Instale uma vez:

1. **Node.js** (versão LTS): https://nodejs.org
2. **LibreOffice** (gera os PDFs): https://pt-br.libreoffice.org
3. **Fonte Montserrat**: abra a pasta `recursos/fontes`, selecione os arquivos `.ttf` e clique em Instalar.
   Sem ela o PDF sai com outra fonte.

Depois:

- **Windows:** clique duas vezes em `iniciar.bat`.
- **Mac:** clique duas vezes em `iniciar.command`.

O navegador abre em http://localhost:3000. No primeiro acesso você cria o seu usuário.
Para fechar, feche a janela preta que ficou aberta.

## Onde ficam os dados

Sem configuração nenhuma, tudo fica na pasta `dados` (banco e arquivos). **Faça cópia dessa pasta**: ela é o seu backup.

## Ligar a leitura automática da planta (opcional)

1. Crie uma conta em https://console.anthropic.com e gere uma chave em "API Keys". O uso é pago por consumo; o preço está em https://www.anthropic.com/pricing.
2. Copie o arquivo `.env.exemplo` com o nome `.env.local` e cole a chave depois de `ANTHROPIC_API_KEY=`.
3. Feche e abra o sistema de novo.

Sem a chave, você adiciona os ambientes do memorial à mão. A leitura é sempre aproximada e precisa da sua conferência.

## Ligar o Supabase (opcional, para dados na nuvem)

1. Crie um projeto em https://supabase.com (há plano gratuito; confira os limites em https://supabase.com/pricing).
2. Em SQL Editor, cole o conteúdo de `supabase/esquema.sql` e clique em Run.
3. Em Project Settings > API, copie a "Project URL" e a chave "service_role".
4. Cole as duas no `.env.local` (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`) e reabra o sistema.

Atenção: o modo Supabase foi escrito, mas ainda **não foi testado com uma conta real**. Teste com um projeto de exemplo antes de usar.
Os dados da pasta `dados` não migram sozinhos para o Supabase.

## Testes

- `npm run teste`: testes de aceite dos documentos (T07 proposta, T08 memorial simplificado, T09 marmoraria).
- `node testes/telas.mjs http://localhost:3000`: teste das telas pelo navegador, incluindo o T10. Use em uma instalação vazia (ele cria o primeiro usuário) e precisa do Playwright instalado.

## Próximas entregas

- **Fase 2 (em andamento):** marcenaria com o plugin do SketchUp; cozinhas e copas com equipamentos e banheiros com cabines no executivo; barras do lavatório acessível.
- **Fase 3:** gestão da obra (cronograma, relatório fotográfico, comparativo, financeiro e recibos).
