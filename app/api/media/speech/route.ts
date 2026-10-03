import { testEnabled,record } from '@/lib/e2e-server';
import { MediaError, mediaIdentity, mediaInput, mediaFailure, reserveMediaQuota } from '@/lib/multimodal-server';
import { requireSpeechModel, synthesizeSpeech } from '@/lib/volcengine-media';
export async function POST(request: Request) {
  const visitor = mediaIdentity(request);
  try {
    const input = await mediaInput(request);
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 500) throw new MediaError('请输入 1 至 500 字的朗读内容。');
    if(testEnabled(request)) {
      const samples=16000, buffer=new ArrayBuffer(44+samples*2), view=new DataView(buffer);
      const text=(offset:number,value:string)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
      text(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);
      for(let i=0;i<samples;i++) view.setInt16(44+i*2,Math.sin(i/16000*Math.PI*2*440)*3000*Math.sin(i/samples*Math.PI),true);
      await record(request,'mock_voice_generated',{mode:'mock',characterId:input.characterId,bytes:buffer.byteLength});
      return new Response(buffer,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store','X-KK-Voice-Mode':'mock'}});
    }
    requireSpeechModel(input.voice); await reserveMediaQuota('audio');
    const bytes = await synthesizeSpeech(input.text.trim(), input.voice, request.signal);
    const id3 = new TextDecoder().decode(bytes.slice(0, 3)) === 'ID3';
    if (!id3 && !(bytes[0] === 255 && (bytes[1] & 224) === 224)) throw new MediaError('模型未返回有效音频，请重试。', 502);
    return new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return mediaFailure(request, visitor, error); }
}
