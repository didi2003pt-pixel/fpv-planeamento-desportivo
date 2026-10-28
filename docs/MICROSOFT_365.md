# INC-016 — Integração Microsoft 365 sem Docker obrigatório

## INC-017 — Funcionamento sem Entra: Power Apps + vistas de calendário SharePoint

**Situação demonstrada no piloto:** a conta de teste criou/alterou um estágio na aplicação Power Apps ligada à lista SharePoint, e o registo ficou visível na lista. A gravação feita em modo editar atualiza o mesmo item; não duplica a atividade. O histórico de versões da lista foi configurado para registar alterações.

**Não bloquear o piloto por falta de permissões no portal Microsoft Entra.** O Power Apps pode utilizar a ligação SharePoint da própria organização para ler e escrever na lista, respeitando os acessos do utilizador. A app React no GitHub Pages continua a ser **demonstração isolada**, e **não** lê automaticamente os itens do SharePoint enquanto faltarem os elementos do registo Entra/Graph.

### Criar duas vistas sobre a mesma lista (sem duplicar dados)

Na lista de testes já criada em Microsoft Lists/SharePoint:

1. Abrir o menu de vistas no topo da lista, junto a **Todos os itens**. Conforme a interface, selecionar **+ Adicionar vista**.
2. Nome da primeira vista: **Plano mensal**. Tipo: **Calendário**. Início = `StartDate`, Fim = `EndDate`, rótulo = **Título**. Guardar.
3. Criar uma segunda vista: **Plano anual**. Tipo: **Calendário**. Início = `AnnualStartDate`, Fim = `AnnualEndDate`, rótulo = **Título**. Guardar.
4. Confirmar com um registo **fictício**: previsão anual 17–31 de janeiro de 2027 e confirmação mensal 17–27 de janeiro de 2027. O **mesmo item** deverá aparecer na vista anual até dia 31 e na mensal apenas até dia 27.
5. Rever o **Histórico de versões** de um item para verificar a sequência das alterações. Histórico de versões não substitui plano de backup.
6. Manter a lista com permissões próprias: **Proprietários** com controlo total e **Treinadores ILCA 7** com **Contribuir**. As vistas **não** concedem nem retiram permissões; isso é feito no SharePoint.

