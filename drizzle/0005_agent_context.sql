ALTER TABLE `agents` MODIFY COLUMN `permission` enum('read','read_add','read_add_context') NOT NULL DEFAULT 'read';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `context_profile` text;