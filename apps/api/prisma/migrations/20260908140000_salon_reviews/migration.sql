-- Verified public Salon reviews, with one review per completed Booking.
CREATE TABLE `Review` (
  `id` VARCHAR(30) NOT NULL,
  `bookingId` VARCHAR(30) NOT NULL,
  `authorUserId` VARCHAR(30) NOT NULL,
  `salonId` VARCHAR(30) NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `body` VARCHAR(1000) NULL,
  `status` ENUM('PUBLISHED', 'HIDDEN') NOT NULL DEFAULT 'PUBLISHED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Review_bookingId_key` (`bookingId`),
  INDEX `Review_salonId_status_createdAt_idx` (`salonId`, `status`, `createdAt`),
  INDEX `Review_authorUserId_createdAt_idx` (`authorUserId`, `createdAt`),
  CONSTRAINT `Review_rating_check` CHECK (`rating` BETWEEN 1 AND 5),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Review`
  ADD CONSTRAINT `Review_bookingId_fkey`
  FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Review`
  ADD CONSTRAINT `Review_authorUserId_fkey`
  FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Review`
  ADD CONSTRAINT `Review_salonId_fkey`
  FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
