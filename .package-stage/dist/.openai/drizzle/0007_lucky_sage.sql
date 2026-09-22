CREATE TABLE `ai_account_funding` (
	`user_id` text PRIMARY KEY NOT NULL,
	`included` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_signup_policy` (
	`id` text PRIMARY KEY NOT NULL,
	`included` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
INSERT INTO ai_signup_policy (id, included) VALUES ('default', 1);
--> statement-breakpoint
INSERT INTO ai_account_funding (user_id, included) SELECT user_id, 1 FROM site_users;
