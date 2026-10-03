/**
 * WB-004 account-commerce server-side functions (revised per Codex recheck).
 *
 * Concurrency fixes:
 *  1. reserveChatReply: cost computed by SQL subquery INSIDE the reservation INSERT.
 *     Reservation insertion and debit in ONE D1 batch. No JS gap between count
 *     and insert. Refunded keys throw RESERVATION_NOT_COMMITTABLE.
 *  2. commitChatReply: guard table with CHECK(status='reserved') as first batch
 *     statement. Catches conflict, rereads for replay. additionalStatements run
 *     ONLY on first successful reserved→committed transition.
 *  3. refundChatReply: transition + credit in one batch with refund_guard.
 *     Failure leaves no side effects (batch ROLLBACK).
 *  4. Test settlement batches snapshot credit, status and events atomically.
 *     No payment endpoint is exposed until a real merchant is integrated.
 *  5. Starter product: DB partial UNIQUE index. createOrder catches constraint.
 *  6. cancelOrder: batch conditional update + event. Returns 409 on state change.
 */

import {
  PRODUCTS, DAILY_REWARDS, SIGNUP_GIFT, TRIAL_DURATION_HOURS,
  FREE_REPLIES_BASIC, FREE_REPLIES_MEMBER, CHAT_DEBIT_DIAMONDS,
  type Product, type WalletState, type MembershipState,
  type ChatQuotaState, type ChatReservation,
  type AccountState, type OrderRow, type DbOrderRow, type GmvState,
  type D1Database, type D1PreparedStatement,
  ERRORS, AccountError,
  beijingDate, nowIso, isoFromNow, findProduct, mapOrder,
} from './account-shared';

// ===========================================================================
// ACCOUNT
// ===========================================================================

export async function ensureAccount(db: D1Database, accountId: string): Promise<AccountState> {
  const now = nowIso();
  const day = beijingDate();

  // Batch: insert account + signup gift atomically
  const stmt1 = db.prepare(
    'INSERT INTO accounts (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING'
  ).bind(accountId, now);
  const stmt2 = db.prepare(
    'INSERT INTO wallet_ledger (id, account, claim_key, kind, amount, day, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account, claim_key) DO NOTHING'
  ).bind(crypto.randomUUID(), accountId, 'signup_gift', '注册赠送', SIGNUP_GIFT, day, now);

  await db.batch([stmt1, stmt2]);

  return getAccountState(db, accountId);
}

export async function getAccountState(db: D1Database, accountId: string): Promise<AccountState> {
  const wallet = await getWalletState(db, accountId);
  const membership = await getMembershipState(db, accountId);
  const chatQuota = await getChatQuotaState(db, accountId);

  const row = await db.prepare('SELECT created_at FROM accounts WHERE id = ?')
    .bind(accountId).first<{ created_at: string }>();

  return {
    accountId,
    createdAt: row?.created_at ?? nowIso(),
    wallet,
    membership,
    chatQuota,
  };
}

// ===========================================================================
// WALLET & DAILY REWARDS
// ===========================================================================

export async function getWalletState(db: D1Database, accountId: string): Promise<WalletState> {
  const result = await db.prepare(
    'SELECT id, kind, amount, day, created_at FROM wallet_ledger ' +
    'WHERE account = ? ORDER BY created_at DESC'
  ).bind(accountId).all<{ id: string; kind: string; amount: number; day: string; created_at: string }>();

  const rows = result.results;
  const days = new Set(rows.filter(r => r.kind === '每日签到').map(r => r.day));
  const today = beijingDate();
  const checked = days.has(today);

  let streak = 0;
  for (let offset = checked ? 0 : -1; days.has(beijingDate(offset)); offset--) streak++;

  const balance = rows.reduce((sum, r) => sum + r.amount, 0);
  const reward = DAILY_REWARDS[(checked ? Math.max(streak - 1, 0) : streak) % 7];
  const starterBought = rows.some(r => r.kind === '萌新体验包');

  return {
    balance, checked, streak, reward, starterBought,
    history: rows.slice(0, 30).map(r => ({ ...r, createdAt: r.created_at })),
  };
}

