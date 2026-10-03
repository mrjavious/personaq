-- CreateTable
CREATE TABLE IF NOT EXISTS "ComplianceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "criticalIssues" INTEGER NOT NULL DEFAULT 0,
    "warningIssues" INTEGER NOT NULL DEFAULT 0,
    "reportJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personaId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "type" TEXT NOT NULL DEFAULT 'image',
    "kind" TEXT NOT NULL DEFAULT 'content',
    "parentAssetId" TEXT,
    "suitability" TEXT NOT NULL DEFAULT 'sfw_safe',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "provenanceMeta" TEXT,
    "safetyStatus" TEXT NOT NULL DEFAULT 'pending',
    "safetyReasons" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Asset_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("aiGenerated", "createdAt", "deletedAt", "id", "personaId", "provenanceMeta", "safetyReasons", "safetyStatus", "storageKey", "suitability", "tags", "type", "updatedAt", "url") SELECT "aiGenerated", "createdAt", "deletedAt", "id", "personaId", "provenanceMeta", "safetyReasons", "safetyStatus", "storageKey", "suitability", "tags", "type", "updatedAt", "url" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE TABLE "new_Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "adultAge" INTEGER NOT NULL DEFAULT 21,
    "backstory" TEXT NOT NULL,
    "appearanceNotes" TEXT NOT NULL,
    "voiceTone" TEXT NOT NULL,
    "catchphrases" TEXT NOT NULL DEFAULT '[]',
    "boundaries" TEXT NOT NULL DEFAULT '[]',
    "contentPillars" TEXT NOT NULL DEFAULT '[]',
    "aiDisclosureText" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "visualModelConfig" TEXT,
    "faceStatus" TEXT NOT NULL DEFAULT 'none',
    "faceAssetId" TEXT,
    "bodyAssetId" TEXT,
    "identityText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Persona" ("adultAge", "aiDisclosureText", "appearanceNotes", "avatarUrl", "backstory", "boundaries", "catchphrases", "contentPillars", "createdAt", "deletedAt", "id", "name", "updatedAt", "visualModelConfig", "voiceTone") SELECT "adultAge", "aiDisclosureText", "appearanceNotes", "avatarUrl", "backstory", "boundaries", "catchphrases", "contentPillars", "createdAt", "deletedAt", "id", "name", "updatedAt", "visualModelConfig", "voiceTone" FROM "Persona";
DROP TABLE "Persona";
ALTER TABLE "new_Persona" RENAME TO "Persona";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
