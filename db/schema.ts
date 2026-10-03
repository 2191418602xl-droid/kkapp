import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const agentProfiles = sqliteTable('agent_profiles', {
  id: text('id').primaryKey(),
  visitor: text('visitor').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull().default(''),
  personality: text('personality').notNull(),
  background: text('background').notNull(),
  greeting: text('greeting').notNull(),
  tags: text('tags').notNull().default('[]'),
  lorebook: text('lorebook').notNull().default('[]'),
  provenance: text('provenance').notNull().default('{}'),
  voice: text('voice').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_agent_profiles_visitor_created').on(table.visitor, table.createdAt)]);

export const discoveryProgress = sqliteTable('discovery_progress', {
  visitor: text('visitor').primaryKey(),
  revision: integer('revision').notNull(),
  data: text('data').notNull(),
});

export const chatQuota = sqliteTable('chat_quota', {
  key: text('key').primaryKey(),
  bucket: integer('bucket').notNull(),
  count: integer('count').notNull(),
});

export const generatedImages = sqliteTable('generated_images', {
  id: text('id').primaryKey(),
  visitor: text('visitor').notNull(),
  prompt: text('prompt').notNull(),
  size: text('size').notNull(),
  mime: text('mime').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_generated_images_visitor_created').on(table.visitor, table.createdAt)]);

export const diamondLedger = sqliteTable('diamond_ledger', {
  id: text('id').primaryKey(),
  visitor: text('visitor').notNull(),
  claimKey: text('claim_key').notNull(),
  kind: text('kind').notNull(),
  amount: integer('amount').notNull(),
  day: text('day').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('diamond_visitor_claim').on(table.visitor, table.claimKey)]);

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  characterId: text('character_id').notNull(),
  world: text('world').notNull().default(''),
  stage: integer('stage').notNull().default(0),
  activeRequest: text('active_request'),
  lockUntil: integer('lock_until').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('conversation_owner_character_world').on(table.owner, table.characterId, table.world)]);

export const conversationTurns = sqliteTable('conversation_turns', {
  id: text('id').primaryKey(),
  conversation: text('conversation').notNull().references(() => conversations.id),
  requestId: text('request_id').notNull(),
  action: text('action').notNull(),
  prompt: text('prompt').notNull(),
  reply: text('reply').notNull().default(''),
  status: text('status').notNull(),
  attempt: integer('attempt').notNull().default(0),
  lease: text('lease').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('turn_conversation_request').on(table.conversation, table.requestId), index('turn_conversation_created').on(table.conversation, table.createdAt)]);

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
});

export const walletLedger = sqliteTable('wallet_ledger', {
  id: text('id').primaryKey(),
  account: text('account').notNull(),
  claimKey: text('claim_key').notNull(),
  kind: text('kind').notNull(),
  amount: integer('amount').notNull(),
  day: text('day').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('wallet_account_claim').on(table.account, table.claimKey),
  index('idx_wallet_account_created').on(table.account, table.createdAt),
]);

export const membershipTrials = sqliteTable('membership_trials', {
  id: text('id').primaryKey(),
  account: text('account').notNull(),
  grantedAt: text('granted_at').notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  uniqueIndex('membership_trial_account').on(table.account),
]);

export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(),
  account: text('account').notNull(),
  startsAt: text('starts_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  // NOT NULL UNIQUE — prevents duplicate fulfillment
  sourceOrder: text('source_order').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('membership_source_order').on(table.sourceOrder),
  index('idx_memberships_account_expires').on(table.account, table.expiresAt),
]);

export const chatQuotaDaily = sqliteTable('chat_quota_daily', {
  id: text('id').primaryKey(),
  account: text('account').notNull(),
  day: text('day').notNull(),
  reserved: integer('reserved').notNull().default(0),
  committed: integer('committed').notNull().default(0),
  refunded: integer('refunded').notNull().default(0),
  debited: integer('debited').notNull().default(0),
}, (table) => [
  uniqueIndex('chat_quota_account_day').on(table.account, table.day),
]);

export const chatReservations = sqliteTable('chat_reservations', {
  id: text('id').primaryKey(),
  account: text('account').notNull(),
  requestKey: text('request_key').notNull(),
  status: text('status').notNull(),
  day: text('day').notNull(),
  paid: integer('paid').notNull().default(0),
  cost: integer('cost').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('chat_reservation_account_key').on(table.account, table.requestKey),
  index('idx_chat_reservations_account_day').on(table.account, table.day),
]);

// Commit guard — CHECK(status='reserved') prevents duplicate/replay commits
export const commitGuard = sqliteTable('commit_guard', {
  reservationId: text('reservation_id').primaryKey(),
  account: text('account').notNull(),
  status: text('status').notNull(),
  committedAt: text('committed_at').notNull(),
}, table => [check('commit_only_reserved', sql`${table.status} = 'reserved'`)]);

// Refund guard — CHECK(status='reserved') prevents duplicate/replay refunds
export const refundGuard = sqliteTable('refund_guard', {
  reservationId: text('reservation_id').primaryKey(),
  account: text('account').notNull(),
  status: text('status').notNull(),
  refundedAt: text('refunded_at').notNull(),
}, table => [check('refund_only_reserved', sql`${table.status} = 'reserved'`)]);

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  account: text('account').notNull(),
  productId: text('product_id').notNull(),
  productType: text('product_type').notNull(),
  productTitle: text('product_title').notNull(),
  productAmount: integer('product_amount').notNull().default(0),
  productDurationDays: integer('product_duration_days').notNull().default(0),
  status: text('status').notNull(),
  priceFen: integer('price_fen').notNull(),
  testMode: integer('test_mode').notNull().default(0),
  idempotencyKey: text('idempotency_key').notNull(),
  paymentEvent: text('payment_event'),
  createdAt: text('created_at').notNull(),
  paidAt: text('paid_at'),
  fulfilledAt: text('fulfilled_at'),
  cancelledAt: text('cancelled_at'),
}, (table) => [
  uniqueIndex('order_account_idempotency').on(table.account, table.idempotencyKey),
  index('idx_orders_account_created').on(table.account, table.createdAt),
  uniqueIndex('idx_orders_starter_active').on(table.account, table.productId).where(sql`${table.productId} = 'starter' AND ${table.status} IN ('pending','paid','fulfilled')`),
  uniqueIndex('order_payment_event_unique').on(table.paymentEvent),
]);

export const orderEvents = sqliteTable('order_events', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  event: text('event').notNull(),
  detail: text('detail').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_order_events_order_created').on(table.orderId, table.createdAt),
  uniqueIndex('order_event_once').on(table.orderId, table.event),
]);

export const e2eEvents = sqliteTable('e2e_events', {
 id: text('id').primaryKey(), source: text('source').notNull(), event: text('event').notNull(), userId: text('user_id'), sessionId: text('session_id').notNull(), messageId: text('message_id'), traceId: text('trace_id'), orderId: text('order_id'), detail: text('detail').notNull(), createdAt: text('created_at').notNull(),
}, table=>[index('idx_e2e_session_user').on(table.sessionId,table.userId)]);
