-- A self-selected Professional starts pending; only operations can activate booking access.
ALTER TABLE `ProfessionalProfile`
  MODIFY `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `phone` VARCHAR(40) NULL,
  ADD COLUMN `city` VARCHAR(120) NULL,
  ADD COLUMN `bio` VARCHAR(1000) NULL,
  ADD COLUMN `specialties` JSON NULL;
