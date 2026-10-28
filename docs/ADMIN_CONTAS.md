# INC-014 — Administração de contas e classes (backend privado)

Esta etapa permite à **conta ADMIN** criar classes, preparar contas individuais e atribuir classes aos treinadores, sempre no PostgreSQL privado. **Não cria uma página pública de login** e não liga estas contas ao GitHub Pages.

## Endpoints (todos exigem sessão autenticada)

| Método | Rota | Papel autorizado |
|---|---|---|
| GET | `/api/admin/users` | ADMIN |
| GET | `/api/admin/classes` | ADMIN |
| POST | `/api/admin/classes` | ADMIN |
| POST | `/api/admin/users` | ADMIN |
| PUT | `/api/admin/users/:id/classes` | ADMIN |
| PATCH | `/api/admin/users/:id/status` | ADMIN |

As listas de contas não devolvem passwords, hashes nem tokens; incluem ID, nome, email, papel, estado, versão e classes. Limite atual: 300 utilizadores listados por pedido, com sinalização `truncated`.

A criação de contas aceita apenas papéis `COACH`, `COORDINATOR` ou `VIEWER`. Só o bootstrap privado inicial pode criar um ADMIN nesta etapa. Não existe registo público.

### Exemplos fictícios

Criar uma classe:
```json
{ "code": "420", "name": "Classe 420" }
```

Criar conta de treinador em ambiente **isolado de testes**:
```json
{
  "fullName": "Treinador de exemplo",
  "email": "exemplo@fpv.invalid",
  "role": "COACH",
  "initialPassword": "UmaPasswordFicticiaMuitoForte#2026"
}
```

Atribuir classes ao treinador:
```json
{
  "classIds": ["00000000-0000-4000-8000-000000000001"],
  "expectedVersion": 0
}
```

Desativar conta:
```json
{ "active": false, "expectedVersion": 1 }
```

O campo `expectedVersion` é devolvido pela leitura anterior; um pedido concorrente com versão antiga devolve HTTP 409, em vez de sobrescrever atribuições recentes. A atribuição substitui a lista inteira de classes (uma lista vazia remove todas).

## Controlos importantes

- Apenas a sessão de um ADMIN pode chamar estas rotas. Treinadores não se podem atribuir classes nem elevar o próprio papel.
- A atribuição só é aceite para uma conta COACH e classes ativas existentes.
- Alterações às classes ficam visíveis nas autorizações dos endpoints de atividades no pedido seguinte, sem confiar em filtros do browser.
- Desativar uma conta revoga as respetivas sessões de acesso; reativar a conta não recupera sessões antigas.
- Um administrador não pode desativar-se a si próprio ou outro ADMIN por estes endpoints.
- As ações administrativas ficam registadas em `admin_changes` (autor, alvo, alteração, antes/depois), **sem credenciais**.
- Passwords iniciais nunca aparecem em respostas e são armazenadas com scrypt + salt; não existe fluxo de convite/recuperação de password. Não utilizar contas reais ainda.
- Validação rigorosa dos corpos JSON e verificação de origem nos pedidos que alteram dados.

## Testes automatizados

No CI: validação Prisma, testes unitários, compilação e integração com PostgreSQL e Docker. A integração cria apenas identidades `*.invalid`, verifica conflitos e papéis, retira uma classe a um treinador e confirma a perda de acesso aos registos dessa classe, desativa a conta, revoga sessões e verifica auditoria.

## Limitações — ainda não é produção

O site público no GitHub Pages continua a ser uma demonstração **sem login real** e não guarda planeamentos dos treinadores. Os novos endpoints só funcionam numa instância privada da API; não expor esta instância na Internet sem HTTPS, limites de pedidos centralizados, monitorização, backups cifrados e plano de recuperação, política de acesso, RGPD, provisionamento seguro e fluxo obrigatório de definição/alteração de password.

**Não usar aqui nomes, emails ou dados reais de atletas/treinadores nem credenciais oficiais.** Não publicar passwords em commits, prints ou chats. O processo de criação com `initialPassword` destina-se à fase de integração isolada; antes de produção deverá evoluir para convites de acesso com validade curta e definição da própria password.

A exportação Excel de 3 folhas, o calendário público e os dados de demonstração ficam exatamente como estavam.
