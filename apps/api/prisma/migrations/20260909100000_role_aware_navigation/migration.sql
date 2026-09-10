-- Preserve the Owner journey selected at registration so portal navigation can
-- be restored from a server session before the first Salon membership exists.
ALTER TABLE `User`
  ADD COLUMN `ownerOnboardingSelectedAt` DATETIME(3) NULL;