export async function claimDailyReward(db: D1Database, accountId: string): Promise<WalletState> {
  const now = nowIso();
  const day = beijingDate();
  const state = await getWalletState(db, accountId);

  await db.prepare(
    'INSERT INTO wallet_ledger (id, account, claim_key, kind, amount, day, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account, claim_key) DO NOTHING'
  ).bind(crypto.randomUUID(), accountId, `checkin:${day}`, '每日签到', state.reward, day, now).run();

  return getWalletState(db, accountId);
}

// ===========================================================================
// MEMBERSHIP
// ===========================================================================

export async function getMembershipState(db: D1Database, accountId: string): Promise<MembershipState> {
  const now = nowIso();

  const paid = await db.prepare(
    'SELECT expires_at FROM memberships WHERE account = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1'
  ).bind(accountId, now).first<{ expires_at: string }>();

  if (paid) {
    return { kind: 'paid', expiresAt: paid.expires_at, freeReplyLimit: FREE_REPLIES_MEMBER, trialUsed: await isTrialUsed(db, accountId) };
  }

  const trial = await db.prepare(
    'SELECT expires_at FROM membership_trials WHERE account = ? AND expires_at > ?'
  ).bind(accountId, now).first<{ expires_at: string }>();

  if (trial) {
    return { kind: 'trial', expiresAt: trial.expires_at, freeReplyLimit: FREE_REPLIES_MEMBER, trialUsed: true };
  }

  return { kind: 'none', expiresAt: null, freeReplyLimit: FREE_REPLIES_BASIC, trialUsed: await isTrialUsed(db, accountId) };
}

async function isTrialUsed(db: D1Database, accountId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM membership_trials WHERE account = ?')
    .bind(accountId).first();
  return row !== null;
}

export async function grantTrial(db: D1Database, accountId: string): Promise<MembershipState> {
  if (await isTrialUsed(db, accountId)) {
    throw new AccountError(ERRORS.TRIAL_ALREADY_GRANTED, '试用已领取，无法重复领取。', 409);
  }

  const now = nowIso();
  const expires = isoFromNow(TRIAL_DURATION_HOURS);

  await db.prepare(
    'INSERT INTO membership_trials (id, account, granted_at, expires_at) ' +
    'VALUES (?, ?, ?, ?) ON CONFLICT(account) DO NOTHING'
  ).bind(crypto.randomUUID(), accountId, now, expires).run();

  return getMembershipState(db, accountId);
}

// ===========================================================================
// CHAT QUOTA — atomic subquery cost, guard-table batch commit/refund
// ===========================================================================

export async function getChatQuotaState(
  db: D1Database, accountId: string
): Promise<ChatQuotaState> {
  const day = beijingDate();
  const membership = await getMembershipState(db, accountId);

  const row = await db.prepare(
    "SELECT " +
    "COALESCE(SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END), 0) AS reserved, " +
    "COALESCE(SUM(CASE WHEN status = 'committed' THEN 1 ELSE 0 END), 0) AS committed, " +
    "COALESCE(SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END), 0) AS refunded, " +
    "COALESCE(SUM(CASE WHEN paid = 1 AND status = 'committed' THEN 1 ELSE 0 END), 0) AS debited " +
    "FROM chat_reservations WHERE account = ? AND day = ?"
  ).bind(accountId, day).first<{ reserved: number; committed: number; refunded: number; debited: number }>();

  const reserved = row?.reserved ?? 0;
  const committed = row?.committed ?? 0;
  const refunded = row?.refunded ?? 0;
  const debited = row?.debited ?? 0;

  // Active = reserved (not yet committed/refunded); free used = committed + active
  const freeUsed = committed + reserved;
  const freeRemaining = Math.max(0, membership.freeReplyLimit - freeUsed);

  return { day, reserved, committed, refunded, debited, freeRemaining };
}

