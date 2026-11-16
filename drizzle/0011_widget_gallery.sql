CREATE TABLE `gallery_reports` (
	`widget_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`reason` varchar(300),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `gallery_reports_widget_id_user_id_pk` PRIMARY KEY(`widget_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `gallery_widgets` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(60) NOT NULL,
	`description` varchar(200) NOT NULL DEFAULT '',
	`html` mediumtext NOT NULL,
	`prompt` text,
	`status` enum('pending','published','rejected','removed') NOT NULL DEFAULT 'pending',
	`review_note` varchar(300),
	`installs` int NOT NULL DEFAULT 0,
	`reports` int NOT NULL DEFAULT 0,
	`reviewed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `gallery_widgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `widgets` MODIFY COLUMN `type` enum('rss','clock','weather','todo','countdown','custom') NOT NULL;--> statement-breakpoint
ALTER TABLE `gallery_reports` ADD CONSTRAINT `gallery_reports_widget_id_gallery_widgets_id_fk` FOREIGN KEY (`widget_id`) REFERENCES `gallery_widgets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_reports` ADD CONSTRAINT `gallery_reports_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_widgets` ADD CONSTRAINT `gallery_widgets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `gallery_reports_user_id_idx` ON `gallery_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `gallery_widgets_status_idx` ON `gallery_widgets` (`status`,`installs`);--> statement-breakpoint
CREATE INDEX `gallery_widgets_user_id_idx` ON `gallery_widgets` (`user_id`);