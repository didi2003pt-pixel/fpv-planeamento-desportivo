# INC-015 — Área privada de desenvolvimento (Docker)

Esta etapa adiciona uma interface React para testar os endpoints das etapas INC-012, 013 e 014 sem mexer no calendário demonstrativo nem no **Excel FPV aprovado**.

## Onde abrir

- **Versão Docker no mesmo computador:** `http://localhost:8080/gestao` — login, contas de teste, classes, atribuições, consulta de atividades guardadas no PostgreSQL.
- **Calendário demonstrativo Docker:** `http://localhost:8080/`.
- **GitHub Pages público:** continua com o calendário de demonstração e dados fictícios; **não disponibiliza o login privado**. Não existe ligação entre o armazenamento da demonstração e a base de dados da API.

## O que já funciona na interface privada

- Login com sessão no servidor e cookie `HttpOnly` de âmbito `/api`. Não se guarda token em `localStorage`, `sessionStorage` nem URL.
- Consulta do perfil e possibilidade de terminar sessão.
- Para ADMIN: consultar contas e classes, criar contas **fictícias**, criar classes, atribuir várias classes a um treinador, ativar/desativar contas.
- Controlo de concorrência em alterações de conta, sem sobrescrever atualizações posteriores feitas por outro administrador.
- Para COACH/VIEWER/COORDINATOR: consultar atividades persistidas e classes no âmbito permitido pelo backend. A interface não substitui a autorização aplicada na API.
- Erros 401, 403, 404, 409 e 429 com mensagens que não expõem detalhes internos.

**Ainda não existe editor de atividades no portal privado**, integração com Excel privado, gestão de atletas ou convites para definição da própria password. São incrementos posteriores. Não usar dados reais nesta fase.

## Teste técnico isolado

Apenas em máquina de desenvolvimento e com uma BD descartável sem dados reais:

1. Copiar `.env.example` para `.env` na raiz do repositório e definir uma password Postgres forte e de teste. O exemplo permite `SESSION_COOKIE_SECURE=false` **somente porque o teste local usa HTTP no localhost**.
2. Executar `docker compose up --build -d`.
3. Confirmar `http://localhost:8080/api/health`; a resposta deverá incluir `"status":"ok"`.
4. Criar o primeiro ADMIN **apenas em ambiente isolado**, com a ferramenta de bootstrap documentada em `docs/ACESSOS_E_PERSISTENCIA.md`. Não partilhar credenciais por chat, screenshots, vídeos ou repositório.
5. Abrir `http://localhost:8080/gestao`, entrar com a conta fictícia e testar atribuições e consulta de classes e atividades.
6. Para desligar: `docker compose down` (sem `-v`, pois `-v` apagaria o volume de dados). A aplicação é servida apenas no `127.0.0.1:8080` por defeito.

O CI no GitHub valida builds normal e Pages, testes React e do cliente API, HTML servido na rota privada Docker, autenticação/sessões, administração, isolamento por classe e histórico no PostgreSQL descartável.

## Segurança e limites

**Esta interface não está pronta para a Internet.** O HTTP local destina-se exclusivamente à validação técnica. Antes de alojar o serviço externamente são necessários, pelo menos, HTTPS e cookies Secure, gestão de segredos, políticas de passwords e recuperação de acessos, proteção partilhada contra tentativas abusivas, convites de acesso com expiração, monitorização, backups seguros, controlo de acesso de rede e avaliação RGPD.

Não criar contas oficiais nem introduzir nomes de atletas nesta fase. A experiência pública do GitHub Pages continua separada da API privada para evitar uma falsa sensação de proteção de dados.

## Próximo incremento

Ligar a criação e edição das atividades na interface privada às rotas persistentes da API, com feedback de versões e confirmação mensal. **Preservar a exportação Excel existente sem alterações ao seu formato.**
