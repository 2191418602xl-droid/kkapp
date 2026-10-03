import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ui-polish.css';
import './multimodal.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  metadataBase: new URL('https://lumi-world-kkapp.gentle-slug-1144.chatgpt.site'),
  title: 'kirakira · 沉浸式角色世界',
  description: 'AI 角色、开放剧情、虚拟手机与多窗口辅助 Agent 的沉浸式世界原型。',
  openGraph: {
    title: 'kirakira · 沉浸式角色世界',
    description: '角色、故事与辅助 Agent，共处一个世界。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'kirakira · 沉浸式角色世界',
    description: '角色、故事与辅助 Agent，共处一个世界。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
