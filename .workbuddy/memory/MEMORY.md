# 报价计算器 — 项目状态快照

> **最后更新**: 2026-07-31 v162 | **文件**: `hollow-board-deploy/index.html`
> **沟通约定**: 用户用截图标注"红框/绿框"，文字说"绿色框里的去掉/改成像 XXX 那样" → 意思是**参考框**是指南，**被框的**是要改的目标；若截图中**多个同色框**，必须读图片文字区分。

---

## 1. 文件结构

单文件 HTML，内嵌 CSS + 两个 `<script>` 块。

| 区域 | 内容 |
|------|------|
| `<style>` | 全部 CSS（变量、布局、组件、打印、鉴权） |
| `<body>` | HTML + 内联脚本 |
| 鉴权登录层 | `#authOverlay`（密码输入） |
| 存为模板确认弹窗 | `#tplConfirm`（是/否） |
| 页面头部 | 标题 + 打印/存为模板/重置按钮 |
| 智能识别栏 | OCR 上传 + 文本输入 + 解析按钮 |
| **左侧面板** `.left-col` | 四个计算板块 |
| **右侧面板** `.right-col` | `.quote-stack` 六项竖向汇总 |
| 主脚本 `<script>` | 全部业务逻辑 |
| OCR 脚本 `<script>` | Tesseract.js 图片识别 |
| 打印弹窗 HTML | `#printSheetModal` |

---

## 2. 状态管理 `state`

```js
const state = {
  style: '',           // '' | '板材' | '圆盘' | 纸箱式 | 插底式 | 焊底式 | 骨架箱 | 全包式
  boxCat: false,       // "箱子"大类是否展开
  dimType: '',         // '' | '外尺' | '内尺'
  materialType: '普通', // 普通 | 回料+母料 | 新料+透明母料 | 防静电 | 导电 | 耐低温 | 阻燃
  lastBoxStyle: ''     // 上次选的箱型，切走再切回时恢复
};
```

- 板材/圆盘/箱子 三个顶层 chip（`#s1_style_row`）
- 纸箱式/插底式/焊底式/骨架箱/全包式 五个子 chip（`#s1_box_sub_row`），默认隐藏
- 点"箱子" → `boxCat=true`，展开子行 + 显示外尺/内尺（`#s1_dimtype_row`），`style=''`
- 点具体箱型 → `style=该箱型`，`lastBoxStyle=该箱型`，子行保持展开
- 切回箱子 → `style=lastBoxStyle||''` 恢复上次箱型
- 切到板材/圆盘 → `boxCat=false`，隐藏子行和尺类型，`lastBoxStyle` 不清空
- 高只在箱类5样式显示：`isHeightHidden()` 返回 true 当 style 不是箱类五选一

### 配方显隐条件（calcAll 开头）

- 普通/回料+母料/新料+透明母料 → 显示：新料、新料比例、母料、母料比例
- 防静电/导电/耐低温/阻燃 → 显示：全部（含特殊料、特殊料比例）
- 固定成本+原料利润始终可见

---

## 3. 四大计算模块

### calcStep1() — 产品参数/体量

返回：`{A(厚度), B(克重), E(长), F(宽), G(高), H(数量), I(板材长), J(板材宽), Ia(板材长②), Ja(板材宽②), K(形状系数), L(单产品面积), M(总立方数), N(总吨数), ur(使用率小数)}`

各样式 case 分支计算：
- **板材**：L=I×J×K×ur，M=L×A×H/1e9，N=L×B×H/1e6
- **纸箱式/插底式**：板材长=2L+2W+40，板材宽=W+H+15
- **焊底式**：双板——板材①长=2L+2W+50/宽=W+H+15（箱体）、板材②长=L+W+50/宽=W+H+15（盖板）、单产品面积=板①面积+板②面积
- **骨架箱**：长=E+30，宽=0.5F<G时取G+5否则0.5F+10
- **全包式**：板材长=2L+2W+40不变，板材宽=W+H+15不变
- **圆盘**：外直径E、内直径F；板材长=板材宽=E+10；使用率K=π((E/2)²-(F/2)²)/E²（只读展示）；单产品面积L=π((E/2)²-(F/2)²)/1e6；总立方数M=E²×A×H/1e9；总吨数N=L×B×H/1e6

