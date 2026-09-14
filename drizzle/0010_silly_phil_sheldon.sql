CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_reviews_user_created` ON `weekly_reviews` (`user_id`,`created_at`);