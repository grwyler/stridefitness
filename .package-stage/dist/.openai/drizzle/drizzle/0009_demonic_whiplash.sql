CREATE TABLE `coach_operations` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`receipt` text NOT NULL
);
