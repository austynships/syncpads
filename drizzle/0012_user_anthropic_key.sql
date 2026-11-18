ALTER TABLE `user_settings` ADD `anthropic_key_enc` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `anthropic_key_hint` varchar(16);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `anthropic_key_added_at` datetime(3);