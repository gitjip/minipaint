# Web 画图软件 · 开发路线图

## 约束
- 个人项目；仅电脑端，鼠标 + 键盘
- 本地运行：无后端、无移动端、无 PWA、无云同步
- 目标：微软画图核心功能
- 开发方式：由 AI 代理（opencode）实现，维护者负责验收与关键决策
- 优先 Chrome / Edge，Safari 不做保证

## 技术栈
- TypeScript + Vite
- 原生 DOM/CSS（不用框架）
- Canvas 2D、IndexedDB
- File API、Clipboard API、createImageBitmap、canvas.toBlob
- Vitest：纯逻辑单测
- Playwright：E2E + 视觉回归（见测试策略）

## npm scripts
| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发服务，Playwright E2E 的被测对象 |
| `npm run build` / `npm run preview` | 构建与预览 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest 单测 |
| `npm run test:e2e` | Playwright E2E（含视觉回归） |
| `npm run test:e2e:update` | 更新视觉基线截图 |

## 目录结构

```
src/
  main.ts                 入口，装配各模块
  app/
    Editor.ts             总控：模块持有、命令派发、状态发布
    EventBus.ts           类型化事件总线
    commands.ts           命令表（菜单 / 快捷键共用，含 label、快捷键、可用条件）
  core/
    Document.ts           画布数据：尺寸、背景、像素
    Viewport.ts           缩放、平移、DPR、坐标转换
    HistoryManager.ts     撤销 / 重做
    SelectionManager.ts   选区状态与蒙版
    ColorManager.ts       前景色、背景色、最近色、调色板
    FileManager.ts        打开、导出、草稿
  render/
    Renderer.ts           三层 canvas、脏矩形、rAF 调度
  tools/
    Tool.ts               工具接口与状态机
    ToolManager.ts        注册、切换、事件分发
    PencilTool.ts BrushTool.ts EraserTool.ts
    BucketTool.ts EyedropperTool.ts
    LineTool.ts RectTool.ts EllipseTool.ts
    TextTool.ts
    SelectRectTool.ts LassoTool.ts CropTool.ts
  ui/
    UIManager.ts          菜单、工具栏、面板、状态栏
tests/                    与 src 结构对应的 *.test.ts
e2e/
  fixtures/               测试用图片（小 PNG / JPEG / 损坏文件）
  helpers/canvas.ts       读取画布像素、等待渲染稳定的断言工具
  m0.spec.ts … m5.spec.ts 每个里程碑一个 spec
  __screenshots__/        视觉回归基线
playwright.config.ts      固定 viewport / deviceScaleFactor=1 / webServer 自动起 dev
```

## 测试策略

三层，前两层必须自动化；「验收」优先写成 Playwright 用例，人工只做抽查。

1. **单元测试（Vitest）**：纯逻辑——坐标变换、洪水填充、历史补丁合并、选区命中、颜色序列化。不碰真实 DOM/canvas，node 环境即可跑。
2. **E2E（Playwright，真实 Chromium）**：工具交互、快捷键、文件打开/导出、草稿恢复。画布断言通过 `page.evaluate` 调 `getImageData` 读像素（比截图更稳），交互后用「下一帧渲染完成」的显式等待。
3. **视觉回归（`toHaveScreenshot`）**：只用于渲染结果类验收（形状抗锯齿、笔刷落点、整体 UI 冒烟）。基线显式更新，不自动覆盖。

稳定性约定：
- 固定 `viewport` 与 `deviceScaleFactor: 1`，禁用页面动画与选区蚂蚁线（测试专用开关）
- 字体相关断言只验证「目标区域有非背景像素写入」，不做字形比对
- 监听 `page` 的 console error 与 `pageerror`，任何一条即 E2E 失败
- 首次需 `npx playwright install chromium`

## 核心约定（所有模块遵守）
- **坐标三层**：屏幕 → 画布（Viewport 反变换）→ 像素（取整）。转换只在 Viewport 入口做一次，工具只接收画布坐标。
- **工具状态机**：`idle → pressing → dragging → commit | cancel`；Esc / 右键取消；提交产生像素变更时必须登记历史。
- **绘制管线**：拖拽期间只画预览层；提交时一次性写入文档层并登记历史。
- **历史**：像素操作只存脏矩形补丁（`ImageData` + 位置），不存整图；连续笔画合并；上限 100 步。
- **渲染**：脏矩形 + `requestAnimationFrame`，一帧内合并失效；DPR 由 Renderer 统一处理。
- **纯逻辑与 canvas 分离**：洪水填充、坐标变换、补丁合并写成纯函数，便于单测。

