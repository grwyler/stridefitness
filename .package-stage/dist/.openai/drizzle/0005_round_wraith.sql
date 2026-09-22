ALTER TABLE `feedback` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `feedback` ADD `notified_at` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `responded_at` text;