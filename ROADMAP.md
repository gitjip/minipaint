# Web 画图软件方案

## 约束
- 个人项目
- 仅电脑端
- 鼠标 + 键盘
- 本地运行，无后端、无移动端、无 PWA、无云同步
- 目标：微软画图核心功能

## 技术栈
- TypeScript + Vite
- 原生 DOM/CSS
- Canvas 2D
- IndexedDB
- File API、Clipboard API、createImageBitmap、canvas.toBlob
- Vitest

## 架构
- Editor：总控
- Document：文档数据
- Viewport：缩放、平移、坐标
- Renderer：画布渲染
- ToolManager：工具注册与分发
- HistoryManager：撤销、重做
- SelectionManager：选区
- ColorManager：颜色
- FileManager：打开、导出、草稿
- ShortcutManager：快捷键
- UIManager：菜单、工具栏、面板、状态栏

## 数据模型
- Document：宽高、背景、位图、选区、历史、视图
- ToolOptions：当前工具、笔刷大小、颜色、线宽、字体、填充模式
- HistoryEntry：名称、执行、撤销、重做、可合并
- Selection：矩形/套索、蒙版、边界框
- Viewport：缩放、平移、DPR
- Palette：前景色、背景色、最近颜色

## 渲染
- 三层 Canvas：文档层、预览层、交互层
- 坐标转换：屏幕 → 画布 → 像素
- 脏矩形重绘
- requestAnimationFrame
- DPR 适配
- 最大画布 8192×8192
- 历史记录用像素补丁，不存整图

## 工具
- 铅笔、画笔、橡皮
- 油漆桶、取色器
- 直线、矩形、椭圆
- 文本
- 矩形选择、套索、裁剪
- 修饰键：Shift 约束，Alt 取色，Ctrl 选择/移动，空格平移
- 工具状态机：空闲 → 按下 → 拖拽 → 提交/取消

## 历史
- 命令接口：执行、撤销、重做、合并
- 像素操作存脏矩形补丁
- 连续笔画合并为一次
- 栈上限 50–100

## 文件
- 打开：文件选择、拖拽、粘贴
- 格式：PNG、JPEG、WebP，GIF 取首帧
- 导出：PNG、JPEG、WebP
- 草稿：IndexedDB 自动保存，启动恢复
- 可选：项目文件 ZIP，JSON + 图层 PNG

## UI
- 顶部：菜单、新建、打开、保存
- 左侧：工具栏
- 底部：调色板、前景/背景色、状态栏
- 右侧：工具属性、历史
- 中央：画布
- 状态栏：坐标、尺寸、缩放、当前工具

## 快捷键
- Ctrl+Z：撤销
- Ctrl+Y / Ctrl+Shift+Z：重做
- Ctrl+C / X / V：复制 / 剪切 / 粘贴
- Ctrl+A：全选
- Delete：删除选区
- Ctrl+N / O / S：新建 / 打开 / 保存
- Ctrl+ + / -：缩放
- Ctrl+0：适应窗口
- 空格 + 拖拽：平移
- 滚轮：缩放
- 工具键：P 铅笔，B 画笔，E 橡皮，G 填充，I 取色，T 文本，L 直线，R 矩形，O 椭圆，M 选择

## 开发顺序
1. 画布、缩放、平移、坐标转换
2. 铅笔、橡皮、颜色、撤销重做、导出 PNG
3. 画笔、填充、取色、直线、矩形、椭圆
4. 选择、套索、剪切复制粘贴、移动、删除、裁剪
5. 文本、打开图片、拖拽导入、自动保存
6. 可选：图层、滤镜、项目文件

## 风险
- 大图内存：限制画布尺寸
- 历史膨胀：补丁 + 步数限制
- 文本跨平台：覆盖输入框后栅格化
- 选择变换复杂：最后实现
- Safari 兼容弱：Chrome / Edge 优先