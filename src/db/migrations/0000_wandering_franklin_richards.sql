CREATE TABLE `alert_acknowledgements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`product_expiry_id` integer NOT NULL,
	`acknowledged_at` integer,
	FOREIGN KEY (`rule_id`) REFERENCES `reminder_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_expiry_id`) REFERENCES `product_expiry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_expiry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`expiry_date` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopify_product_id` text,
	`shopify_variant_id` text,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `reminder_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`days_before_expiry` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`email_address` text,
	`created_at` integer
);