## 数据模型
- `Document`：宽高、背景色、主位图（`OffscreenCanvas` / `ImageData`）、选区引用
- `Viewport`：scale、offset、DPR；`screenToCanvas` / `canvasToPixel`
- `HistoryEntry`：名称、execute、undo、redo、mergeKey
- `Selection`：形状（矩形 / 套索路径）、蒙版、边界框、浮离像素
- `Palette`：前景色、背景色、最近颜色（≤10）、默认调色板
- `ToolOptions`：当前工具、笔刷大小、不透明度、线宽、填充模式、字体

## 进度

| 里程碑 | 状态 | E2E |
| --- | --- | --- |
| M0 脚手架与画布 | ✅ 已完成 | e2e/m0.spec.ts |
| M1 基础绘制与历史 | ✅ 已完成 | e2e/m1.spec.ts |
| M2 形状、填充与取色 | ✅ 已完成 | e2e/m2.spec.ts |
| M3 选区与剪贴板 | ✅ 已完成 | e2e/m3.spec.ts |
| M4 文本与文件 | ✅ 已完成 | e2e/m4.spec.ts |
| M5 打磨与完备 | ⬜ 未开始 | e2e/m5.spec.ts |
| M6 可选扩展 | ⏸ 暂缓 | — |

## 里程碑

### M0 · 脚手架与画布（1–2 次会话）
任务：
- [ ] Vite + TS + Vitest + Playwright 初始化，`typecheck` / `test` / `test:e2e` 脚本接通
- [ ] 三层 canvas（文档层 / 预览层 / 交互层）+ DPR 适配
- [ ] `Viewport`：滚轮缩放（以光标为中心）、空格拖拽平移、`Ctrl+0` 适应窗口
- [ ] UI 骨架：顶部菜单、左侧工具栏、底部状态栏、右侧属性面板（先占位）
- [ ] EventBus + Editor 装配 + 命令表雏形

E2E 验收（e2e/m0.spec.ts）：
- [ ] 滚轮缩放后 `screenToCanvas` 命中预期像素，文档像素不变
- [ ] 空格拖拽平移后 offset 断言正确，状态栏坐标 / 缩放比实时更新
- [ ] `Ctrl+0` 后文档完整可见且居中
- [ ] 8192×8192 新建画布不冻结 > 500ms；全程无 console error

### M1 · 基础绘制与历史（2–3 次会话）
任务：
- [ ] 铅笔、橡皮（硬边），连线插值防断点
- [ ] `ColorManager`：前景 / 背景色、取色面板、最近颜色
- [ ] `HistoryManager`：脏矩形补丁、笔画合并、100 步上限
- [ ] 命令表接入 Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
- [ ] 导出 PNG（`canvas.toBlob`）

E2E 验收（e2e/m1.spec.ts）：
- [ ] 画一笔 → 目标像素变色 → Ctrl+Z → 逐像素复原 → Ctrl+Y → 恢复
- [ ] 一次多段拖拽只产生 1 条历史；连续两笔产生 2 条
- [ ] 导出触发下载，PNG 尺寸 = 文档尺寸
- [ ] 单测：坐标变换、补丁合并、历史合并

### M2 · 形状、填充与取色（2–3 次会话）
任务：
- [x] 画笔（大小、不透明度）
- [x] 油漆桶：扫描线洪水填充 + 容差（纯函数）
- [x] 取色器：任意工具下 `Alt + 点击`
- [x] 直线 / 矩形 / 椭圆：拖拽预览，`Shift` 约束
- [x] 填充模式：描边 / 填充 / 描边+填充，线宽属性

E2E 验收（e2e/m2.spec.ts）：
- [x] Shift 矩形在缩放 50% / 200% 下像素边界等宽高
- [x] 封闭区域填充正确、外部不泄漏；非封闭区域按边界填充
- [x] Alt 取色后前景色 = 目标像素颜色
- [x] Esc 取消预览不产生历史
- [x] 视觉回归：三形状渲染基线；单测：洪水填充

### M3 · 选区与剪贴板（3–5 次会话，最难）
任务：
- [x] 矩形选框、蚂蚁线（`prefers-reduced-motion` 关闭动画）
- [x] 套索选择（路径蒙版：移动/复制/删除均按路径裁剪）
- [x] 选区内移动、剪切 / 复制 / 粘贴（Clipboard API + 内部缓冲降级）
- [x] `Delete`、`Ctrl+A`，普通/Ctrl 拖拽移动、`Alt` 复制拖拽（浮离 Enter/点外落定、Esc 取消）
- [x] 裁剪工具：Enter / 点击框内确认，Esc 取消；裁剪后清历史、视口重新居中

