# INC-013 — API privada de atividades por classe

Esta etapa **não muda o frontend GitHub Pages**, nem o Excel aprovado, nem ativa dados reais.
A API NestJS é servida apenas na instalação privada com PostgreSQL, através do proxy `/api` do Docker.

## Rotas autenticadas

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/classes` | Classes atribuídas (treinador) ou todas (Federação/visualizador) |
| GET | `/api/activities?from=2027-01-01&to=2027-12-31` | Listagem filtrada no servidor por classe; até 500 atividades por pedido |
| GET | `/api/activities/:id` | Leitura de atividade permitida apenas no âmbito autorizado |
| POST | `/api/activities` | Treinador atribuído ou coordenação/admin |
| PATCH | `/api/activities/:id` | Mesmas regras de escrita, sem mudança de classe/treinador |
| POST | `/api/activities/:id/confirm-monthly` | Confirma datas mensais sem perder as anuais |

Todos os endpoints exigem cookie válido de sessão, no servidor. Falhas de acesso por ID são HTTP 404 para não revelar dados de outras classes. Uma conta VIEWER pode consultar mas não modificar.

## Regras

- Um treinador só pode criar/alterar atividades de classes atualmente atribuídas à sua conta.
- A criação por treinador atribui o próprio treinador como responsável; não pode atribuir atividade a outra pessoa. A Federação pode especificar `leadCoachId`, desde que o responsável esteja ativo e associado à classe.
- Listagens exigem intervalo civil válido (até cerca de um ano); os registos que atravessam meses são incluídos. Não existe listagem pública ou leitura sem sessão.
- Na criação, as datas anuais originais são preservadas, e as datas atuais são iguais às anuais.
- Na edição, alterações antes da confirmação mensal atualizam a previsão anual. Depois de confirmar, datas só podem ser revistas pelo endpoint `confirm-monthly`. Cancelamento é possível sem apagar o registo.
- Cada gravação cria um registo em `activity_changes` com autor e valores anteriores/novos.
- `PATCH` e `confirm-monthly` exigem `expectedUpdatedAt` (timestamp ISO UTC devolvido pela última leitura). Uma gravação desatualizada devolve **409 Conflict**, em vez de sobrescrever outra silenciosamente.
- A API ainda não disponibiliza criação de atletas, participantes, atribuição de classes ou administração de contas; são etapas posteriores.

## Exemplos de corpos JSON (dados fictícios)

**POST** `/api/activities`:

```json
{
  "title": "Estágio ILCA 7 (teste)",
  "type": "CAMP",
  "sailingClassId": "<UUID de uma classe atribuída>",
  "startDate": "2027-01-17",
  "endDate": "2027-01-31",
  "location": "Vilamoura",
  "expectedAthleteCount": 3
}
```

**POST** `/api/activities/:id/confirm-monthly`:

```json
{
  "expectedUpdatedAt": "2026-10-28T11:00:00.000Z",
  "startDate": "2027-01-17",
  "endDate": "2027-01-27"
}
```

As datas `DateTime @db.Date` são serializadas no JSON da API como instantes UTC à meia-noite; o frontend futuro deve tratá-las como **datas civis**, não converter automaticamente para fusos horários.

## Testes no CI

- Testes unitários: `cd apps/api && npm run prisma:generate && npm run build && npm run test:activities`.
- CI em Docker com BD temporária: migrações, bootstrap de administrador **fictício**, duas contas de treinadores fictícios e uma conta de visualizador.
- A integração testa 401 sem login, separação de classes, proibição de criar noutra classe, proibição de atribuir outro responsável, visualizador read-only, isolamento por ID, proteção de concorrência, confirmação mensal e histórico.

## Limites antes de produção

**Não usar dados reais de atletas nesta fase.** Ainda são necessários: HTTPS e cookies seguros, alojamento privado e backups encriptados, rate limiting central, gestão real de contas/classes, monitorização, recuperação de acessos, políticas de retenção e revisão de segurança/RGPD. A autorização aplica-se à aplicação, não substitui controlos de infraestrutura e DB. O GitHub Pages continua a ser uma demonstração pública com dados fictícios e sem backend ligado.

A migração `20261028140000_annual_monthly_activity` é aditiva e não altera o desenho do Excel. **Não executar** comandos de limpeza de volumes PostgreSQL sobre bases que se pretendam preservar.
