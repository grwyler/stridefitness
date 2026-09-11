CREATE TABLE `site_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`ai_requests` integer DEFAULT 0 NOT NULL,
	`last_ai_at` text
);
