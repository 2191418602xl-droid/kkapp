/**
 * WB-004 account-commerce shared types, constants, and pure helpers.
 * No D1 dependency — safe to import from client and server.
 */

// ---------------------------------------------------------------------------
// D1-compatible interfaces (for type annotations only)
// ---------------------------------------------------------------------------

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ meta: { changes: number } }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<{ meta: { changes: number } }[]>;
}

// ---------------------------------------------------------------------------
// Product catalog (server-controlled)
// ---------------------------------------------------------------------------

export type ProductType = 'diamonds' | 'membership';

export interface Product {
  id: string;
  type: ProductType;
  title: string;
  amount: number;
  durationDays: number;
  priceFen: number;
  once: boolean;
}

export const PRODUCTS: Product[] = [
  { id: 'starter',      type: 'diamonds',  title: '萌新体验包',   amount: 600,   durationDays: 0,  priceFen: 600,  once: true  },
  { id: 'd60',          type: 'diamonds',  title: '60 钻石',      amount: 60,    durationDays: 0,  priceFen: 100,  once: false },
  { id: 'd300',         type: 'diamonds',  title: '300 钻石',     amount: 300,   durationDays: 0,  priceFen: 500,  once: false },
  { id: 'd680',         type: 'diamonds',  title: '680 钻石',     amount: 680,   durationDays: 0,  priceFen: 1200, once: false },
  { id: 'd1980',        type: 'diamonds',  title: '1,980 钻石',   amount: 1980,  durationDays: 0,  priceFen: 3000, once: false },
  { id: 'd3280',        type: 'diamonds',  title: '3,280 钻石',   amount: 3280,  durationDays: 0,  priceFen: 5000, once: false },
  { id: 'd6480',        type: 'diamonds',  title: '6,480 钻石',   amount: 6480,  durationDays: 0,  priceFen: 9800, once: false },
  { id: 'membership30', type: 'membership', title: '30 天会员',  amount: 0,     durationDays: 30, priceFen: 2990, once: false },
];

export const DAILY_REWARDS = [1, 4, 6, 8, 10, 12, 25];
export const SIGNUP_GIFT = 5;
export const TRIAL_DURATION_HOURS = 24;
export const MEMBERSHIP_DURATION_DAYS = 30;
export const FREE_REPLIES_BASIC = 3;
export const FREE_REPLIES_MEMBER = 20;
export const CHAT_DEBIT_DIAMONDS = 1;

// ---------------------------------------------------------------------------
// Public types (camelCase — mapped from DB snake_case)
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'failed';
export type MembershipKind = 'none' | 'trial' | 'paid';
export type ReservationStatus = 'reserved' | 'committed' | 'refunded';

export interface WalletState {
  balance: number;
  checked: boolean;
  streak: number;
  reward: number;
  starterBought: boolean;
  history: { id: string; kind: string; amount: number; day: string; createdAt: string }[];
}

export interface MembershipState {
  kind: MembershipKind;
  expiresAt: string | null;
  freeReplyLimit: number;
  trialUsed: boolean;
}

export interface ChatQuotaState {
  day: string;
  reserved: number;
  committed: number;
  refunded: number;
  debited: number;
  freeRemaining: number;
}

export interface ChatReservation {
  reservationId: string;
  paid: boolean;
  cost: number;
  day: string;
}

export interface AccountState {
  accountId: string;
  createdAt: string;
  wallet: WalletState;
  membership: MembershipState;
  chatQuota: ChatQuotaState;
}

export interface OrderRow {
  id: string;
  account: string;
  productId: string;
  productType: ProductType;
  productTitle: string;
  productAmount: number;
  productDurationDays: number;
  status: OrderStatus;
  priceFen: number;
  testMode: boolean;
  idempotencyKey: string;
  paymentEvent: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
}

export interface GmvState {
  totalFen: number;
  orderCount: number;
}

// ---------------------------------------------------------------------------
// Internal DB row type (snake_case, raw SELECT * mapping)
// ---------------------------------------------------------------------------

export interface DbOrderRow {
  id: string;
  account: string;
  product_id: string;
  product_type: string;
  product_title: string;
  product_amount: number;
  product_duration_days: number;
  status: string;
  price_fen: number;
  test_mode: number;
  idempotency_key: string;
  payment_event: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const ERRORS = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRIAL_ALREADY_GRANTED: 'TRIAL_ALREADY_GRANTED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_NOT_CANCELLABLE: 'ORDER_NOT_CANCELLABLE',
  ORDER_NOT_FULFILLABLE: 'ORDER_NOT_FULFILLABLE',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_ALREADY_BOUGHT: 'PRODUCT_ALREADY_BOUGHT',
  PRODUCT_CHANGED: 'PRODUCT_CHANGED',
  PAYMENT_UNAVAILABLE: 'PAYMENT_UNAVAILABLE',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',
  DUPLICATE_ORDER: 'DUPLICATE_ORDER',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  RESERVATION_NOT_COMMITTABLE: 'RESERVATION_NOT_COMMITTABLE',
} as const;

export class AccountError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function beijingDate(offsetDays = 0): string {
  return new Date(Date.now() + 8 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
export function nowIso(): string { return new Date().toISOString(); }
export function isoFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}
export function isoFromNowDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
export function findProduct(productId: string): Product | undefined {
  return PRODUCTS.find(p => p.id === productId);
}
export function freeReplyLimitFor(kind: MembershipKind): number {
  return kind === 'none' ? FREE_REPLIES_BASIC : FREE_REPLIES_MEMBER;
}
export function validateOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Map raw DB row (snake_case) to public OrderRow (camelCase). */
export function mapOrder(row: DbOrderRow): OrderRow {
  return {
    id: row.id,
    account: row.account,
    productId: row.product_id,
    productType: row.product_type as ProductType,
    productTitle: row.product_title,
    productAmount: row.product_amount,
    productDurationDays: row.product_duration_days,
    status: row.status as OrderStatus,
    priceFen: row.price_fen,
    testMode: row.test_mode !== 0,
    idempotencyKey: row.idempotency_key,
    paymentEvent: row.payment_event,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
  };
}
