# WB-003 源码审查报告

**交付人:** WorkBuddy AI
**审查对象:** KKApp 源码（只读）
**审查依据:** `KK Codex/WB-REVIEW-2026-09-30.md` 待验收清单
**交付时间:** 2026-09-30
**约束:** 未执行任何 UI 点击测试；未修改 KKApp 源码；未安装软件；未读取密钥；未发布；未调用收费 API。

---

## 0. UI 测试状态

**所有 UI 检查项均标记为"未由 WB 测试"。** Codex 已完成本地点击通过 QA，并已修正 CharacterChat 返回按钮的无障碍标签。以下仅报告 WB 通过源码静态审查确认的问题。

---

## 1. WB-001 集成确认

| 检查项 | 源码位置 | 状态 |
|--------|----------|------|
| `ui-polish.css` 已导入 | `app/layout.tsx:3` `import './ui-polish.css';` | 已集成，导入顺序在 `globals.css` 之后，可正确覆盖 |
| 底部安全区 padding | `ui-polish.css:6` `.bottom-nav { padding-bottom: max(14px, env(safe-area-inset-bottom)); }` | 已集成 |
| 44px 触控区域 | `ui-polish.css:7,14,43` | 已集成 |
| `.view-agent:has(.ai-chat-screen) .bottom-nav { display: none }` | `ui-polish.css:8` | 已集成 |
| `.fixed-cta` 改为 `position: absolute` | `ui-polish.css:12` | 已集成，修正桌面手机框错位 |
| 签到弹窗窄屏滚动 | `ui-polish.css:53-57,64-65` | 已集成 |
| 矮屏适配 | `ui-polish.css:60-68` | 已集成 |
| `viewport-fit=cover` | `app/layout.tsx:5` `viewportFit: 'cover'` | 已集成 |

**结论:** WB-001 补丁已正确集成，无源码层面缺陷。

---

## 2. WB-002 集成确认

| 检查项 | 源码位置 | 状态 |
|--------|----------|------|
| `profile-editor.tsx` 导入 | `app/page.tsx:5`, `components/diamond-center.tsx:9` | 已集成 |
| `profile-editor.css` 导入 | `components/profile-editor.tsx:5` `import '@/app/profile-editor.css';` | 已集成 |
| `useLocalProfile` 使用 | `page.tsx:615` (Home), `diamond-center.tsx:63` (PersonalView), `diamond-center.tsx:164` (DiamondWalletView) | 三处均接入 |
| `ProfileEditor` 组件使用 | `diamond-center.tsx:146` 嵌入 `DialogPrimitive.Popup`，传入 `initialFocus={profilePopupRef}` `finalFocus={profileTriggerRef}` | 已集成，焦点管理正确 |
| `setProfile` 返回值处理 | `diamond-center.tsx:147-152` 检查 `'persisted'`/`'memory'`/`'invalid'`，向用户展示保存状态 | 已集成 |
| SSR 安全 | `useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)`，serverSnapshot 返回默认值且 `hydrated: false` | 正确 |
| 存储损坏回退 | `parseProfile()` try/catch + `validateProfile()` 校验字段类型和头像白名单 | 正确 |
| 存储回读限制 | `validateProfile()` 仅接受 `name`(string, 2-20), `bio`(string, ≤100), `avatar`(在 AVATAR_OPTIONS 内) | 正确，Codex 追加要求已满足 |
| 默认头像 | `/avatars/avatar-18.jpg` | 正确 |
| 头像选择列表 | 6 张，均在 `public/avatars` 路径下 | 正确 |
| 取消保留旧资料 | `ProfileEditor` 用 `useState(profile.name)` 初始化，取消仅调用 `onClose()` 不触发 `onSave` | 正确 |
| 重开加载保存值 | `useSyncExternalStore` 从 localStorage 读取 | 正确 |

