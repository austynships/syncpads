ALTER TABLE `pages` ADD `share_token` varchar(64);--> statement-breakpoint
ALTER TABLE `pages` ADD `share_notes` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `share_copies` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `shared_at` datetime(3);--> statement-breakpoint
ALTER TABLE `pages` ADD CONSTRAINT `pages_share_token_unique` UNIQUE(`share_token`);