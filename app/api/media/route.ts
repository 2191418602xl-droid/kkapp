import { testEnabled } from '@/lib/e2e-server';
import { mediaIdentity, mediaJson } from '@/lib/multimodal-server';
import { mediaConfiguration } from '@/lib/volcengine-media';
export function GET(request: Request) {
  return mediaJson(request, mediaIdentity(request), {...mediaConfiguration(),...(testEnabled(request)?{speech:true,speechProvider:'Mock 测试提示音',voices:[{id:'alex',label:'Mock 测试声线'}],mockVoice:true}:{})});
}
