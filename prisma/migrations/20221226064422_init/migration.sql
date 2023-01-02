-- CreateTable
CREATE TABLE `Users` (
    `userId` BIGINT NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(10) NULL,
    `name` VARCHAR(10) NULL,
    `studentId` VARCHAR(10) NULL,
    `department` VARCHAR(20) NULL,
    `status` VARCHAR(10) NOT NULL,
    `googleEmail` VARCHAR(50) NULL,
    `googleNickname` VARCHAR(50) NULL,
    `profileImagePath` VARCHAR(200) NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