/**
 * Reserve a chat reply BEFORE calling the AI provider.
 *
 * CONCURRENCY FIX: cost is computed by a SQL subquery INSIDE the reservation
 * INSERT — no JS gap between count and insert. The reservation INSERT and the
 * diamond debit are in ONE D1 batch (single transaction).
 *
 * reservationId = user-scoped idempotency key (chat turn ID).
 * Retries with the same key return the existing reservation.
 * Refunded keys throw RESERVATION_NOT_COMMITTABLE (client must allocate new key).
 */
export async function reserveChatReply(
  db: D1Database, accountId: string, reservationId: string
): Promise<ChatReservation> {
  // 1. Check existing reservation (idempotent retry)
  const existing = await db.prepare(
    'SELECT status, paid, cost, day FROM chat_reservations WHERE account = ? AND request_key = ?'
  ).bind(accountId, reservationId).first<{ status: string; paid: number; cost: number; day: string }>();

  if (existing) {
    if (existing.status === 'reserved') {
      return { reservationId, paid: existing.paid === 1, cost: existing.cost, day: existing.day };
    } else if (existing.status === 'committed') {
      return { reservationId, paid: existing.paid === 1, cost: existing.cost, day: existing.day };
    } else {
      // Refunded — Codex requires error, not silent return
      throw new AccountError(
        ERRORS.RESERVATION_NOT_COMMITTABLE,
        '该对话已取消，请发起新对话。', 409
      );
    }
  }

  const day = beijingDate();
  const now = nowIso();
  const membership = await getMembershipState(db, accountId);
  const freeLimit = membership.freeReplyLimit;
  const debitKey = `chat_debit:${day}:${reservationId}`;

  // 2. SINGLE BATCH: reservation INSERT (with subquery cost) + conditional debit
  //    The subquery counts active+committed reservations for the day atomically.
  //    No JS gap between count and insert — the count is evaluated inside the INSERT.

  const reservationStmt = db.prepare(
    'INSERT INTO chat_reservations (id, account, request_key, status, day, paid, cost, created_at) ' +
    'SELECT ?, ?, ?, \'reserved\', ?, ' +
    // paid: 1 if active+committed count >= freeLimit, else 0
    '(SELECT CASE WHEN COUNT(*) >= ? THEN 1 ELSE 0 END ' +
    ' FROM chat_reservations WHERE account = ? AND day = ? AND status IN (\'reserved\',\'committed\')), ' +
    // cost: CHAT_DEBIT_DIAMONDS if paid, else 0
    '(SELECT CASE WHEN COUNT(*) >= ? THEN ? ELSE 0 END ' +
    ' FROM chat_reservations WHERE account = ? AND day = ? AND status IN (\'reserved\',\'committed\')), ' +
    '? ' +
    'ON CONFLICT(account, request_key) DO NOTHING'
  ).bind(
    reservationId, accountId, reservationId, day,
    freeLimit, accountId, day,         // paid subquery
    freeLimit, CHAT_DEBIT_DIAMONDS, accountId, day,  // cost subquery
    now                               // created_at
  );

  // Debit: only if reservation is paid AND balance sufficient
  const debitStmt = db.prepare(
    'INSERT INTO wallet_ledger (id, account, claim_key, kind, amount, day, created_at) ' +
    'SELECT ?, ?, ?, ?, ?, ?, ? ' +
    'WHERE EXISTS (SELECT 1 FROM chat_reservations WHERE id = ? AND account = ? AND paid = 1) ' +
    'AND (SELECT COALESCE(SUM(amount), 0) FROM wallet_ledger WHERE account = ?) >= ? ' +
    'ON CONFLICT(account, claim_key) DO NOTHING'
  ).bind(
    crypto.randomUUID(), accountId, debitKey, '对话消耗', -CHAT_DEBIT_DIAMONDS, day, now,
    reservationId, accountId,  // EXISTS check
    accountId, CHAT_DEBIT_DIAMONDS  // balance check
  );

  // An insufficient debit must roll back the reservation too. A conditional
  // INSERT affecting zero rows does not itself fail a transaction.
  const debitGuard = db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM chat_reservations r WHERE r.account = ? AND r.request_key = ? AND (r.cost = 0 OR EXISTS (SELECT 1 FROM wallet_ledger w WHERE w.account = r.account AND w.claim_key = 'chat_debit:' || r.day || ':' || r.request_key AND w.amount = -r.cost))) THEN 1 ELSE json('insufficient_chat_balance') END").bind(accountId, reservationId);
  try { await db.batch([reservationStmt, debitStmt, debitGuard]); }
  catch (error) {
    const balance = await db.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM wallet_ledger WHERE account = ?').bind(accountId).first<{ balance: number }>();
    if ((balance?.balance ?? 0) < CHAT_DEBIT_DIAMONDS) throw new AccountError(ERRORS.INSUFFICIENT_BALANCE, '钻石不足，无法发送消息。', 402);
    throw error;
  }

  // 3. Read back the reservation to determine result
  const result = await db.prepare(
    'SELECT status, paid, cost, day FROM chat_reservations WHERE account = ? AND request_key = ?'
  ).bind(accountId, reservationId).first<{ status: string; paid: number; cost: number; day: string }>();

  if (!result) {
    // Should not happen — INSERT with ON CONFLICT DO NOTHING should at least keep existing row
    throw new AccountError(ERRORS.RESERVATION_NOT_FOUND, '对话预约创建失败。', 500);
  }

  if (result.paid === 0) {
    // Free reply — no debit needed
    return { reservationId, paid: false, cost: 0, day: result.day };
  }

  // Paid reply — check if debit succeeded
  const debitExists = await db.prepare(
    'SELECT 1 FROM wallet_ledger WHERE account = ? AND claim_key = ?'
  ).bind(accountId, debitKey).first();

  if (debitExists) {
    return { reservationId, paid: true, cost: CHAT_DEBIT_DIAMONDS, day: result.day };
  }

  // Debit failed (insufficient balance) — delete the unpaid reservation and throw
  await db.prepare(
    'DELETE FROM chat_reservations WHERE id = ? AND account = ? AND paid = 1 AND status = \'reserved\''
  ).bind(reservationId, accountId).run();

  throw new AccountError(ERRORS.INSUFFICIENT_BALANCE, '钻石不足，无法发送消息。', 402);
}

