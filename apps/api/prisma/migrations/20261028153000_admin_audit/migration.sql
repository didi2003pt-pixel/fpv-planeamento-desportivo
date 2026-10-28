CREATE TABLE "admin_changes" (
 "id" UUID NOT NULL,
 "actorId" UUID NOT NULL,
 "action" VARCHAR(60) NOT NULL,
 "targetId" VARCHAR(100) NOT NULL,
 "before" JSONB,
 "after" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "admin_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_changes_actorId_createdAt_idx" ON "admin_changes"("actorId", "createdAt");
CREATE INDEX "admin_changes_targetId_createdAt_idx" ON "admin_changes"("targetId", "createdAt");
ALTER TABLE "admin_changes" ADD CONSTRAINT "admin_changes_actorId_fkey"
 FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
