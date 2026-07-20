-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "application_id" UUID;

-- CreateIndex
CREATE INDEX "audit_logs_application_created_at_id_idx" ON "audit_logs"("application_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
