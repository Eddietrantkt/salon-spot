-- Day 2 identity foundation. Existing pre-auth users are reset-only until they set a password.

ALTER TABLE `User`
    ADD COLUMN `passwordHash` VARCHAR(255) NOT NULL DEFAULT '!reset-required!';

ALTER TABLE `User`
    ALTER COLUMN `passwordHash` DROP DEFAULT;

CREATE TABLE `AuthSession` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `refreshTokenHash` VARCHAR(128) NOT NULL,
    `familyId` VARCHAR(30) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `replacedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `AuthSession_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `AuthSession_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `AuthSession_familyId_revokedAt_idx`(`familyId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuthSession`
    ADD CONSTRAINT `AuthSession_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AuditEvent`
    ADD COLUMN `requestId` VARCHAR(64) NULL,
    ADD INDEX `AuditEvent_requestId_idx`(`requestId`);
