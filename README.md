# FPV Planeamento Desportivo

Plataforma de planeamento desportivo para a Federação Portuguesa de Vela.

> **Em desenvolvimento — não é uma aplicação oficial pronta para produção.**
> Nunca utilizar dados pessoais reais enquanto a autenticação e as permissões no servidor não estiverem concluídas.

## Objetivo
Os treinadores registam os seus planeamentos por classe, incluindo tipo de atividade, datas, local, número previsto de atletas e participantes. A Federação consulta um calendário central e acompanha o planeado, confirmado e realizado. O sistema exportará calendários e dados para Excel.

## Arquitetura
- Web: React + TypeScript + Vite + FullCalendar.
- API: NestJS + TypeScript.
- Persistência: PostgreSQL + Prisma (modelo inicial; migrações e endpoints de negócio serão desenvolvidos na próxima fase).
- Exportação: ExcelJS.
- Ambiente local: Docker Compose.
- Fluxo de trabalho: branches e Pull Requests; nunca integrar em `main` sem revisão.

## Estado do incremento 001
- Interface visual inicial de **demonstração**, sem login real nem armazenamento de atividades.
- API de saúde em `GET /api/health`; não expõe dados de atletas.
- Modelo relacional inicial em `apps/api/prisma/schema.prisma`.
- Docker Compose com PostgreSQL, API e frontend.
- Requisitos e próximos incrementos em `docs/`.

## Arranque local (quando for validado)
1. Instalar Docker Desktop (com Docker Compose).
2. Copiar `.env.example` para `.env` e escolher uma password local forte, sem caracteres reservados numa URL.
3. Executar `docker compose up --build -d`.
4. Abrir `http://localhost:8080` (ou a porta definida em `APP_PORT`).
5. Verificar `http://localhost:8080/api/health`.
6. Para ver os registos, executar `docker compose logs -f api web`.
7. Para parar, executar `docker compose down` (sem `-v`, para preservar o volume de dados).

**Importante:** o PostgreSQL desta fase ainda não recebe migrações de produção nem utilizadores; a interface apresenta dados fictícios. Não utilizar o protótipo para recolha de dados reais.

## Trabalho seguinte
- Rever regras de acesso e modelo de planeamento.
- Implementar migração inicial e autenticação segura.
- Implementar CRUD de atividades, atribuição de classes e participantes.
- Substituir dados fictícios por API autenticada.
- Exportação Excel do calendário em formato visual e relatórios.
- Validar permissões, backup, RGPD e testes de aceitação.

Ver [Requisitos](docs/REQUISITOS.md), [Decisões](docs/DECISOES.md) e [Plano](docs/PLANO.md).

## Demonstração online — GitHub Pages

- Publicação **estática** por GitHub Actions, sem serviço de API nem base de dados online.
- URL prevista: https://didi2003pt-pixel.github.io/fpv-planeamento-desportivo/
- Quando a publicação estiver configurada no repositório, cada push à `main` volta a publicar a demonstração.
- Caso ainda não esteja ativado: `Settings > Pages > Build and deployment > Source > GitHub Actions`.
- O build usa `vite build --mode pages`, que define a base `/fpv-planeamento-desportivo/` para os recursos JS/CSS.
- **Funciona:** calendário, filtros, visualização e exportação de um Excel com **dados fictícios**.
- **Não funciona:** login, guardar/partilhar dados, API de produção, ficheiros Excel reais da Federação ou edição por treinadores.
- Nunca colocar nomes reais de atletas em dados de demonstração no repositório público.

O código permite continuar a usar Docker localmente, pois o build padrão não usa o modo `pages`.


## Exportação conforme a lógica do Excel de 2026
O botão **Exportar Excel** gera agora `Mapa Classes 01` a `Mapa Classes 12` conforme o mês ou ano selecionado, **como primeiras folhas** da exportação, com os 17 grupos de referência, linhas por tipo, dias de 1 a 31, totais calculados por dia-classe e cores diferenciadas. Mantém também `Atividades` e `Calendário MM`. O mapa distingue eventos cancelados com × e impede dupla contagem no resumo da classe. Os mapas continuam fictícios até existir a API segura da aplicação. Testar com `cd apps/web && npm run test:mapa`.

## INC-005 — formulário de criação em demonstração pública

No GitHub Pages, o botão **Nova atividade** (ou um clique num dia do calendário) permite experimentar um formulário com classe, tipo, datas inclusivas, local, estado, número previsto de atletas e nomes fictícios indicados linha a linha. O novo evento aparece de imediato no calendário e participa nas exportações Excel da **sessão atual**.

**Não existe gravação:** atualizar ou fechar a página elimina os eventos criados nesta sessão. Não há autenticação real nem partilha entre utilizadores. Nunca introduzir nomes ou dados pessoais reais no protótipo público. A implementação definitiva exigirá um backend autenticado e base de dados com permissões por classe.

Validação automática: título obrigatório, classe existente, datas válidas e ordenadas, número previsto inteiro não negativo, máximo de 200 atletas, não permitir mais nomes do que previstos nem nomes duplicados. Testes: `cd apps/web && npm run test:form`.

Não se alterou a estrutura do Excel: as novas atividades entram no **Mapa Classes**, na lista de **Atividades** e no calendário visual já aprovado.
