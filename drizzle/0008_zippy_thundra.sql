CREATE TABLE `e2e_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`event` text NOT NULL,
	`user_id` text,
	`session_id` text NOT NULL,
	`message_id` text,
	`trace_id` text,
	`order_id` text,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_e2e_session_user` ON `e2e_events` (`session_id`,`user_id`);