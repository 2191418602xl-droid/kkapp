# 多模态能力接入

## 本次范围

- 首页、智能体列表：AI 创作，文生图与声音工坊。
- 创建智能体：生成图片可选作头像；服务端再次检查图片属于当前浏览器访客。
- 首页与人物聊天：语音输入，录音最多 30 秒，试听后手动提交识别，编辑结果后填入输入框，不自动发送。
- 首页朗读、人物聊天：模型朗读最新角色消息，8 种预置声线，最多 500 字；声音可取消，离开角色时停止。
- 图片元数据使用 D1，文件使用 R2。图片和头像按访客 Cookie 隔离；音频为会话临时内容，可下载。

## 服务配置

当前线上仅存在 `DEEPSEEK_API_KEY`；未配置图片/声音密钥，真实生成尚未验收。界面会展示未启用状态，不使用示例图片或设备朗读冒充模型结果。

本站先采用硅基流动统一接口。管理员需在本项目 Sites 运行时环境变量添加秘密值 `SILICONFLOW_API_KEY`。不要使用 `NEXT_PUBLIC_` 或 `VITE_` 前缀，不写入源码。配置完成后重新部署并真实验收。

默认模型（可通过服务端同名变量调整，调整时需复核接口契约）：

| 变量 | 默认值 |
| --- | --- |
| SILICONFLOW_IMAGE_MODEL | Kwai-Kolors/Kolors |
| SILICONFLOW_TTS_MODEL | FunAudioLLM/CosyVoice2-0.5B |
| SILICONFLOW_ASR_MODEL | TeleAI/TeleSpeechASR |

本地预览密钥放在忽略的开发环境配置中；Wrangler 可使用 `.dev.vars`。`.env.example` 提供变量清单。生产环境配置与本地文件互不替代。

仅设置密钥不证明账号具有模型使用权限。配置后先检查官方模型列表，再做一张图片、一段语音合成、一段录音转写的真实验收。供应商调用可能计费；取消网络请求不保证供应商退回消耗。

## 调用与限制

固定官方地址 `https://api.siliconflow.cn/v1`，浏览器不能指定上游 URL 或提供克隆音色；秘密值仅服务端使用。

- 文生图：800 字以内、1 张、三种比例，保留供应商默认 AI 水印。读取 `images[0].url` 后下载到 R2，避免一小时临时链接过期。
- 全站文生图最多 2 次/分钟、20 次/日；音频合计最多 10 次/分钟、100 次/日。失败尝试同样计入限制；每日按 UTC 时间桶重置，与签到北京时间规则独立。
- 私人图片库最多 30 张，写入时原子检查上限。清除 Cookie 或换设备不能找回，请先下载。
- 录音由浏览器转为 16 kHz 单声道 16-bit WAV，服务端检查 WAV 头和实际长度，不存储原始录音。
- 保留文本和图片草稿的错误状态；图片请求超时后可刷新图片库查看是否已完成。

## 验证与边界

`node scripts/test-multimodal.mjs` 使用模拟供应商，不发起付费请求。覆盖无密钥、来源校验、实际请求大小、图片比例、声音白名单、WAV 时长、供应商错误脱敏、频率额度、R2 保存和图片所有权。

本地浏览器验证了创作弹窗、图片比例/灵感、未配置状态、声音工坊及手机窄屏布局。真实麦克风录制和供应商返回音频/图片仍需配置后验证，不能视为已经完成。

Codex 子代理完成官方接口研究及源码复核，发现并修复音频上游取消传播、并发图片上限两项问题。WorkBuddy 的 WB-004 输入因应用未读取剪贴板而未成功派发，本次不计入其完成工作。

## 官方依据

- https://docs.siliconflow.cn/docs/api/images-generations-post
- https://docs.siliconflow.cn/docs/api/audio-speech-post
- https://docs.siliconflow.cn/docs/api/audio-transcriptions-post
- https://docs.siliconflow.cn/docs/api/models-get

官方旧公告与 API 枚举对 SenseVoiceSmall 状态有冲突，本次未采用该模型。发布前未访问或使用历史聊天中的任何密钥。
