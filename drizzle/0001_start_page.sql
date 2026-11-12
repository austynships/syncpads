CREATE TABLE `favicons` (
	`host` varchar(255) NOT NULL,
	`status` enum('ok','missing') NOT NULL,
	`content_type` varchar(100),
	`data` mediumblob,
	`fetched_at` datetime(3) NOT NULL,
	CONSTRAINT `favicons_host` PRIMARY KEY(`host`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` varchar(36) NOT NULL,
	`theme` enum('system','light','dark') NOT NULL DEFAULT 'system',
	`wallpaper` json,
	`revision` bigint unsigned NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `pages` MODIFY COLUMN `layout` varchar(32) NOT NULL DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE `widgets` MODIFY COLUMN `type` enum('rss') NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;