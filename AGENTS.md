# AGENTS.md —  hollow-board 报价计算器（给智能体的项目说明书）

> 本文件随源码一起提交，任何智能体 clone 本仓库后应**先读此文件**再动手。
> 它是一份可移植的架构地图，不依赖工作区缓存。

---

## 1. 这是什么

一个**纯前端单文件**报价计算器（中空板/板材类）。客户给产品参数 → 自动算出原料成本、后加工费、附加费、最终单件/总价，并可打印报价单（客户联 + 计算联）。

- 技术栈：原生 HTML + CSS + 原生 JS，**无构建步骤、无后端、无依赖**（仅 OCR 识别用到 Tesseract.js CDN）。
- 唯一文件：`hollow-board-deploy/index.html`（约 2400 行，所有逻辑/样式/模板系统都在内）。
- 数据：**全部在浏览器 localStorage**（模板 `bh_quote_template`、配方自定义价 `bh_material_prices`）。无服务端数据库。

## 2. 目录结构（仓库根 = 本会话目录）

```
.
├── hollow-board-deploy/
│   └── index.html          ← 唯一应用文件，部署只上传这一份
├── reference/              ← 文档与旧版备份（不部署，仅供阅读）
│   ├── DEV_GUIDE.md
│   └── archive/_full_v118_backup.html
├── .workbuddy/memory/      ← AI 上下文（MEMORY.md + 每日日志），随仓库走
├── .github/workflows/deploy.yml  ← GitHub Pages 自动部署
├── AGENTS.md               ← 本文件
└── .gitignore
```

> ⚠️ 部署目录 `hollow-board-deploy/` 刻意只保留 `index.html`，
> 避免 `DEV_GUIDE.md` / 旧版备份随部署链接被公开下载。

## 3. 状态与核心模块（改代码前必读）

详见 `.workbuddy/memory/MEMORY.md`（更细）。要点：

- **`state` 对象**：`style`（板材/圆盘/五种箱型）、`boxCat`、`dimType`（外尺/内尺）、`materialType`、`lastBoxStyle`。
- **四大计算函数**（都在主 `<script>` 内）：
  - `calcStep1()` 产品参数/体量（面积、总立方、总吨数）
  - `calcStep2()` 原料/板材价格（配方加权 + 含税）
  - `calcStep3()` 后加工费用（遍历勾选框）
  - `calcStep4()` 附加费用/最终报价
- **模板/重置系统**：
  - `captureDefaults()` 从 localStorage 读模板（版本区间 `TEMPLATE_MIN_VERSION..TEMPLATE_VERSION` 才接受），否则用 `htmlDefaults`（页面加载时快照的出厂值）。
  - `applyDefaults()` 把快照写回 DOM。
  - `resetAll()` = 模拟一次全新刷新（有模板→恢复模板；无→恢复出厂），**绝不从当前 DOM 反抓**。
- **鉴权**：`checkAuth()` 硬编码 `dwb135790`(admin) / `dongjie345`(employee)，只控制界面 `.admin-only` 按钮，**不管源码修改**（源码修改靠仓库权限）。
- **打印**：`openPrintSheet()` / `renderPrintSheet()`，A4 横版，客户联在前、计算联在后。

## 4. 修改工作流（标准动作）

1. **先 `Grep` 定位**，不要凭记忆里的行号（每次增删代码行号会变）。
2. 读关键段确认上下文，再 `Edit`。
3. **纯 JS 逻辑修复不 bump 版本号**；只有输入框/勾选框等 DOM 结构变化才改 `TEMPLATE_VERSION`（并确认 `TEMPLATE_MIN_VERSION` 区间覆盖旧模板）。
4. **改完必须 JS 语法校验**（Git Bash）：
   ```bash
   awk '/<script>/{p=1; next} /<\/script>/{p=0} p' hollow-board-deploy/index.html > _chk.js \
     && node --check _chk.js && echo "JS OK" && rm -f _chk.js
   ```
5. 提交：`git add -A && git commit -m "..." && git push`。
6. 推送即触发 GitHub Pages 自动部署（见 §5）。

## 5. 部署（两种手段，任选）

### A. 主推：GitHub Pages 自动部署（任何智能体通用）
- 仓库已配置 `.github/workflows/deploy.yml`：push 到 `main` → 自动把 `hollow-board-deploy/` 发布到 GitHub Pages。
- **任何智能体**（不限于 WorkBuddy）只要 `git push` 即上线，无需专用工具。
- 首次需在 GitHub 仓库 Settings → Pages → Source 选 "GitHub Actions"。

### B. 备选：WorkBuddy 一键部署（仅本工作区）
- 在 WorkBuddy 内调用部署工具，沙箱 id：`f2dace729d844584ae23ed7275c41088`，目录 `hollow-board-deploy`。
- 链接形如 `https://f2dace729d844584ae23ed7275c41088.sh5.agentos-app.net`（CloudStudio 生成的**临时**地址，宜作预览，生产建议用 A）。

## 6. 关键约束（血泪教训）

- `resetAll()` 绝不能从当前 DOM 抓默认值（会等于没重置）——必须用 `htmlDefaults` 快照。
- 重置逻辑**不得** `localStorage.removeItem` 删除用户模板（模板是数据资产）。
- 源码是纯前端，**运行中 App 的代码可被拿到链接的人用"查看源代码"下载**——这是物理限制。要真正隐藏逻辑需搬后端（未做）。
- admin 密码明文写在 JS 里，只作界面开关，不是安全闸门。

## 7. 快速上手清单（给新智能体）

1. `git clone <repo>` → 打开目录。
2. 读 `AGENTS.md` + `.workbuddy/memory/MEMORY.md`。
3. 改 `hollow-board-deploy/index.html`。
4. 跑 §4 的 JS 校验。
5. `git commit && git push` → 自动部署。
