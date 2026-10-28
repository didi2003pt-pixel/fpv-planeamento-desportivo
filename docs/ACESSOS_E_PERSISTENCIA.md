# INC-012 — Infraestrutura privada da API

Esta etapa prepara a base real de utilizadores, sessões e PostgreSQL, **sem publicar um sistema de login no GitHub Pages** e **sem introduzir dados pessoais reais**.

## O que fica operacional ao executar o backend com Docker
- Migrações PostgreSQL versionadas aplicadas automaticamente no arranque da API (`prisma migrate deploy`).
- `GET /api/health` só devolve `status=ok` quando consegue consultar a base de dados.
- `POST /api/auth/login` (JSON: email/password) gera sessão aleatória, gravando só SHA-256 do token na base de dados.
- `GET /api/auth/me` exige cookie de sessão válido; devolve dados mínimos do utilizador e classes associadas.
- `POST /api/auth/logout` revoga a sessão no servidor.
- Passwords armazenadas com scrypt e salt aleatório. Sem registo público ou contas predefinidas.
- Cookie HttpOnly, SameSite=Strict, Secure por defeito, duração de 7 dias.

## Limites e precauções
1. **GitHub Pages continua apenas um protótipo público com dados fictícios e sem login.** Os endpoints privados só existem numa instância do backend ligada ao PostgreSQL e não estão expostos no site GitHub Pages.
2. **Não inserir dados reais de atletas nem credenciais oficiais** nesta fase. Esta etapa não disponibiliza ainda CRUD de atividades, administração de utilizadores, recuperação de password, auditoria de sessões ou ligações do frontend ao backend.
3. O bloqueio de tentativas de login é apenas em memória por processo; antes de publicar a API na Internet, é obrigatória proteção partilhada de rate limiting, HTTPS, proteção de rede, backups encriptados, monitorização e política de retenção.
4. A flag `SESSION_COOKIE_SECURE=false` no Compose existe **só para teste HTTP local**. Em produção não deverá ser definida como false; exigir HTTPS e cookie Secure.
5. A migração de baseline foi preparada para **PostgreSQL novo/vazio**. Não a aplicar a uma base já populada sem reconciliação/migração controlada. Não executar `docker compose down -v` sobre uma base com dados que se pretendam preservar.

## Primeiro administrador — apenas ambiente isolado

A CLI `node dist/bootstrap-admin.js` só funciona quando `FPV_LOCAL_BOOTSTRAP=1` e exige variáveis `FPV_INITIAL_ADMIN_EMAIL` e `FPV_INITIAL_ADMIN_PASSWORD` (14–128 caracteres).
Não existe endpoint público para criar administradores e a CLI recusa criar outro se já existir um administrador.

No futuro, as credenciais devem ser fornecidas por um gestor de segredos ou terminal seguro, **nunca por commits, issues, prints, vídeos ou ficheiros públicos**.
Os testes CI usam exclusivamente email e password fictícios.

## Validação técnica
- `cd apps/api && npm install && npm run prisma:validate && npm run prisma:generate && npm run build && npm run test:auth`
- `docker compose up --build -d` (com um `.env` local configurado).
- `curl http://localhost:8080/api/health` → `status: ok`.
- `curl -i http://localhost:8080/api/auth/me` sem cookie → HTTP 401.
- O CI valida adicionalmente migração, bootstrap fictício, login, `me`, logout e rejeição da sessão revogada.

## Etapa seguinte
Ligar as operações de consulta/criação/edição de atividades à base de dados com **autorização por classe aplicada no servidor** e auditoria, mantendo o Excel de referência inalterado; depois, e só com infraestruturas aprovadas, ligar a interface React ao login real.
