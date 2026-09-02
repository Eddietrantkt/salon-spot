-- Additive foundation only: existing booking authorization continues to use ProfessionalProfile.status.
ALTER TABLE `ProfessionalProfile`
  ADD COLUMN `verificationStatus` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'DRAFT';

CREATE TABLE `AdminPermission` (
  `userId` VARCHAR(30) NOT NULL,
  `permission` ENUM('VERIFY_PROFESSIONAL') NOT NULL,
  `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`, `permission`),
  CONSTRAINT `AdminPermission_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `AdminAccess`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProfessionalVerificationCase` (
  `id` VARCHAR(30) NOT NULL,
  `professionalUserId` VARCHAR(30) NOT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'DRAFT',
  `submittedAt` DATETIME(3) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `reviewerUserId` VARCHAR(30) NULL,
  `reasonCode` VARCHAR(80) NULL,
  `reasonDetail` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ProfessionalVerificationCase_id_professionalUserId_key` (`id`, `professionalUserId`),
  INDEX `ProfVerifyCase_profile_status_created_idx` (`professionalUserId`, `status`, `createdAt`),
  INDEX `ProfessionalVerificationCase_reviewerUserId_reviewedAt_idx` (`reviewerUserId`, `reviewedAt`),
  CONSTRAINT `ProfessionalVerificationCase_professionalUserId_fkey`
    FOREIGN KEY (`professionalUserId`) REFERENCES `ProfessionalProfile`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProfessionalVerificationCase_reviewerUserId_fkey`
    FOREIGN KEY (`reviewerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProfessionalCredential` (
  `id` VARCHAR(30) NOT NULL,
  `verificationCaseId` VARCHAR(30) NOT NULL,
  `professionalUserId` VARCHAR(30) NOT NULL,
  `type` ENUM('LICENSE', 'INSURANCE') NOT NULL,
  `referenceNumber` VARCHAR(160) NOT NULL,
  `issuingAuthority` VARCHAR(160) NULL,
  `jurisdiction` VARCHAR(120) NULL,
  `issuedAt` DATE NULL,
  `expiresAt` DATE NOT NULL,
  `reviewStatus` ENUM('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  `reviewedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `supersededAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ProfessionalCredential_id_professionalUserId_key` (`id`, `professionalUserId`),
  INDEX `ProfessionalCredential_professionalUserId_type_reviewStatus_idx` (`professionalUserId`, `type`, `reviewStatus`),
  INDEX `ProfessionalCredential_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `ProfCredential_case_profile_fkey`
    FOREIGN KEY (`verificationCaseId`, `professionalUserId`) REFERENCES `ProfessionalVerificationCase`(`id`, `professionalUserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProfessionalCredential_professionalUserId_fkey`
    FOREIGN KEY (`professionalUserId`) REFERENCES `ProfessionalProfile`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProfessionalDocument` (
  `id` VARCHAR(30) NOT NULL,
  `verificationCaseId` VARCHAR(30) NOT NULL,
  `professionalUserId` VARCHAR(30) NOT NULL,
  `credentialId` VARCHAR(30) NULL,
  `type` ENUM('IDENTITY', 'LICENSE', 'INSURANCE') NOT NULL,
  `storageKey` VARCHAR(512) NOT NULL,
  `contentType` VARCHAR(64) NOT NULL,
  `byteSize` INTEGER NULL,
  `checksumSha256` CHAR(64) NULL,
  `uploadExpiresAt` DATETIME(3) NULL,
  `status` ENUM('PENDING_UPLOAD', 'READY', 'REJECTED', 'DELETE_PENDING', 'DELETED') NOT NULL DEFAULT 'PENDING_UPLOAD',
  `failureReason` VARCHAR(255) NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ProfessionalDocument_storageKey_key` (`storageKey`),
  INDEX `ProfessionalDocument_professionalUserId_type_status_idx` (`professionalUserId`, `type`, `status`),
  INDEX `ProfessionalDocument_verificationCaseId_status_idx` (`verificationCaseId`, `status`),
  CONSTRAINT `ProfDocument_case_profile_fkey`
    FOREIGN KEY (`verificationCaseId`, `professionalUserId`) REFERENCES `ProfessionalVerificationCase`(`id`, `professionalUserId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProfessionalDocument_professionalUserId_fkey`
    FOREIGN KEY (`professionalUserId`) REFERENCES `ProfessionalProfile`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProfessionalDocument_credentialId_professionalUserId_fkey`
    FOREIGN KEY (`credentialId`, `professionalUserId`) REFERENCES `ProfessionalCredential`(`id`, `professionalUserId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PasswordResetToken` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PasswordResetToken_tokenHash_key` (`tokenHash`),
  INDEX `PasswordResetToken_userId_usedAt_expiresAt_idx` (`userId`, `usedAt`, `expiresAt`),
  CONSTRAINT `PasswordResetToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
