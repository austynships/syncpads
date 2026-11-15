CREATE TABLE `page_members` (
	`page_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('editor') NOT NULL DEFAULT 'editor',
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `page_members_page_id_user_id_pk` PRIMARY KEY(`page_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `pages` ADD `share_role` enum('view','edit') DEFAULT 'view' NOT NULL;--> statement-breakpoint
ALTER TABLE `page_members` ADD CONSTRAINT `page_members_page_id_pages_id_fk` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page_members` ADD CONSTRAINT `page_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `page_members_user_id_idx` ON `page_members` (`user_id`);