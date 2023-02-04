-- CreateTable
CREATE TABLE `Users` (
    `userId` BIGINT NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(10) NULL,
    `name` VARCHAR(10) NULL,
    `studentId` VARCHAR(10) NULL,
    `department` VARCHAR(20) NULL,
    `status` VARCHAR(10) NOT NULL,
    `schoolEmail` VARCHAR(50) NULL,
    `googleEmail` VARCHAR(50) NULL,
    `googleNickname` VARCHAR(50) NULL,
    `profileImagePath` VARCHAR(200) NULL,
    `place` VARCHAR(300) NULL,
    `tag` VARCHAR(300) NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Posts` (
    `postId` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `title` VARCHAR(200) NULL,
    `content` VARCHAR(500) NOT NULL,
    `imagePath` VARCHAR(200) NULL,
    `publishDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `place` VARCHAR(100) NOT NULL,
    `placeDetail` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `tag` VARCHAR(100) NOT NULL,
    `postStatus` VARCHAR(20) NOT NULL,

    UNIQUE INDEX `Posts_postId_key`(`postId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `commentId` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NULL,
    `postId` BIGINT NULL,
    `content` VARCHAR(500) NULL,
    `commentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`commentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alarm` (
    `alarmId` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `postId` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `place` VARCHAR(100) NOT NULL,
    `tag` VARCHAR(30) NOT NULL,
    `readStatus` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL,

    PRIMARY KEY (`alarmId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Posts`(`postId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alarm` ADD CONSTRAINT `Alarm_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alarm` ADD CONSTRAINT `Alarm_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Posts`(`postId`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
