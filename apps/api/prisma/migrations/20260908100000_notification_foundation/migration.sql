-- Materialize user-facing notifications from committed domain outbox events.
CREATE TABLE `Notification` (
  `id` VARCHAR(30) NOT NULL,
  `sourceEventId` VARCHAR(30) NOT NULL,
  `recipientUserId` VARCHAR(30) NOT NULL,
  `type` ENUM('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED') NOT NULL,
  `titleKey` VARCHAR(120) NOT NULL,
  `bodyKey` VARCHAR(120) NOT NULL,
  `payload` JSON NOT NULL,
  `entityType` VARCHAR(80) NOT NULL,
  `entityId` VARCHAR(30) NOT NULL,
  `readAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Notification_source_recipient_type_key` (`sourceEventId`, `recipientUserId`, `type`),
  INDEX `Notification_recipient_read_created_idx` (`recipientUserId`, `readAt`, `createdAt`),
  INDEX `Notification_entityType_entityId_idx` (`entityType`, `entityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationPreference` (
  `userId` VARCHAR(30) NOT NULL,
  `locale` ENUM('EN', 'VI') NOT NULL DEFAULT 'EN',
  `emailEnabled` BOOLEAN NOT NULL DEFAULT true,
  `marketingEnabled` BOOLEAN NOT NULL DEFAULT false,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationDelivery` (
  `id` VARCHAR(30) NOT NULL,
  `notificationId` VARCHAR(30) NOT NULL,
  `channel` ENUM('IN_APP', 'EMAIL') NOT NULL,
  `status` ENUM('PENDING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deliveredAt` DATETIME(3) NULL,
  `lastError` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `NotificationDelivery_notificationId_channel_key` (`notificationId`, `channel`),
  INDEX `NotificationDelivery_channel_status_availableAt_idx` (`channel`, `status`, `availableAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Notification`
  ADD CONSTRAINT `Notification_recipientUserId_fkey`
  FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `NotificationPreference`
  ADD CONSTRAINT `NotificationPreference_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `NotificationDelivery`
  ADD CONSTRAINT `NotificationDelivery_notificationId_fkey`
  FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
