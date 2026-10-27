# Requisitos funcionais — levantamento inicial

Fonte: conversa sobre planeamento desportivo da FPV e ficheiro Excel fornecido para análise. Este documento descreve requisitos a confirmar e não inventa regras institucionais.

## Utilizadores e permissões
- Administrador da Federação: consultar todas as classes e atividades, configurar associações e gerir utilizadores.
- Coordenador: consultar/editar classes atribuídas de acordo com permissões a definir.
- Treinador: criar e alterar apenas atividades nas classes que lhe estão atribuídas; consultar apenas informação autorizada.
- Consulta: leitura apenas, sempre com âmbito explícito.
- **Obrigatório:** autorizações no backend, nunca apenas filtros de interface.

## Atividade
- Título, classe, tipo (treino, estágio, competição, deslocação, formação, outro), intervalo de datas inclusivo, local, treinador responsável e observações.
- Estados: previsto, confirmado, cancelado, realizado.
- Planeamento anual e confirmação/atualização mensal.
- Número previsto de atletas, permitindo inicialmente não conhecer os nomes.
- Participantes nominais selecionados de catálogo central de atletas, com estado individual.
- Número previsto e lista nominal são dados distintos: deve ser possível haver 5 previstos e 3 nomes indicados.
- Registo de alterações (autor, data, campos alterados e justificação quando relevante).
- Dados executados em separado dos planeados, para comparação sem apagar o histórico.

## Calendário
- Visualização mensal e anual, com cores consistentes por tipo de atividade.
- Filtros por classe, treinador, tipo, estado e datas.
- Eventos de vários dias sem necessidade de repetir registos.
- Vista geral para Federação e vista limitada ao âmbito do treinador.
- Os intervalos de data são inclusivos; usar datas civis (`DATE`), não instantes UTC.

## Exportação
- Formato `.xlsx`; lista detalhada e calendário visual bem formatado.
- Exportação por mês/ano, classe e treinador, respeitando permissões.
- A exportação que inclua nomes de atletas exige autorização explícita no backend.
- Exportar apenas a vista filtrada e adicionar identificação de data de extração.

## Migração do Excel existente
- Não inferir um evento exclusivamente pela cor de uma célula.
- Reconhecer descrições, notas, datas e cancelamentos; reportar casos ambíguos para revisão.
- Não importar nomes pessoais ou dados de atletas para código, commits ou amostras públicas.

## Segurança e privacidade
- Repositório privado; nenhum segredo em Git.
- Autenticação verdadeira, password com hash robusto e sessão/token seguro.
- Proteção de dados pessoais, em especial de eventuais atletas menores; minimização e controlos de acesso.
- Cópias de segurança e política de retenção antes de produção.

## Perguntas de negócio antes do módulo de produção
- Pode haver vários treinadores responsáveis pela mesma atividade?
- Quem confirma mensalmente, e quando fecha o mês?
- Os atletas pertencem a uma classe no tempo, ou podem estar em várias?
- As exportações com nomes de menores são permitidas para quais perfis?


## Exportação FPV por classe — referência de 2026 (INC-003)
- A folha original de 2026 tem 17 linhas principais: 15 classes e 2 áreas de formação; cada grupo apresenta uma linha-resumo de dias e sublinhas de competição e estágio.
- O novo ficheiro Excel exportado inclui uma folha `Mapa Classes MM` por mês como primeira(s) folha(s), seguida da lista detalhada e dos calendários semanais.
- As colunas mostram 1 a 31 e o dia da semana; os dias inexistentes ficam desativados.
- Uma classe só conta **um dia-classe por dia**, mesmo havendo vários eventos simultâneos; eventos cancelados não contam como execução planeada ativa.
- Sublinha do tipo mostra 1 ou mais atividades simultâneas; × indica apenas atividades canceladas nesse dia.
- As linhas de competição, estágio e treino aparecem em todas as classes; deslocações, formação e outras só aparecem quando relevantes.
- Classes do modelo FPV aparecem mesmo sem eventos no mês; classes adicionais são incluídas sem adulterar as 17 originais.
- Vista anual exporta os 12 mapas mensais (mais as 12 folhas de calendário) sem depender de fórmulas antigas de resumos.
- A folha `Atividades` preserva os nomes indicados, datas, treinadores, locais, estado e número previsto de atletas.
- Todas as folhas do protótipo continuam a usar apenas **dados fictícios**. Não implica migração de dados pessoais do Excel original.
