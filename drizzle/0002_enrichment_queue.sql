ALTER TABLE `item_embeddings` MODIFY COLUMN `embedding` vector(1024) NOT NULL;--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `title` varchar(512);--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `summarized_at` datetime(3);--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `embedded_at` datetime(3);--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `next_attempt_at` datetime(3);--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `claim_token` varchar(36);--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `claimed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `item_enrichment` ADD `error` varchar(255);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ai_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `item_enrichment_queue_idx` ON `item_enrichment` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `item_enrichment_claim_idx` ON `item_enrichment` (`claim_token`);