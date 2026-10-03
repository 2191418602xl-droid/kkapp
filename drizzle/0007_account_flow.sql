CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_quota_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`day` text NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`committed` integer DEFAULT 0 NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	`debited` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_quota_account_day` ON `chat_quota_daily` (`account`,`day`);--> statement-breakpoint
CREATE TABLE `chat_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`request_key` text NOT NULL,
	`status` text NOT NULL,
	`day` text NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_reservation_account_key` ON `chat_reservations` (`account`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_chat_reservations_account_day` ON `chat_reservations` (`account`,`day`);--> statement-breakpoint
CREATE TABLE `commit_guard` (
	`reservation_id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`status` text NOT NULL,
	`committed_at` text NOT NULL,
	CONSTRAINT "commit_only_reserved" CHECK("commit_guard"."status" = 'reserved')
);
--> statement-breakpoint
CREATE TABLE `conversation_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation` text NOT NULL,
	`request_id` text NOT NULL,
	`action` text NOT NULL,
	`prompt` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`lease` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turn_conversation_request` ON `conversation_turns` (`conversation`,`request_id`);--> statement-breakpoint
CREATE INDEX `turn_conversation_created` ON `conversation_turns` (`conversation`,`created_at`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`character_id` text NOT NULL,
	`world` text DEFAULT '' NOT NULL,
	`stage` integer DEFAULT 0 NOT NULL,
	`active_request` text,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_owner_character_world` ON `conversations` (`owner`,`character_id`,`world`);--> statement-breakpoint
CREATE TABLE `membership_trials` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`granted_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_trial_account` ON `membership_trials` (`account`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`starts_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`source_order` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_source_order` ON `memberships` (`source_order`);--> statement-breakpoint
CREATE INDEX `idx_memberships_account_expires` ON `memberships` (`account`,`expires_at`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`event` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order_created` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_event_once` ON `order_events` (`order_id`,`event`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`product_id` text NOT NULL,
	`product_type` text NOT NULL,
	`product_title` text NOT NULL,
	`product_amount` integer DEFAULT 0 NOT NULL,
	`product_duration_days` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`price_fen` integer NOT NULL,
	`test_mode` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text NOT NULL,
	`payment_event` text,
	`created_at` text NOT NULL,
	`paid_at` text,
	`fulfilled_at` text,
	`cancelled_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_account_idempotency` ON `orders` (`account`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_orders_account_created` ON `orders` (`account`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_starter_active` ON `orders` (`account`,`product_id`) WHERE "orders"."product_id" = 'starter' AND "orders"."status" IN ('pending','paid','fulfilled');--> statement-breakpoint
CREATE UNIQUE INDEX `order_payment_event_unique` ON `orders` (`payment_event`);--> statement-breakpoint
CREATE TABLE `refund_guard` (
	`reservation_id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`status` text NOT NULL,
	`refunded_at` text NOT NULL,
	CONSTRAINT "refund_only_reserved" CHECK("refund_guard"."status" = 'reserved')
);
--> statement-breakpoint
CREATE TABLE `wallet_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`claim_key` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_account_claim` ON `wallet_ledger` (`account`,`claim_key`);--> statement-breakpoint
CREATE INDEX `idx_wallet_account_created` ON `wallet_ledger` (`account`,`created_at`);
