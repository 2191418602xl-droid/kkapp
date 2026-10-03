import { MediaError, mediaRuntime, mediaIdentity, mediaJson, checkMediaRequest, mediaKey, mediaFailure, reserveMediaQuota, callMediaProvider, readMediaBody, validateRecording } from '@/lib/multimodal-server';
export async function POST(request: Request) {
  const visitor = mediaIdentity(request);
  try {
    checkMediaRequest(request, 'audio/wav');
    const bytes = await readMediaBody(request.body, 960044); validateRecording(bytes);
    mediaKey(); await reserveMediaQuota('audio');
    const form = new FormData();
    form.append('model', mediaRuntime().SILICONFLOW_ASR_MODEL?.trim() || 'TeleAI/TeleSpeechASR');
    form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'recording.wav');
    const result = await callMediaProvider('audio/transcriptions', form, 45_000, request.signal);
    const data = JSON.parse(new TextDecoder().decode(await readMediaBody(result.body, 16000))) as {text?:string};
    if (typeof data.text !== 'string' || !data.text.trim()) throw new MediaError('没有识别到文字，请靠近麦克风重录。', 422);
    return mediaJson(request, visitor, { text: data.text.trim().slice(0, 1000) });
  } catch (error) { return mediaFailure(request, visitor, error); }
}
