ALTER TABLE "MediaAsset" ADD COLUMN "uploadedById" TEXT;

CREATE INDEX "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