**微小差异（非缺陷）:** 原始 WB-002 规格中默认名称为 `KK 闪闪星`（含空格），集成后 `profile-editor.tsx:13` 为 `KK闪闪星`（无空格）。Codex 可能已做意图调整，不计为缺陷。

**结论:** WB-002 已正确集成，无源码层面缺陷。

---

## 3. 返回导航审查

| 检查项 | 源码位置 | 结论 |
|--------|----------|------|
| 世界→钱包→返回仍在世界 | `openOverlay('membership')` 设 `previousView='world'`；`DiamondWalletView onBack={() => setView(previousView)}` | 正确 |
| 我的→钱包→返回仍在我的 | `PersonalView onWallet={() => openOverlay('membership')}` 设 `previousView='profile'` | 正确 |
| `backLabel` 文案 | `page.tsx:1016` 三元判断 `previousView` | 正确 |
| 虚拟手机关闭返回来源 | `page.tsx:1017` `VirtualPhone onClose={() => setView(previousView)}` | 正确 |
| 详情页返回来源 | `page.tsx:1021` `DetailView onBack={() => setView(previousView)}` | 正确 |

**结论:** 返回导航逻辑无源码缺陷。

---

## 4. 键盘可访问性审查

| 检查项 | 源码位置 | 结论 |
|--------|----------|------|
| 详情"更多操作" `Dialog` 焦点 | `page.tsx:1451` `initialFocus={morePopup} finalFocus={moreTrigger}` | 正确，Escape 关闭后焦点回到触发器 |
| 论坛发布框 `Dialog` 焦点 | `page.tsx:1634` `initialFocus={composerInput} finalFocus={composerTrigger}` | 正确，关闭后焦点回到触发器 |
| `WorldSheet` 焦点陷阱 | `page.tsx:1242-1274` `previouslyFocusedRef` 保存/恢复，Tab 循环 | 正确 |
| `ProfileEditor` 焦点 | `diamond-center.tsx:145` `initialFocus={profilePopupRef} finalFocus={profileTriggerRef}` | 正确 |
| 草稿保留 | 论坛 `postDraft` 状态在 `ForumView` 中，关闭弹窗不重置（仅发布后清空） | 正确 |
| `:focus-visible` 统一样式 | `ui-polish.css:4-5` | 正确 |

**结论:** 键盘可访问性无源码缺陷。Codex 已修正 CharacterChat 返回标签。

---

## 5. 个人内容联动审查

| 检查项 | 源码位置 | 结论 |
|--------|----------|------|
| 改昵称后动态作者/头像更新 | `ForumView` `visiblePosts` 将 `isMine` 帖子的 `author`/`avatar` 替换为 `profile.name`/`profile.avatar` (`page.tsx:1520`)；`PersonalView` 帖子列表也使用 `profile` (`diamond-center.tsx:122`) | 正确，同一 `useSyncExternalStore` 数据源 |
| 收藏故事→个人页→详情/世界同一封面 | `savedStories` 存 `structuredClone(detailScript)`；`onOpenStory` 查找 `savedStories` 并设 `setDetailScript(story)` (`page.tsx:1009,1023`) | 正确 |
| 发布动态→个人页打开→评论 | `ForumView` `isMine` 帖子传给 `PersonalView`；`onOpenPost` 设 `forumFocus` 并跳转论坛 (`page.tsx:1004,1010`)；论坛滚动定位帖子 (`page.tsx:1502-1510`) | 正确，见下方缺陷 1 |
| 回忆收藏/移除→世界工具与个人记忆簿同步 | `worldTools.memories` 同一状态传给 `WorldTools` 和 `PersonalView`；`onRemoveMemory={worldTools.removeMemory}` (`page.tsx:1005,1011`) | 正确 |
| 普通世界入口重开论坛不残留个人帖子定位 | 见下方**缺陷 1** | **有缺陷** |

---

## 6. 分享链接审查

