CREATE TABLE `stride_users` (`id` text PRIMARY KEY NOT NULL, `account_type` text NOT NULL, `created_at` text NOT NULL, `last_active_at` text NOT NULL, `converted_at` text);
--> statement-breakpoint
CREATE TABLE `auth_identities` (`provider` text NOT NULL, `provider_subject` text NOT NULL, `user_id` text NOT NULL, `email` text, `display_name` text, `created_at` text NOT NULL, `last_used_at` text NOT NULL, PRIMARY KEY(`provider`, `provider_subject`), UNIQUE(`provider`, `email`));
--> statement-breakpoint
CREATE INDEX `idx_auth_identities_user` ON `auth_identities` (`user_id`);
--> statement-breakpoint
CREATE TABLE `email_login_challenges` (`token_hash` text PRIMARY KEY NOT NULL, `email` text NOT NULL, `expires_at` text NOT NULL, `consumed_at` text, `requested_at` text NOT NULL);
