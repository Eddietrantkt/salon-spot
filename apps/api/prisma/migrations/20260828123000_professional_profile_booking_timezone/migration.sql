-- A Professional profile is an explicit booking capability, separate from Owner membership and Admin access.
CREATE TABLE `ProfessionalProfile` (
  `userId` VARCHAR(30) NOT NULL,
  `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProfessionalProfile`
  ADD CONSTRAINT `ProfessionalProfile_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Booking`
  ADD COLUMN `salonTimezone` VARCHAR(64) NULL,
  ADD COLUMN `localDate` DATE NULL;

-- Existing bookings retain the timezone and Salon-local calendar date that applied to their linked slot.
UPDATE `Booking`
INNER JOIN `AvailabilitySlot` ON `Booking`.`availabilitySlotId` = `AvailabilitySlot`.`id`
INNER JOIN `Workspace` ON `AvailabilitySlot`.`workspaceId` = `Workspace`.`id`
INNER JOIN `Salon` ON `Workspace`.`salonId` = `Salon`.`id`
SET
  `Booking`.`salonTimezone` = `Salon`.`timezone`,
  `Booking`.`localDate` = `AvailabilitySlot`.`localDate`
WHERE `Booking`.`salonTimezone` IS NULL OR `Booking`.`localDate` IS NULL;

ALTER TABLE `Booking`
  MODIFY `salonTimezone` VARCHAR(64) NOT NULL,
  MODIFY `localDate` DATE NOT NULL;
