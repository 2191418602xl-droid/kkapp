CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`tagline` text NOT NULL,
	`personality` text NOT NULL,
	`background` text NOT NULL,
	`greeting` text NOT NULL,
	`voice` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_profiles_visitor_created` ON `agent_profiles` (`visitor`,`created_at`);