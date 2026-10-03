CREATE TABLE `discovery_progress` (
	`visitor` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL
);
