CREATE TABLE "processing_locks" (
  "documentId" TEXT NOT NULL,
  "owner"      TEXT NOT NULL,
  "lockedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "processing_locks_pkey" PRIMARY KEY ("documentId")
);
