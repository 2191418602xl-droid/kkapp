import { chatRuntime } from '@/lib/chat-server';
import { ensureAccount, getWalletState, claimDailyReward } from '@/lib/account-commerce';
import { signedInUser, privateJson, flowInput, FlowError } from '@/lib/account-identity';
import { AccountError } from '@/lib/account-shared';

export async function GET(request: Request) {
  const user = signedInUser(request);
  if (!user) return privateJson({ error: '登录后领取免费钻石。' }, 401);
  try { await ensureAccount(chatRuntime().DB, user.id); return privateJson(await getWalletState(chatRuntime().DB, user.id)); }
  catch { return privateJson({ error: '钱包暂时无法加载。' }, 503); }
}
export async function POST(request: Request) {
  const user = signedInUser(request);
  if (!user) return privateJson({ error: '请先注册或登录。' }, 401);
  try {
    const input = await flowInput(request);
    if (input.action === 'purchase') throw new FlowError('支付服务尚未接入，请到钻石与会员查看订单。', 409);
    if (input.action !== 'checkin') throw new FlowError('不支持的操作。');
    await ensureAccount(chatRuntime().DB, user.id);
    return privateJson(await claimDailyReward(chatRuntime().DB, user.id));
  } catch (error) {
    return error instanceof FlowError || error instanceof AccountError ? privateJson({ error: error.message }, error.status) : privateJson({ error: '签到没有完成，请重试。' }, 503);
  }
}
