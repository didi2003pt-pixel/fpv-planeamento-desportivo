# Registo de decisões técnicas (ADR inicial)

## 001 — Repositório separado
A plataforma nasce num repositório privado próprio para reduzir o risco de interferir com outras aplicações FPV. Possíveis integrações serão API-first.

## 002 — API central e permissões no servidor
O frontend apenas apresenta dados devolvidos pelo backend. Autorizações e filtros de classes serão implementados na API antes de permitir contas e dados reais.

## 003 — PostgreSQL como fonte de verdade
O Excel é documento de origem e formato de exportação, não base de dados partilhada. O modelo relacional permite participantes, planos e auditoria.

## 004 — Datas sem hora por omissão
Estágios, treinos e competições duram dias inteiros: guardar datas `DATE` com início/fim inclusivos. Horas opcionais poderão ser adicionadas se necessárias.

## 005 — Separar previsto, confirmado e realizado
Conservar o histórico e a execução. Não substituir informação anterior sem registo de alteração.

## 006 — Segurança do protótipo
Na etapa 001 existem apenas exemplos fictícios na interface. Sem endpoints públicos de escrita, sem login fictício que aparenta proteger dados e sem dados pessoais reais.

## 007 — Exportação independente da apresentação
A geração Excel para utilizadores autenticados usará dados sujeitos às mesmas verificações de permissões do calendário; não será um contorno das restrições.

## 008 — Tecnologia de referência
React/TypeScript/Vite/FullCalendar, NestJS/Prisma/PostgreSQL, ExcelJS, Docker Compose e GitHub Actions. Qualquer mudança requer explicação e revisão.
