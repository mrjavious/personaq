-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "beatsJson" TEXT;
ALTER TABLE "Asset" ADD COLUMN "videoPrompt" TEXT;

-- CreateTable
CREATE TABLE "SceneSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setText" TEXT NOT NULL,
    "lightingJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SceneSet_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShotTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "framing" TEXT NOT NULL,
    "lens" TEXT NOT NULL,
    "aperture" TEXT NOT NULL,
    "cameraState" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '1:1',
    "defaultExpression" TEXT NOT NULL,
    "negativeText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SceneSet_personaId_idx" ON "SceneSet"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "ShotTemplate_name_key" ON "ShotTemplate"("name");
