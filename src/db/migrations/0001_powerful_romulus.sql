CREATE TABLE `shopify_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`state` text NOT NULL,
	`is_online` integer DEFAULT false NOT NULL,
	`scope` text,
	`expires` integer,
	`access_token` text,
	`user_id` integer,
	`first_name` text,
	`last_name` text,
	`email` text,
	`account_owner` integer DEFAULT false NOT NULL,
	`locale` text,
	`collaborator` integer DEFAULT false,
	`email_verified` integer DEFAULT false
);