/**
 * Commit a reserved reply after the AI provider returns successfully.
 *
 * CONCURRENCY FIX: Uses commit_guard table with CHECK(status='reserved') as the
 * first statement in the batch. If the status is not 'reserved' (already
 * committed or refunded), the CHECK constraint fails, the batch aborts
 * (ROLLBACK), and additionalStatements do NOT execute.
 *
 * Catches the constraint error and rereads for already-committed replay.
 * additionalStatements run ONLY on first successful reserved→committed transition.
 */
export async function commitChatReply(
  db: D1Database,
  accountId: string,
  reservationId: string,
  additionalStatements?: D1PreparedStatement[]
): Promise<void> {
  // Pre-read for day and fast-path replay check
  const reservation = await db.prepare(
    "SELECT day, status FROM chat_reservations WHERE account = ? AND request_key = ?"
  ).bind(accountId, reservationId).first<{ day: string; status: string }>();

  if (!reservation) {
    throw new AccountError(ERRORS.RESERVATION_NOT_FOUND, '对话预约不存在。', 404);
  }

  // Already committed — idempotent replay, no batch needed
  if (reservation.status === 'committed') return;

  // Refunded or other — cannot commit
  if (reservation.status !== 'reserved') {
    throw new AccountError(ERRORS.RESERVATION_NOT_COMMITTABLE, '对话预约已取消或已退还。', 409);
  }

  const day = reservation.day;
  const now = nowIso();

  // Build atomic batch with guard as first statement:
  // 1. Guard: INSERT into commit_guard — fails CHECK if status != 'reserved',
  //    fails PRIMARY KEY if already committed (replay under race)
  // 2. UPDATE reservation status to 'committed'
  // 3. Update quota
  // 4. Caller's additional statements — run ONLY if guard passed (batch atomicity)

  const guardStmt = db.prepare(
    'INSERT INTO commit_guard (reservation_id, account, status, committed_at) ' +
    'SELECT ?, account, status, ? FROM chat_reservations WHERE id = ? AND account = ?'
  ).bind(reservationId, now, reservationId, accountId);

  const updateStmt = db.prepare(
    "UPDATE chat_reservations SET status = 'committed' " +
    "WHERE id = ? AND account = ?"
  ).bind(reservationId, accountId);

  const quotaStmt = db.prepare(
    'INSERT INTO chat_quota_daily (id, account, day, reserved, committed, refunded, debited) ' +
    'VALUES (?, ?, ?, 0, 1, 0, 0) ' +
    'ON CONFLICT(account, day) DO UPDATE SET committed = chat_quota_daily.committed + 1'
  ).bind(crypto.randomUUID(), accountId, day);

  const statements = [guardStmt, updateStmt, quotaStmt, ...(additionalStatements ?? [])];

  try {
    await db.batch(statements);
  } catch (error) {
    // Guard failed (CHECK constraint or PRIMARY KEY conflict) — reread and handle
    const reread = await db.prepare(
      "SELECT status FROM chat_reservations WHERE account = ? AND request_key = ?"
    ).bind(accountId, reservationId).first<{ status: string }>();

    if (!reread) {
      throw new AccountError(ERRORS.RESERVATION_NOT_FOUND, '对话预约不存在。', 404);
    }
    if (reread.status === 'committed') return; // concurrent commit — idempotent
    if (reread.status === 'reserved') throw error;
    throw new AccountError(ERRORS.RESERVATION_NOT_COMMITTABLE, '对话预约已取消或已退还。', 409);
  }
}

