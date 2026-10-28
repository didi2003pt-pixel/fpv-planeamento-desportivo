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

## INC-008 — edição e cancelamento na demonstração

A partir do painel **Detalhes da atividade**, depois de clicar num evento no calendário:
- **Editar atividade**: alterar nome, classe, tipo, datas, local, estado, atletas previstos e nomes fictícios. O identificador e o treinador da atividade permanecem iguais.
- **Cancelar atividade**: pede confirmação, preserva os dados e altera o estado para cancelado. O mapa Excel assinala o cancelamento em vez de contabilizar os dias como ativos.
- **Reativar como previsto**: faz a operação inversa, atribuindo o estado **Previsto** (não recupera automaticamente o anterior estado Confirmado).
- Alterações refletem-se no calendário, filtros, detalhe e exportação Excel **da sessão atual**. A apresentação das 3 folhas do Excel aprovado não foi alterada.

**Limitação:** GitHub Pages é estático. Edições, cancelamentos e reativações são efémeros, sem conta, sem auditoria e sem persistência; tudo volta aos dados fictícios iniciais após recarregar a página. Não utilizar dados pessoais reais nem disponibilizar o sistema como ferramenta oficial de planeamento até existir backend autenticado e autorização por classe.

Validação de regras e integração: `cd apps/web && npm run test:form`.

## INC-009 — Treinadores e classes (simulação, sem login)
- A barra superior inclui **Vista (simulação)**: Federação (todas as classes) ou um treinador **fictício**.
- A vista do treinador apresenta atividades das classes que lhe estão atribuídas, oferece essas classes no formulário e exporta apenas as atividades visíveis para Excel.
- Na vista Federação, abrir **Treinadores e classes** para adicionar treinadores fictícios e associar/desassociar classes; uma classe pode estar associada a vários treinadores.
- Os nomes e atribuições são amostras inventadas que vivem apenas em memória. Alterações e novos treinadores desaparecem ao atualizar a página.
- Uma vista de treinador **não é autenticação nem proteção de dados**: qualquer visitante pode selecionar qualquer vista, voltar à Federação e consultar todos os exemplos. Não usar dados reais.
- O aspeto e código das três folhas Excel exportadas **não foram alterados**.

Para validar: `cd apps/web && npm run test:coaches`.

**Passo técnico necessário antes do uso real:** criar autenticação segura no backend e filtrar todas as consultas, alterações e exportações pelo âmbito autorizado na API; só então guardar treinadores, associações e atletas reais em PostgreSQL.

## INC-010 — indicadores do calendário alinhados com a navegação

Após revisão da gravação `teste 12.mp4`, verificou-se que, nos meses sem atividades (por exemplo, em 2027), os cartões de resumo continuavam a mostrar contagens globais de atividades de 2026, e o painel lateral continuava a mostrar uma atividade de um mês anterior.

**Correção limitada à interface:** contadores de atividades, classes, estágios e competições usam o mês/ano visível, com início incluído e fim exclusivo; o painel lateral só apresenta uma atividade desse período. O número junto dos filtros segue a mesma regra. Datas que atravessam meses contam em ambos os meses relevantes.

**Não foi alterado nenhum ficheiro da exportação Excel**, nem a estrutura das três folhas já aprovadas. Os dados continuam fictícios, apenas em memória.

Teste: `cd apps/web && npm run test:calendar`.
