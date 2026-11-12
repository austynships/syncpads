CREATE TABLE `subscriptions` (
	`user_id` varchar(36) NOT NULL,
	`stripe_subscription_id` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL,
	`interval` enum('month','year'),
	`current_period_end` datetime(3),
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `subscriptions_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `subscriptions_stripe_subscription_id_unique` UNIQUE(`stripe_subscription_id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;