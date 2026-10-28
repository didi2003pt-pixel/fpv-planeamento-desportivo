-- APENAS para o Docker temporário de CI: não executar contra uma BD da Federação.
INSERT INTO "sailing_classes" ("id","code","name") VALUES
 ('10000000-0000-4000-8000-000000000001','ILCA 7','ILCA 7'),
 ('10000000-0000-4000-8000-000000000002','49er','49er');
INSERT INTO "users" ("id","fullName","email","passwordHash","role","updatedAt")
SELECT '20000000-0000-4000-8000-000000000001','Treinador A (teste)','coach-a@fpv.invalid',"passwordHash",'COACH',NOW()
  FROM "users" WHERE "role"='ADMIN' LIMIT 1;
INSERT INTO "users" ("id","fullName","email","passwordHash","role","updatedAt")
SELECT '20000000-0000-4000-8000-000000000002','Treinador B (teste)','coach-b@fpv.invalid',"passwordHash",'COACH',NOW()
  FROM "users" WHERE "role"='ADMIN' LIMIT 1;
INSERT INTO "users" ("id","fullName","email","passwordHash","role","updatedAt")
SELECT '20000000-0000-4000-8000-000000000003','Visualizador (teste)','viewer@fpv.invalid',"passwordHash",'VIEWER',NOW()
  FROM "users" WHERE "role"='ADMIN' LIMIT 1;
INSERT INTO "coach_classes" ("userId","sailingClassId") VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
