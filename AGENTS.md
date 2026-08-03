# AGENTS.md — hollow-board 报价计算器（给智能体的项目说明书）

> 本文件随源码一起提交，任何智能体 clone 本仓库后应**先读此文件**再动手。
> 它是一份可移植的架构地图，不依赖工作区缓存。

---

## 0. 铁律（2026-08-03 起，先于一切）

1. **只编辑 `src/index.html`**。它是唯一可编辑源码（人类可读）。
2. **绝不手动编辑或提交 `hollow-board-deploy/index.html`**——那是 CI 从源码**混淆生成**的发布产物（已被 .gitignore 忽略）。手动改动会在下次 push 时被 CI 覆盖。
3. **绝不在源码中写真实 GitHub token**。`GITHUB_TOKEN` 常量是占位符 `__GH_TOKEN_FROM_SECRET__`，CI 构建时从仓库 Secret `QUOTE_SHARED_TEMPLATE_TOKEN` 注入。
4. push 到 `main` 后，GitHub Actions 自动执行：混淆构建 → 产物校验 → 部署 Pages。**不需要、也不允许**任何人手工生成发布版。

## 1. 这是什么

一个**纯前端单文件**报价计算器（中空板/板材类）。客户给产品参数 → 自动算出原料成本、后加工费、附加费、最终单件/总价，并可打印报价单（客户联 + 计算联）。

- 技术栈：原生 HTML + CSS + 原生 JS，**无框架、无后端**（仅 OCR 识别用到 Tesseract.js CDN；构建期用 javascript-obfuscator）。
- 唯一源码：`src/index.html`（约 2900 行，所有逻辑/样式/模板系统都在内）。
- 发布产物：`hollow-board-deploy/index.html`（CI 混淆生成，**不入库**）。
- 数据：浏览器 localStorage（个人模板 `bh_quote_template`、配方自定义价 `bh_material_prices`）+ 仓库内共享模板 `hollow-board-deploy/shared-template.json`（全员同步，见 §5）。

## 2. 目录结构（仓库根）

```
.
├── src/
│   └── index.html              ← 唯一可编辑源码
├── scripts/
│   ├── build.mjs               ← 混淆构建：src → hollow-board-deploy/index.html
│   ├── verify-build.mjs        ← 产物结构校验（CI 阻断式，失败不部署）
│   └── smoke-diff.mjs          ← 差异冒烟测试（源码版 vs 混淆版行为一致性，本地调试用）
├── hollow-board-deploy/
│   ├── index.html              ← 【CI 生成，勿编辑勿提交，已 gitignore】
│   └── shared-template.json    ← 共享模板数据文件（admin 发布时经 GitHub API 写回，入库）
├── reference/                  ← 文档与旧版备份（不部署，仅供阅读）
├── .workbuddy/memory/          ← AI 上下文（MEMORY.md + 每日日志），随仓库走
├── .github/workflows/deploy.yml← CI：build → verify → deploy Pages
├── package.json / package-lock.json  ← 构建依赖（javascript-obfuscator）
├── AGENTS.md                   ← 本文件
└── .gitignore
```

## 3. 状态与核心模块（改代码前必读）

详见 `.workbuddy/memory/MEMORY.md`（更细）。要点：

- **`state` 对象**：`style`（板材/圆盘/五种箱型）、`boxCat`、`dimType`（外尺/内尺）、`materialType`、`lastBoxStyle`。
- **四大计算函数**（都在主 `<script>` 内）：
  - `calcStep1()` 产品参数/体量（面积、总立方、总吨数）
  - `calcStep2()` 原料/板材价格（配方加权 + 含税）
  - `calcStep3()` 后加工费用（遍历勾选框）
  - `calcStep4()` 附加费用/最终报价
- **模板/重置系统**：
  - `captureDefaults()`：优先用**共享模板** `sharedTemplate`（版本区间校验通过），否则 localStorage 模板，否则 `htmlDefaults` 出厂快照。
  - `applyDefaults()` 把快照写回 DOM；`resetAll()` = 模拟全新刷新，**绝不从当前 DOM 反抓**，**绝不删除用户模板**。
- **共享模板同步**（2026-08-03 新增）：
  - `loadSharedTemplate()`：页面加载时 fetch 站点根 `shared-template.json`（带 `?_t=` 缓存穿透），全员同步读取。
  - `publishSharedTemplate(flat)`：admin 存模板时经 GitHub Contents API (PUT) 写回仓库文件，轮询确认上线后提示；切回标签页检测 `_publishedAt` 弹"立即同步"横幅。
