import { record, testEnabled, requireTest } from '@/lib/e2e-server';
import { chatRuntime } from '@/lib/chat-server';
import { ensureAccount, getAccountState, claimDailyReward, grantTrial, listProducts, createOrder, getAccountOrders, cancelOrder, getAccountGMV, settleMockPayment } from '@/lib/account-commerce';
import { AccountError } from '@/lib/account-shared';
import { signedInUser, privateJson, flowInput, FlowError } from '@/lib/account-identity';

async function snapshot(user: { id: string; name: string }) {
  const db = chatRuntime().DB;
  return { authenticated: true, user: { name: user.name }, account: await getAccountState(db, user.id), products: listProducts(), orders: await getAccountOrders(db, user.id), gmv: await getAccountGMV(db, user.id), paymentAvailable: false };
}
function failure(error: unknown) {
  return error instanceof FlowError || error instanceof AccountError ? privateJson({ error: error.message }, error.status) : privateJson({ error: '账户服务暂时无法完成请求，请稍后重试。' }, 503);
}
export async function GET(request: Request) {
  const user = signedInUser(request);
  if (!user) return privateJson({ authenticated: false, paymentAvailable: false });
  try {
    const existed=await chatRuntime().DB.prepare('SELECT id FROM accounts WHERE id = ?').bind(user.id).first();
    await ensureAccount(chatRuntime().DB, user.id);
    if(!existed) await record(request,'account_registered',{auth:'official-local-simulator'});
    return privateJson({...await snapshot(user),registered:!existed,testMode:testEnabled(request)});
  }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = signedInUser(request);
  if (!user) return privateJson({ error: '请先注册或登录，保存你的权益。' }, 401);
  try {
    const input = await flowInput(request), db = chatRuntime().DB;
    await ensureAccount(db, user.id);
    if (input.action === 'checkin') await claimDailyReward(db, user.id);
    else if (input.action === 'trial') await grantTrial(db, user.id);
    else if (input.action === 'order') {
      if (typeof input.productId !== 'string' || typeof input.idempotencyKey !== 'string' || !/^[a-f0-9-]{36}$/.test(input.idempotencyKey)) throw new FlowError('请选择有效套餐。');
      const order=await createOrder(db, user.id, input.productId, input.idempotencyKey);
      await record(request,'order_created',{status:order.status,productType:order.productType},{order_id:order.id});
    } else if (input.action === 'cancel-order') {
      if (typeof input.orderId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.orderId)) throw new FlowError('订单不正确。');
      await cancelOrder(db, user.id, input.orderId);
    } else if(input.action === 'mock-pay') {
      requireTest(request);
      if(typeof input.orderId!=='string') throw new FlowError('订单不正确。');
      const owned=await db.prepare('SELECT id FROM orders WHERE id = ? AND account = ?').bind(input.orderId,user.id).first();
      if(!owned) throw new FlowError('订单不存在。',404);
      const settled=await settleMockPayment(db,input.orderId);
      await record(request,'mock_payment_settled',{status:settled.status,productType:settled.productType,testMode:true,membership:(await getAccountState(db,user.id)).membership.kind},{order_id:input.orderId});
    } else throw new FlowError('不支持的操作。');
    return privateJson(await snapshot(user));
  } catch (error) { return failure(error); }
}
