import { modelVoices, type MediaStatus, type ModelVoice } from '@/lib/multimodal-shared';
import { MediaError, mediaRuntime, mediaKey, callMediaProvider, readMediaBody } from '@/lib/multimodal-server';

// Provider selection stays server-side. A partially configured Volcengine service
// fails closed instead of silently spending against another provider.
export function mediaConfiguration(): MediaStatus {
  const r = mediaRuntime();
  const ark = Boolean(r.ARK_API_KEY?.trim() || r.ARK_IMAGE_MODEL?.trim());
  const doubao = Boolean(r.DOUBAO_SPEECH_API_KEY?.trim() || r.DOUBAO_TTS_SPEAKER?.trim());
  const silicon = Boolean(r.SILICONFLOW_API_KEY?.trim());
  return {
    provider: ark || doubao ? '火山引擎' : silicon ? '硅基流动' : '未配置',
    imageProvider: ark || !silicon ? '火山方舟 Seedream' : '硅基流动',
    speechProvider: doubao || !silicon ? '豆包语音' : '硅基流动',
    image: Boolean(r.MEDIA) && (ark ? Boolean(r.ARK_API_KEY?.trim() && r.ARK_IMAGE_MODEL?.trim()) : silicon),
    speech: doubao ? Boolean(r.DOUBAO_SPEECH_API_KEY?.trim() && r.DOUBAO_TTS_SPEAKER?.trim()) : silicon,
    transcription: silicon,
    voices: doubao || !silicon ? [{ id: 'doubao', label: r.DOUBAO_TTS_VOICE_LABEL?.trim() || '豆包角色声线' }] : [...modelVoices],
  };
}

export function requireImageModel() {
  if (!mediaConfiguration().image) throw new MediaError('文生图尚未启用，请配置生图服务密钥、模型与图片存储。', 503);
}
export function requireSpeechModel(voice: unknown): asserts voice is ModelVoice {
  const config = mediaConfiguration();
  if (!config.speech) throw new MediaError('声音模型尚未启用，请配置语音服务密钥与音色。', 503);
  if (!config.voices.some(item => item.id === voice)) throw new MediaError('所选声线已变更，请重新打开声音面板后选择。');
}

async function volcengineRequest(url: string, headers: Record<string, string>, body: unknown, timeout: number, signal?: AbortSignal) {
  const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new MediaError(response.status === 429 ? '模型服务繁忙，请稍后重试。' : '模型请求未完成，请联系管理员检查开通状态、密钥和可用额度。', 502);
  }
  return response;
}

export async function generateImageUrl(prompt: string, size: string) {
  const r = mediaRuntime();
  const ark = Boolean(r.ARK_API_KEY?.trim() || r.ARK_IMAGE_MODEL?.trim());
  // Preserve the selected aspect ratio within the Seedream 2K pixel limits.
  const arkSizes: Record<string, string> = { '1024x1024': '2048x2048', '768x1024': '1776x2368', '720x1280': '1584x2816' };
  const response = ark
    ? await volcengineRequest('https://ark.cn-beijing.volces.com/api/v3/images/generations', { Authorization: `Bearer ${r.ARK_API_KEY!.trim()}` },
      { model: r.ARK_IMAGE_MODEL!.trim(), prompt, size: arkSizes[size], response_format: 'url', stream: false, watermark: true, sequential_image_generation: 'disabled' }, 90_000)
    : await callMediaProvider('images/generations', JSON.stringify({ model: r.SILICONFLOW_IMAGE_MODEL?.trim() || 'Kwai-Kolors/Kolors', prompt, image_size: size, num_inference_steps: 20 }), 90_000);
  let data: { images?: { url?: string }[]; data?: { url?: string }[] };
  try { data = JSON.parse(new TextDecoder().decode(await readMediaBody(response.body, 64_000))); }
  catch { throw new MediaError('模型返回的图片信息不完整，请重试。', 502); }
  const url = ark ? data.data?.[0]?.url : data.images?.[0]?.url;
  if (typeof url !== 'string') throw new MediaError('模型未返回图片，请调整描述后重试。', 502);
  return url;
}

// HTTP Chunked TTS returns newline-delimited JSON with base64 audio chunks.
// Bound both wire bytes and decoded audio; never forward provider messages/keys.
export async function readDoubaoAudio(response: Response) {
  if (!response.body) throw new MediaError('语音响应为空，请重试。', 502);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const chunks: Uint8Array[] = []; let length = 0, wireBytes = 0, buffer = '', complete = false;
  function consume(line: string) {
    if (!line.trim()) return;
    let event: { code?: number; data?: string | null };
    try { event = JSON.parse(line); } catch { throw new MediaError('语音响应不完整，请重试。', 502); }
    if (!event || (event.code !== 0 && event.code !== 20000000)) throw new MediaError('声音合成失败，请联系管理员检查音色权限和可用额度。', 502);
    if (event.data) {
      if (typeof event.data !== 'string') throw new MediaError('语音响应格式不正确，请重试。', 502);
      let raw: string;
      try { raw = atob(event.data); } catch { throw new MediaError('语音数据损坏，请重试。', 502); }
      length += raw.length;
      if (length > 8_000_000) throw new MediaError('音频过长，请缩短文本后重试。', 502);
      chunks.push(Uint8Array.from(raw, letter => letter.charCodeAt(0)));
    }
    if (event.code === 20000000) complete = true;
  }
  try {
    while (!complete) {
      const { value, done } = await reader.read();
      if (done) { buffer += decoder.decode(); if (buffer.trim()) consume(buffer); break; }
      wireBytes += value.byteLength;
      if (wireBytes > 12_000_000) throw new MediaError('音频过长，请缩短文本后重试。', 502);
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while (!complete && (end = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
      if (buffer.length > 2_000_000) throw new MediaError('语音响应格式不正确，请重试。', 502);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  // The official sample also permits a clean EOF without a final status event.
  // A transport failure or unfinished JSON still rejects instead of playing it.
  if (!length) throw new MediaError('模型未返回语音，请重试。', 502);
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function synthesizeSpeech(text: string, voice: ModelVoice, signal: AbortSignal) {
  const r = mediaRuntime();
  if (voice === 'doubao') {
    const response = await volcengineRequest('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
      'X-Api-Key': r.DOUBAO_SPEECH_API_KEY!.trim(), 'X-Api-Resource-Id': 'seed-tts-2.0', 'X-Api-Request-Id': crypto.randomUUID(),
    }, { req_params: { text, speaker: r.DOUBAO_TTS_SPEAKER!.trim(), audio_params: { format: 'mp3', sample_rate: 24000 } } }, 45_000, signal);
    return readDoubaoAudio(response);
  }
  mediaKey();
  const model = r.SILICONFLOW_TTS_MODEL?.trim() || 'FunAudioLLM/CosyVoice2-0.5B';
  const response = await callMediaProvider('audio/speech', JSON.stringify({ model, input: text, voice: `${model}:${voice}`, response_format: 'mp3', stream: false, speed: 1 }), 45_000, signal);
  return readMediaBody(response.body, 8_000_000);
}