Fontes Microsoft:
- [Criar uma vista de calendário a partir de uma lista](https://support.microsoft.com/en-us/sharepoint/lists/create-a-calendar-view-from-a-list)
- [Criar aplicação Power Apps a partir do SharePoint](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/app-from-sharepoint)

### Integração com o calendário React — decisão técnica pendente

**Não colocar os dados privados num ficheiro público no GitHub** nem configurar um fluxo Power Automate a exportar eventos privados para GitHub Pages. Isso exporia informação da FPV. Também não é aceitável contornar a verificação multifator do Entra.

Há duas opções legítimas:

- **Sem alterações de licenciamento e sem Entra:** utilizar o Power Apps como interface de introdução e as vistas de calendário nativas do SharePoint como consulta operacional. A aparência ainda difere do calendário React aprovado.
- **Preservar a interface React ligada a dados reais:** exigir registo/consentimento Microsoft Entra e autorização Graph sobre as listas. Só depois o frontend React poderá consultar o SharePoint com login e proteção efetiva. O registo depende do administrador do tenant.

Neste incremento só foi adicionado ao GitHub Pages um **percurso de acesso e instruções**, sem fazer chamadas à lista real, alterar a exportação Excel ou guardar credenciais/IDs internos no código.

---


## Objetivo

Manter o calendário FPV e o Excel aprovados, continuar a alojar a interface no GitHub Pages e experimentar, com **dados exclusivamente fictícios**, login Microsoft e planeamentos persistentes em SharePoint/Microsoft Lists.

**Esta integração ainda não está ligada a um tenant da Federação.** Até o administrador fornecer os identificadores necessários, a página mostra "Ligação ainda não configurada" e não inicia autenticação nem faz pedidos ao Graph.

## O que foi preparado

- Página piloto: `https://didi2003pt-pixel.github.io/fpv-planeamento-desportivo/?m365=1`.
- Autenticação Microsoft Entra por `@azure/msal-browser` v5, OAuth Authorization Code + PKCE, popup e página `redirect.html` isolada.
- **Sem client secret no browser**, sem cookies próprios, sem password da Federação no GitHub, sem tokens registados em logs.
- Leitura de listas SharePoint separadas por classe, através do Microsoft Graph, apenas segundo as permissões concedidas pela Microsoft.
- Criar atividades com título, classe, tipo, datas, local e **quantidade** de atletas (sem nomes).
- Confirmar/rever datas mensais, mantendo as colunas do plano anual e usando `If-Match`/ETag para impedir sobrescritas concorrentes.
- A aplicação original e a exportação Excel das três folhas continuam intocadas; o piloto Microsoft usa interface própria.

## Ação administrativa necessária (uma vez)

**1. Criar uma área de testes SharePoint** isolada, preferencialmente num site destinado ao planeamento piloto. Não utilizar listas existentes com dados pessoais.

**2. Criar uma lista por classe**, por exemplo "FPV ILCA 7" e "FPV 49er", sem herdar permissões amplas do site. Atribuir acesso **diretamente nas listas**: equipa coordenadora da FPV pode consultar todas, e cada treinador apenas as listas das suas classes. Uma mesma classe pode ter vários treinadores. Confirma que um treinador que conhece o URL da lista de outra classe recebe acesso negado. Só esconder um botão no React não constitui proteção.

**3. Criar exatamente estas colunas em cada lista**, com os nomes internos indicados (não apenas o nome apresentado):

| Nome interno | Tipo SharePoint | Observação |
|---|---|---|
| `Title` | Texto (padrão) | Nome da prova/estágio |
| `ActivityType` | Texto de uma linha | CAMP, COMPETITION, TRAINING, TRAVEL, EDUCATION ou OTHER |
| `ActivityStatus` | Texto de uma linha | PLANNED, CONFIRMED, CANCELLED ou COMPLETED |
| `StartDate` | Data/Hora | Data inicial atual |
| `EndDate` | Data/Hora | Data final atual |
| `AnnualStartDate` | Data/Hora | Previsão anual inicial |
| `AnnualEndDate` | Data/Hora | Previsão anual final |
| `MonthlyConfirmed` | Sim/Não | Por defeito Não |
| `Location` | Texto de uma linha | Local / país |
| `ExpectedAthletes` | Número | Inteiro >= 0, por defeito 0 |

Ativar **histórico de versões** das listas antes de fazer testes. O piloto não armazena nomes de atletas nem outros dados pessoais. O Graph usa **nomes internos** das colunas: renomear uma coluna já existente não altera necessariamente o nome interno.

**4. Registar uma aplicação Microsoft Entra** do tipo *Single-page application (SPA)*. Registar como Redirect URI exatamente:

```text
https://didi2003pt-pixel.github.io/fpv-planeamento-desportivo/redirect.html
```

Para desenvolvimento opcional: `http://localhost:5173/redirect.html`. Não criar segredo da aplicação. Configurar apenas contas da organização. A aplicação solicita os scopes delegados **`User.Read`** e **`Lists.SelectedOperations.Selected`**.

A permissão selecionada exige **consentimento adequado no Entra** e **atribuição explícita da aplicação às listas**. Mesmo com essa atribuição, a sessão delegada também respeita as permissões efetivas de cada utilizador no SharePoint. Se a equipa de TI não conseguir atribuir este scope, rever a arquitetura antes de ampliar permissões: não substituir automaticamente por acesso de leitura/escrita a todos os sites do tenant.

Documentação Microsoft:
- [MSAL v5 e redirect bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge)
- [Selected Permissions Graph](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [Consultar itens de listas](https://learn.microsoft.com/en-us/graph/api/listitem-list)
- [Criar itens de listas](https://learn.microsoft.com/en-us/graph/api/listitem-create)
- [Atualizar itens e ETag](https://learn.microsoft.com/en-us/graph/api/listitem-update)

**5. Configurar `apps/web/public/m365-config.json`** com apenas identificadores públicos de integração:

```json
{
  "tenantId": "UUID fornecido por Microsoft Entra",
  "clientId": "UUID da aplicação SPA",
  "siteId": "ID do site devolvido por Microsoft Graph",
  "classes": [
    {"code": "ILCA 7", "listId": "UUID da lista desta classe"},
    {"code": "49er", "listId": "UUID da lista desta classe"}
  ]
}
```

Este ficheiro é público no GitHub Pages; nunca incluir passwords, client secrets, tokens, chaves privadas, nomes de atletas nem dados restritos. A segurança real vem da autenticação e **das autorizações da Microsoft sobre cada lista**. Se o tenant não permitir identificadores num repositório público, será necessário aprovar uma alternativa de configuração; estes valores não são segredos OAuth, mas são metadados institucionais.

**6. Executar testes de segurança com contas exclusivamente fictícias**, com pelo menos dois treinadores de classes diferentes e uma conta da coordenação:
- Treinador A lê e cria na classe A e recebe 403 na classe B;
- Treinador B lê e cria na classe B e recebe 403 na classe A;
- Coordenação com acesso às duas classes;
- criação, consulta após novo login, atualização mensal com datas anuais preservadas;
- alteração concorrente recebe 412 Precondition Failed;
- verificar que não há exposição de nomes, listas indevidas ou tokens no navegador.

## Limites e pontos pendentes

- As contas e permissões das classes ainda têm de ser criadas no tenant e SharePoint FPV por quem tiver autorização administrativa.
- O piloto só oferece **criação e confirmação mensal**. Não tem edição geral, cancelamento, aprovação institucional, importação completa do Excel, notificações, nem nomes de atletas.
- O SharePoint deverá suportar versionamento e uma estratégia de backup/exportação para um local privado da organização, com testes periódicos de reposição. GitHub Pages não substitui backups.
- Limites, condições contratuais, governação e retenção de dados devem ser confirmados pela FPV. Ter aplicações Microsoft 365 disponíveis não garante, por si só, permissão de criar uma aplicação Entra ou aceder ao Graph.
- O antigo backend Docker/PostgreSQL permanece no repositório como referência de desenvolvimento; **não é utilizado pelo piloto Microsoft**.
- O Excel FPV de três folhas **não foi alterado**.

## Testes locais de código (não exigidos ao utilizador)

`cd apps/web && npm install && npm run test:m365 && npm run build -- --mode pages`

Os testes usam respostas Microsoft Graph simuladas e não fazem login real no tenant. Um login real e as permissões só podem ser validados depois da configuração institucional.
