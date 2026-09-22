CREATE TABLE `ai_usage_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`cached_input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_micros` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `billing_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text,
	`balance_micros` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `billing_topups` (
	`checkout_session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_micros` integer NOT NULL,
	`applied_at` text NOT NULL
);
