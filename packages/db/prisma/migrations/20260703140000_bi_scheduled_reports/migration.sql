-- Day 17: scheduled report delivery metadata
ALTER TABLE "ScheduledReport" ADD COLUMN IF NOT EXISTS "dashboardId" TEXT;
ALTER TABLE "ScheduledReport" ADD COLUMN IF NOT EXISTS "lastReportPath" TEXT;
ALTER TABLE "ScheduledReport" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
