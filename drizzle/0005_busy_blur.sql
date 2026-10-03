ALTER TABLE `agent_profiles` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_profiles` ADD `tags` text DEFAULT '[]' NOT NULL;