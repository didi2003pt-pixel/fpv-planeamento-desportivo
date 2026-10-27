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