/**
 * Refund a reserved reply when the AI provider fails.
 *
 * CONCURRENCY FIX: Uses refund_guard table with CHECK(status='reserved') as the
 * first statement in the batch. Transition + credit + quota update are all in
 * one atomic batch. If the guard fails (already refunded or committed), the
 * entire batch is a no-op (ROLLBACK).
 *
 * Idempotent — double-refund is a no-op.
 */
export async function refundChatReply(
  db: D1Database, accountId: string, reservationId: string
): Promise<void> {
  // Pre-read for status and values
  const reservation = await db.prepare(
    "SELECT day, paid, cost, status FROM chat_reservations WHERE account = ? AND request_key = ?"
  ).bind(accountId, reservationId).first<{ day: string; paid: number; cost: number; status: string }>();

  if (!reservation) return; // no reservation — nothing to refund

  // Already committed or refunded — no-op
  if (reservation.status !== 'reserved') return;

  const day = reservation.day;
  const now = nowIso();
  const refundKey = `chat_refund:${day}:${reservationId}`;

  // Build atomic batch with guard:
  // 1. Guard: INSERT into refund_guard — fails CHECK if status != 'reserved',
  //    fails PRIMARY KEY if already refunded
  // 2. UPDATE reservation status to 'refunded'
  // 3. Refund credit — conditional on paid=1 (uses reservation's cost)
  // 4. Update quota refunded counter

  const guardStmt = db.prepare(
    'INSERT INTO refund_guard (reservation_id, account, status, refunded_at) ' +
    'SELECT ?, account, status, ? FROM chat_reservations WHERE id = ? AND account = ?'
  ).bind(reservationId, now, reservationId, accountId);

  const updateStmt = db.prepare(
    "UPDATE chat_reservations SET status = 'refunded' " +
    "WHERE id = ? AND account = ?"
  ).bind(reservationId, accountId);

  // Refund credit: only if reservation was paid (paid=1 AND cost>0)
  // Uses the cost value from the reservation row
  const refundStmt = db.prepare(
    'INSERT INTO wallet_ledger (id, account, claim_key, kind, amount, day, created_at) ' +
    'SELECT ?, account, ?, ?, cost, day, ? ' +
    'FROM chat_reservations WHERE id = ? AND account = ? AND paid = 1 AND cost > 0 ' +
    "AND EXISTS (SELECT 1 FROM wallet_ledger w WHERE w.account = chat_reservations.account AND w.claim_key = 'chat_debit:' || chat_reservations.day || ':' || chat_reservations.request_key AND w.amount = -chat_reservations.cost) " +
    'ON CONFLICT(account, claim_key) DO NOTHING'
  ).bind(crypto.randomUUID(), refundKey, '对话退还', now, reservationId, accountId);

  const quotaStmt = db.prepare(
    'INSERT INTO chat_quota_daily (id, account, day, reserved, committed, refunded, debited) ' +
    'VALUES (?, ?, ?, 0, 0, 1, 0) ' +
    'ON CONFLICT(account, day) DO UPDATE SET refunded = chat_quota_daily.refunded + 1'
  ).bind(crypto.randomUUID(), accountId, day);

  try {
    await db.batch([guardStmt, updateStmt, refundStmt, quotaStmt]);
  } catch (error) {
    const current = await db.prepare('SELECT status FROM chat_reservations WHERE account = ? AND request_key = ?').bind(accountId, reservationId).first<{ status: string }>();
    if (current && current.status !== 'reserved') return;
    throw error;
  }
}