| 检查项 | 源码位置 | 结论 |
|--------|----------|------|
| 链接生成剥离会话参数 | `lib/world-sharing.ts:3-6` 清空 search/hash，仅设 `?world=title` | 正确 |
| 链接打开后定位到正确世界 | `page.tsx:629-636` 读取 `?world=` 参数，调用 `sharedWorldScript(title)` 查找匹配脚本，跳转详情页 | 正确 |
| 分享卡不含私人对话 | `page.tsx:1297` 仅取最后一条 AI 消息或开场白；隐私声明在 `page.tsx:1325` | 正确 |

---

## 7. 确认的源码缺陷

### 缺陷 1: 论坛焦点状态 `forumFocus` 在非个人页入口未清除

**严重程度:** 中（影响返回导航正确性）

**文件:** `app/page.tsx`

**现象:**
当用户从"我的"页面点击某条动态进入论坛时，`forumFocus` 被设置为 `{ postId, sequence }` 对象。`ForumView` 据此显示"返回我的动态"按钮并滚动定位到对应帖子。但如果用户随后通过 BottomNav（非 `onBack` 按钮）离开论坛前往其他页面（如世界），`forumFocus` **不会被清除**。此时从世界页通过快捷入口"论坛"`onOpen('forum')` 重新进入论坛，`forumFocus` 仍为旧值，导致：

1. 错误显示"返回我的动态"按钮（本应不显示，因入口不是个人页）。
2. 自动滚动到一个已不相关的帖子。

**根因:**
`openOverlay` 函数不处理 `forumFocus`：
```typescript
// page.tsx:667-674
function openOverlay(next: View) {
  setPreviousView(view);
  setView(next);
}
```
而 `PersonalView.onForum` 显式清除：
```typescript
onForum={() => { setForumFocus(null); setView('forum'); }}
```
`openOverlay('forum')` 遗漏了同样的清除操作。

**修复方案:**
在 `openOverlay` 中，当目标视图为 `'forum'` 时清除 `forumFocus`：

```typescript
function openOverlay(next: View) {
  if (next === 'forum') setForumFocus(null);
  setPreviousView(view);
  setView(next);
}
```

**影响范围:**
- `WorldView` 快捷行"论坛"按钮 → `onOpen('forum')` (page.tsx:1107)
- `WorldSheet` 工具入口"论坛" → `onOpen('forum')` (page.tsx:1239)

---

## 8. 未确认项（源码无法判定，需 UI 测试）

以下检查项需 Codex 在本地浏览器中验证，WB 未执行 UI 测试：

- 320px / 393px / 桌面宽度下签到弹窗的实际滚动行为
- 个人资料弹窗在窄屏下头像网格是否溢出
- 矮屏（≤620px）下 `.phone-stage` 是否全屏且无溢出
- 聊天输入区在 iOS 底部安全区是否被遮挡
- `:has()` 选择器在目标浏览器中是否生效（BottomNav 隐藏）
- 分享链接在新标签打开后详情页封面/角色是否正确
- 横屏下布局是否溢出

---

## 9. 审查边界

- 本报告仅基于源码静态阅读，不等于真实点击或真实模型回复验证。
- `dist/` 目录下的构建产物未审查。
- 类型检查、构建和接口模拟测试不在本次审查范围内。
- Codex 已完成本地点击通过 QA 并修正 CharacterChat 返回无障碍标签。

---

## 10. 结论

| 类别 | 结果 |
|------|------|
| WB-001 集成 | 正确，无缺陷 |
| WB-002 集成 | 正确，无缺陷 |
| 返回导航 | 正确 |
| 键盘可访问性 | 正确 |
| 个人内容联动 | 1 处缺陷（缺陷 1） |
| 分享链接 | 正确 |
| UI 测试 | 未由 WB 执行 |

**确认缺陷总数: 1**
**缺陷编号: 缺陷 1** — `forumFocus` 在非个人页入口未清除，需在 `openOverlay` 中添加清除逻辑。