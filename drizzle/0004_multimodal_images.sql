CREATE TABLE `generated_images` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`prompt` text NOT NULL,
	`size` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_generated_images_visitor_created` ON `generated_images` (`visitor`,`created_at`);