// ===========================================================================
// COMMERCE
// ===========================================================================

export function listProducts(): Product[] {
  return PRODUCTS;
}

export async function createOrder(db: D1Database, accountId: string, productId: string, idempotencyKey: string): Promise<OrderRow> {
  const product = findProduct(productId);
  if (!product) throw new AccountError(ERRORS.PRODUCT_NOT_FOUND, '套餐不存在。', 404);
  const lookup = () => db.prepare('SELECT * FROM orders WHERE account = ? AND idempotency_key = ?').bind(accountId, idempotencyKey).first<DbOrderRow>();
  const validate = (row: DbOrderRow) => {
    if (row.product_id !== productId) throw new AccountError(ERRORS.PRODUCT_CHANGED, '同一订单请求不能更换套餐。', 409);
    return mapOrder(row);
  };
  const existing = await lookup(); if (existing) return validate(existing);
  const now = nowIso(), id = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare('INSERT INTO orders (id, account, product_id, product_type, product_title, product_amount, product_duration_days, status, price_fen, test_mode, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT(account, idempotency_key) DO NOTHING').bind(id, accountId, productId, product.type, product.title, product.amount, product.durationDays, 'pending', product.priceFen, idempotencyKey, now),
      db.prepare("INSERT INTO order_events (id, order_id, event, detail, created_at) SELECT ?, id, 'created', '{}', ? FROM orders WHERE id = ? ON CONFLICT(order_id, event) DO NOTHING").bind(crypto.randomUUID(), now, id),
    ]);
  } catch (error) {
    const replay = await lookup(); if (replay) return validate(replay);
    if (product.once && await db.prepare("SELECT 1 FROM orders WHERE account = ? AND product_id = ? AND status IN ('pending','paid','fulfilled')").bind(accountId, productId).first()) throw new AccountError(ERRORS.PRODUCT_ALREADY_BOUGHT, '该套餐已有有效订单，请到订单列表查看。', 409);
    throw error;
  }
  const row = await lookup();
  if (!row) throw new AccountError(ERRORS.ORDER_NOT_FOUND, '订单暂时未创建，请重试。', 503);
  return validate(row);
}

