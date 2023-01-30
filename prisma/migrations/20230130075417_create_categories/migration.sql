/*
  Warnings:

  - Added the required column `postStatus` to the `Posts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Posts` ADD COLUMN `postStatus` VARCHAR(20) NOT NULL;

-- CreateTable
CREATE TABLE `comment_alarm` (
    `cAlarmId` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `commentId` BIGINT NOT NULL,
    `postId` BIGINT NOT NULL,
    `uniqueId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `readStatus` VARCHAR(20) NOT NULL,

    UNIQUE INDEX `comment_alarm_uniqueId_key`(`uniqueId`),
    PRIMARY KEY (`cAlarmId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_alarmoff` (
    `cAlarmOffId` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `postId` BIGINT NOT NULL,

    PRIMARY KEY (`cAlarmOffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comment_alarm` ADD CONSTRAINT `comment_alarm_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_alarm` ADD CONSTRAINT `comment_alarm_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `Comment`(`commentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_alarm` ADD CONSTRAINT `comment_alarm_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Posts`(`postId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_alarmoff` ADD CONSTRAINT `comment_alarmoff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_alarmoff` ADD CONSTRAINT `comment_alarmoff_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Posts`(`postId`) ON DELETE RESTRICT ON UPDATE CASCADE;
