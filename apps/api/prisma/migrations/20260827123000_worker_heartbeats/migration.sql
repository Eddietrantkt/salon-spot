-- Operations observability: workers publish their latest successful or failed batch.

CREATE TABLE `WorkerHeartbeat` (
    `workerName` VARCHAR(80) NOT NULL,
    `lastSucceededAt` DATETIME(3) NULL,
    `lastFailedAt` DATETIME(3) NULL,
    `lastError` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`workerName`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