export async function getAccountOrders(db: D1Database, accountId: string): Promise<OrderRow[]> {
  const result = await db.prepare(
    'SELECT * FROM orders WHERE account = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(accountId).all<DbOrderRow>();
  return result.results.map(mapOrder);
}

export async function getOrder(db: D1Database, accountId: string, orderId: string): Promise<OrderRow | null> {
  const row = await db.prepare('SELECT * FROM orders WHERE id = ? AND account = ?')
    .bind(orderId, accountId).first<DbOrderRow>();
  return row ? mapOrder(row) : null;
}

export async function cancelOrder(db: D1Database, accountId: string, orderId: string): Promise<OrderRow> {
  const row = await db.prepare('SELECT * FROM orders WHERE id = ? AND account = ?')
    .bind(orderId, accountId).first<DbOrderRow>();
  if (!row) throw new AccountError(ERRORS.ORDER_NOT_FOUND, '订单不存在。', 404);
  if (row.status !== 'pending') throw new AccountError(ERRORS.ORDER_NOT_CANCELLABLE, '订单无法取消。', 409);

  const now = nowIso();

  // Atomic batch: conditional UPDATE + event (only if transition succeeded)
  const updateStmt = db.prepare(
    "UPDATE orders SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'pending'"
  ).bind(now, orderId);

  // Event only inserted if order is now 'cancelled' (UPDATE succeeded)
  // AND no existing 'cancelled' event (prevents duplicates)
  const eventStmt = db.prepare(
    "INSERT INTO order_events (id, order_id, event, detail, created_at) " +
    "SELECT ?, ?, 'cancelled', '{}', ? " +
    "WHERE EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'cancelled') " +
    "AND NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = ? AND event = 'cancelled')"
  ).bind(crypto.randomUUID(), orderId, now, orderId, orderId);

  await db.batch([updateStmt, eventStmt]);

  // Check if the update actually changed the order (concurrent payment may have changed status)
  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<DbOrderRow>();
  if (updated!.status !== 'cancelled') {
    throw new AccountError(ERRORS.ORDER_NOT_CANCELLABLE, '订单状态已变更，无法取消。', 409);
  }
  return mapOrder(updated!);
}

/**
 * Internal test harness only. No HTTP route exposes settlement. A future live
 * provider must verify merchant, currency, amount and receipt before adding
 * its own transactional fulfillment adapter. Tests never contribute live GMV.
 */
export async function settleTestPayment(db: D1Database, orderId: string, paymentEvent: string, test: true): Promise<OrderRow> {
  if (test !== true) throw new AccountError(ERRORS.PAYMENT_UNAVAILABLE, '真实支付服务尚未接入。', 503);
  const lookup = () => db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<DbOrderRow>();
  const row = await lookup();
  if (!row) throw new AccountError(ERRORS.ORDER_NOT_FOUND, '订单不存在。', 404);
  if (row.status === 'fulfilled' && row.test_mode === 1 && row.payment_event === paymentEvent) return mapOrder(row);
  if (row.status !== 'pending') throw new AccountError(ERRORS.ORDER_NOT_FULFILLABLE, '订单状态无法测试结算。', 409);
  const now = nowIso();
  const statements = [
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'pending') THEN 1 ELSE json('order_state_conflict') END").bind(orderId),
    db.prepare("UPDATE orders SET status = 'fulfilled', paid_at = ?, fulfilled_at = ?, payment_event = ?, test_mode = 1 WHERE id = ?").bind(now, now, paymentEvent, orderId),
  ];
  if (row.product_type === 'diamonds') {
    statements.push(db.prepare('INSERT INTO wallet_ledger (id, account, claim_key, kind, amount, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account, claim_key) DO NOTHING').bind(crypto.randomUUID(), row.account, `order:${orderId}`, row.product_title, row.product_amount, beijingDate(), now));
  } else if (row.product_type === 'membership') {
    statements.push(db.prepare("INSERT INTO memberships (id, account, starts_at, expires_at, source_order, created_at) SELECT ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', MAX(?, COALESCE((SELECT MAX(expires_at) FROM memberships WHERE account = ?), ?)), '+' || ? || ' days'), ?, ? ON CONFLICT(source_order) DO NOTHING").bind(crypto.randomUUID(), row.account, now, now, row.account, now, row.product_duration_days, orderId, now));
  }
  for (const event of ['paid', 'fulfilled']) statements.push(db.prepare('INSERT INTO order_events (id, order_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(order_id, event) DO NOTHING').bind(crypto.randomUUID(), orderId, event, JSON.stringify({ testMode: true }), now));
  try { await db.batch(statements); }
  catch (error) {
    const replay = await lookup();
    if (replay?.status === 'fulfilled' && replay.test_mode === 1 && replay.payment_event === paymentEvent) return mapOrder(replay);
    throw error;
  }
  return mapOrder((await lookup())!);
}

