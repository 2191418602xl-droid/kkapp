CREATE TABLE `diamond_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`claim_key` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diamond_visitor_claim` ON `diamond_ledger` (`visitor`,`claim_key`);