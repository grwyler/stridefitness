CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`area` text NOT NULL,
	`created_at` text NOT NULL,
	`screenshot_count` integer DEFAULT 0 NOT NULL
);
