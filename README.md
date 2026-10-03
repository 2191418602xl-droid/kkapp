# kirakira / KKApp

一个面向 AI 角色世界的可交互 Web App，包含沉浸式剧情、角色对话、发现页、虚拟手机、多模态创作和 AI 角色创建入口。

## 在线体验

https://lumi-world-kkapp.gentle-slug-1144.chatgpt.site/

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开终端显示的本地地址即可使用。

## 模型配置

项目不会提交真实 API Key。复制 `.env.example` 为 `.env.local`，按需填写：

- `DEEPSEEK_API_KEY`：角色对话与 AI 角色创建
- `ARK_API_KEY`、`ARK_IMAGE_MODEL`：火山引擎图片生成
- `DOUBAO_SPEECH_API_KEY`：豆包语音合成

`.env.local` 已被 Git 忽略，不会上传到 GitHub。

## 构建

```bash
npm run build
```

## 许可证

MIT