### calcStep2() — 原料/板材价格

返回：`{S(原料成本), T(原料售价), U(平方价), V(板材售价单), W(板材售价总), X(利润率)}`

核心公式：
- 原料成本 S = 各料按比例加权 + 固定成本
- 含税时 T = (S+利润)×(1+税率)
- 平方价 U = T × 克重 / 1000
- 板材利润率 X = `(A==='是') ? (T*0.94-S-Q)/T : R/T`

### calcStep3() — 后加工费用

遍历 `#cb_grid` + `#cb_grid2` + `#cb_custom_grid` 勾选框，汇总checked工序价格。

返回：`{sum(加工费合计), details(工序数组), sheetUnitPrice, productUnitPrice, quantity, productTotalPrice}`

### calcStep4() — 附加费用/最终报价

返回：`{I(最终单件报价), J(最终报价总)}`

公式：最终报价(单) = (成品价格(单) + (运费+刀模+丝网)/数量) × 零头修正 + 价格修正

---

## 4. 模板/重置系统

- `captureDefaults()`：读取 `bh_quote_template`（localStorage），版本**区间**校验（`TEMPLATE_MIN_VERSION <= _v <= TEMPLATE_VERSION`，v164 改）；首次调用时快照 HTML 出厂值到 `htmlDefaults`
- `applyDefaults()`：恢复模板值到 DOM + 调用 selectStyle/syncStyleUI/selectDimType
- `resetAll()`：**不碰 localStorage**（v164 教训：重置≠删除模板！）→ 清内存 defaults/materialPrices → `captureDefaults()` 模拟全新加载（有模板→恢复模板；无模板→恢复 htmlDefaults 出厂快照）→ applyDefaults + 清空智能识别框 + calcAll。**⚠️ 绝不能从当前 DOM 反抓默认值（DOM 是用户输入值，抓了等于没重置）**
- `hasSavedTemplate()`：判断 localStorage 是否有版本有效的模板；重置弹窗文案/toast 据此动态区分"恢复为已保存的模板"/"恢复为出厂默认值"
- 管理员 `doSaveTemplate()` 存到 `bh_quote_template`（与重置模板同一 key，v82 修复了 key 不一致导致重置后模板丢失的 bug）

---

## 5. 打印系统

- `openPrintSheet()`：先 `add('show')` 显示弹窗 → `try { 重新计算+渲染 } catch(e) {}` → 确保弹窗始终能打开
- `renderPrintSheet()`：按 `_printOption`（verify/customer/all）组装 HTML，**客户联在前、计算联在后**
- `_printOption` 默认值:`'verify'`（v96 改了,从 `'all'` 改为 `'verify'`+打开弹窗时也设 verify+高亮"计算联"按钮）
- `selectPrintOpt(opt)`：切换打印内容（客户联/计算联），**按钮顺序：客户联先、计算联后**
- **A4 横版**（v94 改的）:`@page { size: A4 landscape; margin: 8mm; }` + `.print-sheet { width:1123px; min-height:794px; }`
- **计算联三栏布局（v82 重构）**：
  - **左（已知条件）**：产品样式、材料类型、厚度、克重、尺寸、数量、是否含税 7 项 + 后加工工序表格 + 附加情况（运费/刀模/丝网/零头修正/价格修正）
  - **中（计算过程）**：④段体量→原料→后加工→附加，逐行展示公式与中间值
  - **右（计算结果）**：最终单价、数量、大货总价、是否含税、总体积、总吨数、是否含运、客户收货地址（每项带隐藏按钮，客户联可隐藏行）
- **客户联**：产品样式 + 尺寸 + 数量 + 最终报价（右侧计算结果可隐藏行）

---

## 6. 鉴权/权限系统

### HTML
- `#authOverlay`：登录遮罩，`DOMContentLoaded` 时若 `sessionStorage.role` 已设则隐藏，否则 flex 显示
- `#tplConfirm`：存为模板确认弹窗（是/否），初始 `display:none`

