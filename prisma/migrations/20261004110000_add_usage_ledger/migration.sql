-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "estimatedCost" REAL NOT NULL DEFAULT 0.0,
    "personaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageLedger_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UsageLedger_personaId_idx" ON "UsageLedger"("personaId");

-- CreateIndex
CREATE INDEX "UsageLedger_createdAt_idx" ON "UsageLedger"("createdAt");