- **鉴权**：`checkAuth()` 硬编码 `dwb135790`(admin) / `dongjie345`(employee)，只控制界面 `.admin-only` 按钮。
- **打印**：`openPrintSheet()` / `renderPrintSheet()`，A4 横版，客户联在前、计算联在后；中栏"计算过程"必须与 calcStep1~4 同步改。

## 4. 修改工作流（标准动作）

1. **先 `Grep` 定位** `src/index.html`，不要凭记忆行号。
2. 读关键段确认上下文，再 `Edit`。
3. **纯 JS 逻辑修复不 bump 版本号**；只有输入框/勾选框等 DOM 结构变化才改 `TEMPLATE_VERSION`（并确认 `TEMPLATE_MIN_VERSION` 区间覆盖旧模板）。
4. **改完必须对 `src/index.html` 做 JS 语法校验**（Git Bash）：
   ```bash
   awk '/<script>/{p=1; next} /<\/script>/{p=0} p' src/index.html > _chk.js \
     && node --check _chk.js && echo "JS OK" && rm -f _chk.js
   ```
   > ⚠️ 此 awk 校验只对源码有效；混淆产物是单行脚本，awk 会误抓 HTML——产物校验用 `node scripts/verify-build.mjs`。
5. （可选但推荐）本地完整验证：
   ```bash
   npm ci                              # 首次或 lockfile 变化后
   node scripts/build.mjs              # 生成混淆产物
   node scripts/verify-build.mjs       # 结构校验
   node scripts/smoke-diff.mjs         # 源码版 vs 混淆版行为一致性（改混淆配置后必跑）
   ```
6. `git add -A && git commit -m "..." && git push` → CI 自动混淆 + 校验 + 部署，约 1~2 分钟生效。
7. 线上验证：`https://nadeldzx-glitch.github.io/Quote-Calculator/`（拉取时带 `?_t=<时间戳>` 参数穿透缓存）。

## 5. 部署与共享模板

- **唯一部署方式**：GitHub Actions（`.github/workflows/deploy.yml`）。push `main` → `npm ci` → `build.mjs` 混淆（注入 Secret token）→ `verify-build.mjs` 校验 → 上传 `hollow-board-deploy/` → Pages。
- **仓库 Secret**：`QUOTE_SHARED_TEMPLATE_TOKEN` = fine-grained PAT（仅限本仓库 contents:write）。轮换方式：GitHub 重新生成 → 更新 Secret → 旧 token 撤销 → 触发一次 workflow 重新部署。
- **共享模板**：`hollow-board-deploy/shared-template.json` 入库并随 Pages 部署在站点根。浏览器读取用相对路径 `shared-template.json`；GitHub API 写回用仓库路径 `hollow-board-deploy/shared-template.json`（两个常量 `SHARED_TEMPLATE_FETCH` / `SHARED_TEMPLATE_PATH`，**不可混用**）。
- 每次 admin 发布会产生一次 "update shared template" 提交并触发重新部署，属正常现象。

## 6. 关键约束（血泪教训）

- `resetAll()` 绝不能从当前 DOM 抓默认值（会等于没重置）——必须用 `htmlDefaults` 快照。
- 重置逻辑**不得** `localStorage.removeItem` 删除用户模板（模板是数据资产）。
- Excel 导出用正则分离（不用 DOMParser，避免 `<style>` 丢失）；Excel 单元格全内联 style。
- 箱子未选外/内尺时，打印单计算过程要空保护 + 提示。
- admin 密码明文写在 JS 里，只作界面开关，不是安全闸门。
- **混淆的局限**：只保护"用链接的人"看不到可读逻辑；仓库本身是 public，`src/index.html` 对会翻仓库的人仍可见。要彻底隐藏须仓库转私有 + 付费 Pages 或迁离公开托管（未做，用户已知悉）。
- 混淆配置（build.mjs）刻意保守：`renameGlobals:false`（保内联 onclick）、`transformObjectKeys:false`（保 localStorage 键）、`controlFlowFlattening:false`（保性能）。改动这些选项后**必须**跑 `smoke-diff.mjs`。

## 7. 快速上手清单（给新智能体）

1. `git clone <repo>` → 读 `AGENTS.md` + `.workbuddy/memory/MEMORY.md`。
2. 改 `src/index.html`（别的都别碰）。
3. 跑 §4 第 4 步的 awk+node 校验。
4. `git commit && git push` → CI 自动混淆部署。完事。