### JS
```js
checkAuth(): dwb135790→admin, dongjie345→employee, 存入 sessionStorage
applyRole(): role==='admin' 则显示所有 .admin-only 元素，否则隐藏
saveAsTemplate(): 弹出 tplConfirm
doSaveTemplate(): 收集所有 input/select/textarea → bh_quote_template，包含 _v/_userSetPrices/_customCB
hideTplConfirm(): 关闭确认弹窗，不保存
```

### 按钮权限
```html
<button class="reset-btn admin-only" onclick="saveAsTemplate()">★ 存为模板</button>
```
员工看不到此按钮。

---

## 7. 修改工作流（每次接到需求的标准动作）

1. **用户截图+一句话** → 先 `Read` 图片理解绿/红框内容（注意：图片可能读不出来，靠文字描述+grep 代码定位）
2. `Grep` 相关关键词定位行号，**不靠记忆中的行号**（每次增删代码后行号会变）
3. `Read` 关键段（15-30 行）看上下文，确认要改的范围
4. 必要时同步检查 calcStep1~4 的对应用法
5. `Edit` 修改（一次性把同一处多行编辑合并成一个 Edit）
6. **仅在 DOM/字段结构变化时**才 bump `TEMPLATE_VERSION`（纯 JS 逻辑修复不要 bump——v164 教训：bump 会让用户已存模板被区间校验误判失效）
7. **JS 语法校验**：`awk '/<script>/{p=1; next} /<\/script>/{p=0} p' index.html > hollow_check.js && node --check hollow_check.js && rm -f hollow_check.js`（sed 在 Git Bash 处理中文路径会出错，用 awk）
8. `workbuddy_cloudstudio_deploy` 部署 → 拿到新 URL
9. 在 `2026-07-XX.md` 一句话追加本次修改摘要（不写流水账！）
10. 部署信息（URL+行数）以本次回复为准，旧 URL 已废弃

---

## 8. 关键配置常量

- `TEMPLATE_VERSION = 164`，`TEMPLATE_MIN_VERSION = 163`（区间校验兼容旧模板）
- 默认使用率 `s1_usageRate` value="100"
- 税点默认 7%（`s1_taxRate` value="7"）
- 默认配方：普通料（newPrice=9000, masterPrice=2000, fixedCost=1700, profit=0）
- 材料配方映射 `materialDefaults`

---

## 9. 部署信息

- **CloudStudio 沙箱**：`f2dace729d844584ae23ed7275c41088`
- **访问地址**：`https://f2dace729d844584ae23ed7275c41088.sh5.agentos-app.net`
- **本地路径**：`G:\WorkBuddy 存储\2026-07-29-23-12-13\hollow-board-deploy\index.html`
- **工作日志**：`G:\WorkBuddy 存储\2026-07-29-23-12-13\.workbuddy\memory\2026-07-30.md`

---

## 10. 修改注意事项

1. 每次修改后 `workbuddy_cloudstudio_deploy` 重新部署；`TEMPLATE_VERSION` 只在 DOM/字段结构变化时才 bump（纯逻辑修复不 bump）
2. 部署前 **必须** 校验 JS 语法：用 awk 提取 `<script>` 块内容到 `hollow_check.js`，node --check 校验，成功后再删
3. **行的精确范围**：主 JS = `<script>` 到 `</script>` 之间。代码每次增删后行号会偏移，**永远 grep 重新定位**，不要凭记忆中的行号
4. 密码硬编码在 `checkAuth()` 中，员工不能改逻辑只能改数字
5. 修改右侧汇总面板时需同步更新 `updateSummary()`
6. 修改打印单"中栏计算过程"时：①体量 / ②原料 / ③后加工 / ④附加费用的格式**两侧（calcStepN + 打印单 calcSteps 模板）必须同时改**
7. 存为模板用 key `bh_quote_template`，重置也读同一 key（v82 已统一修复）
8. `_printOption` 默认 `'verify'`，打开打印弹窗时也要重置为 verify
9. 箱子没选外/内尺时：`state.dimType === ''` 要做空保护——打印单 calcSteps ① 整段不渲染 + 加提示行（v95）
10. 已删除/修复的死代码备忘：旧版 saveAsTemplate 已被覆盖、openPrintSheet try/catch try 缺 catch 已补
