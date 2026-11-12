CREATE TABLE `oauth_clients` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`redirect_uris` json NOT NULL,
	`auth_method` enum('none','client_secret_post','client_secret_basic') NOT NULL DEFAULT 'none',
	`secret_hash` varchar(64),
	`client_uri` varchar(512),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_codes` (
	`code_hash` varchar(64) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`agent_id` varchar(36) NOT NULL,
	`redirect_uri` varchar(2048) NOT NULL,
	`code_challenge` varchar(128) NOT NULL,
	`resource` varchar(512),
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	CONSTRAINT `oauth_codes_code_hash` PRIMARY KEY(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`token_hash` varchar(64) NOT NULL,
	`kind` enum('access','refresh') NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`agent_id` varchar(36) NOT NULL,
	`resource` varchar(512),
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_tokens_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `client_id` varchar(64);--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_client_id_oauth_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_client_id_oauth_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `oauth_tokens_agent_idx` ON `oauth_tokens` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agents_client_idx` ON `agents` (`client_id`);