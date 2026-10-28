ALTER TABLE "activities"
  ADD COLUMN "annualStartDate" DATE,
  ADD COLUMN "annualEndDate" DATE,
  ADD COLUMN "monthlyConfirmed" BOOLEAN NOT NULL DEFAULT false;
