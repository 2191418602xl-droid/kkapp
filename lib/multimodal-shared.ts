export const modelVoices = [
  { id: 'alex', label: '沉稳男声' }, { id: 'benjamin', label: '低沉男声' },
  { id: 'charles', label: '磁性男声' }, { id: 'david', label: '明朗男声' },
  { id: 'anna', label: '沉稳女声' }, { id: 'bella', label: '热情女声' },
  { id: 'claire', label: '温柔女声' }, { id: 'diana', label: '活泼女声' },
] as const;
export type ModelVoice = typeof modelVoices[number]['id'] | 'doubao';
export type GeneratedImage = { id: string; prompt: string; size: string; created_at: string; url: string };
export type MediaStatus = { image: boolean; speech: boolean; transcription: boolean; provider: string;
  imageProvider: string; speechProvider: string; voices: { id: ModelVoice; label: string }[] };
export const imageSizes = ['1024x1024', '768x1024', '720x1280'] as const;