E2E 验收（e2e/m3.spec.ts）：
- [x] 选区 → 复制 → 粘贴 → 移动 → Delete → 连续撤销链逐像素还原
- [x] 粘贴内容先浮离，落定后才入历史
- [x] 裁剪后文档尺寸、状态栏、视口居中三者一致
- [x] 单测：套索命中测试、路径包含判定

### M4 · 文本与文件（2–3 次会话）
任务：
- [x] 文本工具：DOM 覆盖输入框，回车 / 失焦栅格化
- [x] 字体、字号、颜色属性
- [x] 打开：文件选择、拖拽导入、粘贴图片；PNG / JPEG / WebP，GIF 取首帧
- [x] 导出：PNG、JPEG（质量 0.92）、WebP
- [x] 草稿：IndexedDB 防抖 2s 自动保存 + 启动恢复提示

E2E 验收（e2e/m4.spec.ts）：
- [x] `setInputFiles` 打开 fixture PNG，文档尺寸更新且内容像素匹配
- [x] 粘贴图片、拖拽导入路径可用
- [x] 编辑后 reload → 恢复提示出现 → 选择恢复后像素一致；选择丢弃则回到原始状态
- [x] 损坏文件给出错误提示且当前文档不受影响
- [x] 导出 JPEG / WebP 下载成功

### M5 · 打磨与完备（2–3 次会话）
任务：
- [ ] 快捷键矩阵全量接通，文本框聚焦时屏蔽工具键
- [ ] 修复 `Ctrl+V` 粘贴系统图片（快捷键 preventDefault 挡掉原生 paste 事件，改走 `clipboardData.files` 或放开默认行为；`navigator.clipboard.read` 需权限）
- [ ] 菜单：文件 / 编辑 / 查看 / 图像，与快捷键共用命令表
- [ ] 右侧面板：工具属性 + 历史列表（可点击跳转）
- [ ] 状态栏：坐标、选区尺寸、缩放、当前工具、文档尺寸
- [ ] 性能复查：脏矩形验证、大图内存
- [ ] 视觉回归补齐：整体 UI 冒烟截图

E2E 验收（e2e/m5.spec.ts）：
- [ ] 快捷键表逐项断言（含冲突与输入态屏蔽）
- [ ] 历史面板点击跳转 = 对应撤销 / 重做效果
- [ ] 全流程冒烟：新建 → 绘制 → 选区 → 文本 → 保存 → 打开 → 撤销到底
- [ ] 视觉回归全绿；人工抽查清单通过

### M6 · 可选扩展（按需）
- [ ] 图层（面板 + 合成 + 每层独立历史）
- [ ] 滤镜：灰度、反色、模糊、锐化
- [ ] 项目文件：ZIP（JSON + PNG）
- [ ] 非破坏性变换（选区旋转 / 缩放）

## 快捷键
| 快捷键 | 功能 | 阶段 |
| --- | --- | --- |
| Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z | 撤销 / 重做 | M1 |
| Ctrl+N / O / S | 新建 / 打开 / 保存 | M4 |
| Ctrl+C / X / V | 复制 / 剪切 / 粘贴 | M3 |
| Ctrl+A / Delete | 全选 / 删除选区 | M3 |
| Ctrl+ + / - / 0 | 放大 / 缩小 / 适应窗口 | M0 |
| 滚轮 | 缩放（光标为中心） | M0 |
| 空格 + 拖拽 | 平移 | M0 |
| Esc | 取消当前操作 | M1 |
| P B E G I T L R O M | 铅笔 画笔 橡皮 填充 取色 文本 直线 矩形 椭圆 选择 | M1–M3 |

## 风险与对策
- **大图内存**：画布上限 8192×8192，历史只存补丁，粘贴浮离层及时落定
- **历史膨胀**：补丁裁剪到脏矩形 + 100 步上限 + 笔画合并
- **文本跨平台**：DOM 输入框覆盖后一次性栅格化，不做富文本
- **选区复杂度**：M3 单独成期，先矩形后套索，变换操作推迟到 M6
- **视觉回归脆弱**：只对稳定元素截图，交互断言优先用像素读取
- **视图漂移**：坐标转换集中在 Viewport，禁止工具自行换算

## 完成定义（DoD）
1. `npm run typecheck`、`npm test`、`npm run test:e2e` 全绿
2. 当前里程碑 E2E 用例全部通过，无 console error / pageerror
3. 进度表状态已更新
4. 每个产生像素变更的操作都可撤销
5. 维护者人工抽查通过后才进入下一里程碑
