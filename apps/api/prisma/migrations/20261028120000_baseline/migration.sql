-- Baseline FPV: dados da Federação apenas em Postgres privado.
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COORDINATOR', 'COACH', 'VIEWER');
CREATE TYPE "ActivityType" AS ENUM ('TRAINING', 'CAMP', 'COMPETITION', 'TRAVEL', 'EDUCATION', 'OTHER');
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "PlanningStage" AS ENUM ('ANNUAL', 'MONTHLY');
CREATE TYPE "ParticipantStatus" AS ENUM ('EXPECTED', 'CONFIRMED', 'DECLINED', 'ATTENDED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'COACH',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "sailing_classes" (
  "id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "sailing_classes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sailing_classes_code_key" ON "sailing_classes"("code");

CREATE TABLE "coach_classes" (
  "userId" UUID NOT NULL,
  "sailingClassId" UUID NOT NULL,
  CONSTRAINT "coach_classes_pkey" PRIMARY KEY ("userId","sailingClassId")
);

CREATE TABLE "athletes" (
  "id" UUID NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "athletes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activities" (
  "id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "details" TEXT,
  "type" "ActivityType" NOT NULL,
  "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "planningStage" "PlanningStage" NOT NULL DEFAULT 'ANNUAL',
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "location" VARCHAR(200),
  "expectedAthleteCount" INTEGER,
  "sailingClassId" UUID NOT NULL,
  "leadCoachId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activities_dates_order" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "activities_expected_nonnegative" CHECK ("expectedAthleteCount" IS NULL OR "expectedAthleteCount" >= 0)
);
CREATE INDEX "activities_startDate_endDate_idx" ON "activities"("startDate","endDate");
CREATE INDEX "activities_sailingClassId_startDate_idx" ON "activities"("sailingClassId","startDate");

CREATE TABLE "activity_participants" (
  "activityId" UUID NOT NULL,
  "athleteId" UUID NOT NULL,
  "status" "ParticipantStatus" NOT NULL DEFAULT 'EXPECTED',
  CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("activityId","athleteId")
);

CREATE TABLE "activity_executions" (
  "activityId" UUID NOT NULL,
  "actualStartDate" DATE,
  "actualEndDate" DATE,
  "actualLocation" VARCHAR(200),
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activity_executions_pkey" PRIMARY KEY ("activityId")
);

CREATE TABLE "activity_changes" (
  "id" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_changes_activityId_createdAt_idx" ON "activity_changes"("activityId","createdAt");

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "userId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");
CREATE INDEX "auth_sessions_userId_expiresAt_idx" ON "auth_sessions"("userId","expiresAt");

ALTER TABLE "coach_classes" ADD CONSTRAINT "coach_classes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_classes" ADD CONSTRAINT "coach_classes_sailingClassId_fkey"
  FOREIGN KEY ("sailingClassId") REFERENCES "sailing_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_sailingClassId_fkey"
  FOREIGN KEY ("sailingClassId") REFERENCES "sailing_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_leadCoachId_fkey"
  FOREIGN KEY ("leadCoachId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_executions" ADD CONSTRAINT "activity_executions_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_changes" ADD CONSTRAINT "activity_changes_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_changes" ADD CONSTRAINT "activity_changes_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
