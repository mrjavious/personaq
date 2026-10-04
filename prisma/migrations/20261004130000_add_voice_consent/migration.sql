-- CreateTable
CREATE TABLE "VoiceConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voiceId" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "when" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "notes" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceConsent_voiceId_key" ON "VoiceConsent"("voiceId");

-- CreateIndex
CREATE INDEX "VoiceConsent_voiceId_idx" ON "VoiceConsent"("voiceId");
