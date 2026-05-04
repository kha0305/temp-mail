CREATE DATABASE IF NOT EXISTS `temp_mail`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `temp_mail`;

CREATE TABLE IF NOT EXISTS `temp_emails` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `address` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `token` TEXT NOT NULL,
  `account_id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `message_count` INT NOT NULL DEFAULT 0,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'mailtm',
  `mailbox_id` VARCHAR(255) DEFAULT NULL,
  `username` VARCHAR(255) DEFAULT NULL,
  `domain` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_temp_emails_address` (`address`),
  KEY `idx_temp_emails_expires_at` (`expires_at`),
  KEY `idx_temp_emails_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `address` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `token` TEXT NOT NULL,
  `account_id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `expired_at` DATETIME NOT NULL,
  `message_count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_email_history_expired_at` (`expired_at`),
  KEY `idx_email_history_address` (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `saved_emails` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email_address` VARCHAR(255) NOT NULL,
  `message_id` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(500) DEFAULT NULL,
  `from_address` VARCHAR(255) DEFAULT NULL,
  `from_name` VARCHAR(255) DEFAULT NULL,
  `html` LONGTEXT DEFAULT NULL,
  `text` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `saved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_emails_email_message` (`email_address`, `message_id`),
  KEY `idx_saved_emails_saved_at` (`saved_at`),
  KEY `idx_saved_emails_email_address` (`email_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