// ===========================================================================
// GMV — scoped by account, no admin-wide disclosure
// ===========================================================================

export async function getAccountGMV(db: D1Database, accountId: string): Promise<GmvState> {
  const row = await db.prepare(
    "SELECT COALESCE(SUM(price_fen), 0) AS total_fen, COUNT(*) AS order_count " +
    "FROM orders WHERE account = ? AND status = 'fulfilled' AND test_mode = 0"
  ).bind(accountId).first<{ total_fen: number; order_count: number }>();

  return {
    totalFen: row?.total_fen ?? 0,
    orderCount: row?.order_count ?? 0,
  };
}

export async function settleMockPayment(db: D1Database, orderId: string): Promise<OrderRow> {
  const paymentEvent = `mock:${orderId}`;
  const lookup = () => db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<DbOrderRow>();
  const row = await lookup();
  if (!row) throw new AccountError(ERRORS.ORDER_NOT_FOUND, '订单不存在。', 404);
  if (row.status === 'paid' && row.test_mode === 1 && row.payment_event === paymentEvent) return mapOrder(row);
  if (row.status !== 'pending') throw new AccountError(ERRORS.ORDER_NOT_FULFILLABLE, '订单状态无法测试结算。', 409);
  const now = nowIso();
  const statements = [
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'pending') THEN 1 ELSE json('order_state_conflict') END").bind(orderId),
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ?, fulfilled_at = ?, payment_event = ?, test_mode = 1 WHERE id = ?").bind(now, now, paymentEvent, orderId),
  ];
  if (row.product_type === 'diamonds') {
    statements.push(db.prepare('INSERT INTO wallet_ledger (id, account, claim_key, kind, amount, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account, claim_key) DO NOTHING').bind(crypto.randomUUID(), row.account, `order:${orderId}`, row.product_title, row.product_amount, beijingDate(), now));
  } else if (row.product_type === 'membership') {
    statements.push(db.prepare("INSERT INTO memberships (id, account, starts_at, expires_at, source_order, created_at) SELECT ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', MAX(?, COALESCE((SELECT MAX(expires_at) FROM memberships WHERE account = ?), ?)), '+' || ? || ' days'), ?, ? ON CONFLICT(source_order) DO NOTHING").bind(crypto.randomUUID(), row.account, now, now, row.account, now, row.product_duration_days, orderId, now));
  }
  for (const event of ['paid', 'fulfilled']) statements.push(db.prepare('INSERT INTO order_events (id, order_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(order_id, event) DO NOTHING').bind(crypto.randomUUID(), orderId, event, JSON.stringify({ testMode: true }), now));
  try { await db.batch(statements); }
  catch (error) {
    const replay = await lookup();
    if (replay?.status === 'paid' && replay.test_mode === 1 && replay.payment_event === paymentEvent) return mapOrder(replay);
    throw error;
  }
  return mapOrder((await lookup())!);
}
