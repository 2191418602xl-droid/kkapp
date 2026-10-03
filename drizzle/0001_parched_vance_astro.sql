CREATE TABLE `chat_quota` (
	`key` text PRIMARY KEY NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer NOT NULL
);
