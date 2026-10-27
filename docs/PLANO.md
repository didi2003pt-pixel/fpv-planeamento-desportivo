# Plano incremental

## INC-001 — Base técnica e demonstração visual
- [x] Branch dedicada, documentação e modelo de dados inicial.
- [x] Docker Compose, API com healthcheck e frontend de demonstração.
- [ ] Confirmar build no GitHub Actions.
- [ ] Revisão e testes locais antes de integrar.
- [ ] Nada de dados reais nem autenticação aparente.

## INC-002 — Persistência e autenticação
- Migração inicial PostgreSQL.
- Acesso individual real: administrador, coordenador, treinador e consulta.
- Permissões por classe verificadas no backend.
- Testes automáticos de controlo de acesso.

## INC-003 — Gestão de planeamentos
- Catálogo de classes, treinadores e atletas.
- CRUD de atividades multi-dia, participantes nominais, número previsto.
- Planeamento anual, confirmação mensal, execução e histórico.

## INC-004 — Calendário real e Excel
- Ligação frontend à API, filtros e vistas mês/ano.
- Excel detalhado e Excel de calendário visual, condicionados às permissões.

## INC-005 — Migração assistida e piloto
- Importador da folha Excel, validação de datas e controlo de ambiguidades.
- Piloto com classes e treinadores selecionados, recolha de feedback.
- Revisão de segurança, backups, RGPD e preparação para produção.

**Regra de execução:** cada incremento em branch/PR, teste e aceitação antes de juntar à `main`.
