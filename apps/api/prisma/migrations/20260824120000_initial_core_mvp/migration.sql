-- Initial Core MVP schema. Generated from schema.prisma with Prisma migrate diff.

CREATE TABLE `User` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Salon` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `area` VARCHAR(120) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL,
    `coverMediaId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Salon_coverMediaId_key`(`coverMediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalonMembership` (
    `salonId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `role` ENUM('OWNER') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `SalonMembership_userId_idx`(`userId`),
    PRIMARY KEY (`salonId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Workspace` (
    `id` VARCHAR(30) NOT NULL,
    `salonId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `coverMediaId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Workspace_coverMediaId_key`(`coverMediaId`),
    INDEX `Workspace_salonId_status_idx`(`salonId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RentalOption` (
    `id` VARCHAR(30) NOT NULL,
    `workspaceId` VARCHAR(30) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `RentalOption_id_workspaceId_key`(`id`, `workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceCalendarLock` (
    `workspaceId` VARCHAR(30) NOT NULL,
    `localDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`workspaceId`, `localDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AvailabilitySlot` (
    `id` VARCHAR(30) NOT NULL,
    `workspaceId` VARCHAR(30) NOT NULL,
    `rentalOptionId` VARCHAR(30) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `localDate` DATE NOT NULL,
    `status` ENUM('OPEN', 'HELD', 'BOOKED', 'BLOCKED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `AvailabilitySlot_workspaceId_startsAt_endsAt_idx`(`workspaceId`, `startsAt`, `endsAt`),
    INDEX `AvailabilitySlot_workspaceId_localDate_status_idx`(`workspaceId`, `localDate`, `status`),
    INDEX `AvailabilitySlot_status_startsAt_idx`(`status`, `startsAt`),
    INDEX `AvailabilitySlot_status_localDate_idx`(`status`, `localDate`),
    UNIQUE INDEX `AvailabilitySlot_workspaceId_startsAt_endsAt_key`(`workspaceId`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SlotHold` (
    `id` VARCHAR(30) NOT NULL,
    `availabilitySlotId` VARCHAR(30) NOT NULL,
    `professionalUserId` VARCHAR(30) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `SlotHold_availabilitySlotId_key`(`availabilitySlotId`),
    INDEX `SlotHold_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Booking` (
    `id` VARCHAR(30) NOT NULL,
    `availabilitySlotId` VARCHAR(30) NOT NULL,
    `professionalUserId` VARCHAR(30) NOT NULL,
    `status` ENUM('CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'CONFIRMED',
    `workspaceName` VARCHAR(160) NOT NULL,
    `rentalOptionLabel` VARCHAR(120) NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Booking_availabilitySlotId_key`(`availabilitySlotId`),
    INDEX `Booking_professionalUserId_startsAt_idx`(`professionalUserId`, `startsAt`),
    INDEX `Booking_status_endsAt_idx`(`status`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IdempotencyRecord` (
    `id` VARCHAR(30) NOT NULL,
    `actorUserId` VARCHAR(30) NOT NULL,
    `scope` VARCHAR(80) NOT NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `requestHash` VARCHAR(128) NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `responseBody` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `IdempotencyRecord_actorUserId_scope_idempotencyKey_key`(`actorUserId`, `scope`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalonMedia` (
    `id` VARCHAR(30) NOT NULL,
    `salonId` VARCHAR(30) NOT NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `status` ENUM('PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETE_PENDING', 'DELETED') NOT NULL DEFAULT 'PENDING_UPLOAD',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `SalonMedia_salonId_status_sortOrder_idx`(`salonId`, `status`, `sortOrder`),
    UNIQUE INDEX `SalonMedia_salonId_storageKey_key`(`salonId`, `storageKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceMedia` (
    `id` VARCHAR(30) NOT NULL,
    `workspaceId` VARCHAR(30) NOT NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `status` ENUM('PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETE_PENDING', 'DELETED') NOT NULL DEFAULT 'PENDING_UPLOAD',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `WorkspaceMedia_workspaceId_status_sortOrder_idx`(`workspaceId`, `status`, `sortOrder`),
    UNIQUE INDEX `WorkspaceMedia_workspaceId_storageKey_key`(`workspaceId`, `storageKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditEvent` (
    `id` VARCHAR(30) NOT NULL,
    `actorUserId` VARCHAR(30) NULL,
    `entityType` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(30) NOT NULL,
    `action` VARCHAR(120) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `AuditEvent_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OutboxEvent` (
    `id` VARCHAR(30) NOT NULL,
    `topic` VARCHAR(120) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `OutboxEvent_status_availableAt_idx`(`status`, `availableAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Salon` ADD CONSTRAINT `Salon_coverMediaId_fkey` FOREIGN KEY (`coverMediaId`) REFERENCES `SalonMedia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SalonMembership` ADD CONSTRAINT `SalonMembership_salonId_fkey` FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SalonMembership` ADD CONSTRAINT `SalonMembership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_salonId_fkey` FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_coverMediaId_fkey` FOREIGN KEY (`coverMediaId`) REFERENCES `WorkspaceMedia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RentalOption` ADD CONSTRAINT `RentalOption_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkspaceCalendarLock` ADD CONSTRAINT `WorkspaceCalendarLock_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AvailabilitySlot` ADD CONSTRAINT `AvailabilitySlot_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AvailabilitySlot` ADD CONSTRAINT `AvailabilitySlot_rentalOptionId_workspaceId_fkey` FOREIGN KEY (`rentalOptionId`, `workspaceId`) REFERENCES `RentalOption`(`id`, `workspaceId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SlotHold` ADD CONSTRAINT `SlotHold_availabilitySlotId_fkey` FOREIGN KEY (`availabilitySlotId`) REFERENCES `AvailabilitySlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SlotHold` ADD CONSTRAINT `SlotHold_professionalUserId_fkey` FOREIGN KEY (`professionalUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_availabilitySlotId_fkey` FOREIGN KEY (`availabilitySlotId`) REFERENCES `AvailabilitySlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_professionalUserId_fkey` FOREIGN KEY (`professionalUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IdempotencyRecord` ADD CONSTRAINT `IdempotencyRecord_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SalonMedia` ADD CONSTRAINT `SalonMedia_salonId_fkey` FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkspaceMedia` ADD CONSTRAINT `WorkspaceMedia_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
