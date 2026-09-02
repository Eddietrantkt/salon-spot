-- D3-D4 media verification metadata. Existing rows are not expected before this
-- migration; the defaults keep the migration safe for development databases.

ALTER TABLE `SalonMedia`
  ADD COLUMN `contentType` VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN `byteSize` INTEGER NULL,
  ADD COLUMN `checksumSha256` CHAR(64) NULL,
  ADD COLUMN `width` INTEGER NULL,
  ADD COLUMN `height` INTEGER NULL,
  ADD COLUMN `failureReason` VARCHAR(255) NULL,
  ADD COLUMN `uploadExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `WorkspaceMedia`
  ADD COLUMN `contentType` VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN `byteSize` INTEGER NULL,
  ADD COLUMN `checksumSha256` CHAR(64) NULL,
  ADD COLUMN `width` INTEGER NULL,
  ADD COLUMN `height` INTEGER NULL,
  ADD COLUMN `failureReason` VARCHAR(255) NULL,
  ADD COLUMN `uploadExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `SalonMedia` ALTER COLUMN `contentType` DROP DEFAULT;
ALTER TABLE `WorkspaceMedia` ALTER COLUMN `contentType` DROP DEFAULT;
ALTER TABLE `SalonMedia` ALTER COLUMN `updatedAt` DROP DEFAULT;
ALTER TABLE `WorkspaceMedia` ALTER COLUMN `updatedAt` DROP DEFAULT;
