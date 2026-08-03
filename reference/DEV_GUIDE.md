# 报价计算器 — 开发文档

> ⚠️ **2026-08-03 结构变更**：仓库已改为「源码/构建分离」。唯一可编辑源码为 **`src/index.html`**；`hollow-board-deploy/index.html` 是 CI 混淆生成的发布产物（不入库、勿编辑）。部署统一走 GitHub Actions（push main 自动混淆+部署）。**以仓库根 `AGENTS.md` 为准**，本文中 `index.html` 路径与 CloudStudio 部署方式均为历史记录。
>
> **文件**: `src/index.html`（单文件，约 2900 行）| **版本**: v164 | **最后更新**: 2026-08-03
> **部署地址**: https://nadeldzx-glitch.github.io/Quote-Calculator/

---

## 快速上手（给 AI 或新开发者）

1. **打开文件**: 只有一个 `index.html`，全部代码（HTML+CSS+JS）都在里面
2. **修改前必做**: 用 `grep -n "关键词" index.html` 定位行号——**行号每次修改后会变，不要记行号**
3. **改完必做**: JS 语法校验 → 部署 → 测试
4. **用户习惯**: 用户用截图标注红框/绿框 + 一句话描述需求。绿框=参考样例，红框=要改的目标

---

## 一、文件结构总览

```
index.html (2862行)
├── <style>          行 7-689    全部 CSS
├── <body>           行 691-1138
│   ├── 鉴权遮罩       行 694      #authOverlay（密码输入）
│   ├── 模板确认弹窗   行 704      #tplConfirm
│   ├── 页面头部       行 723      标题 + 存为模板/重置按钮
│   ├── 智能识别栏     行 734      OCR 上传 + 文本解析
│   ├── 左侧面板       行 749      四个计算板块（产品参数/原料配方/后加工/附加费用）
│   ├── 右侧面板       行 1088     六项竖向汇总
│   ├── 打印弹窗       行 2840     #printSheetModal
│   └── <script>      行 1139-2810  全部业务逻辑
│   └── OCR <script>  行 2813-2837  Tesseract.js 图片识别
```

---

## 二、鉴权系统

```js
// 行 2753
密码 dwb135790 → admin（管理员，可存模板）
密码 dongjie345 → employee（员工）
// 存入 sessionStorage.role，页面刷新后保留
```

- `admin` 能看到"★ 存为模板"按钮（class=`admin-only`）
- `employee` 看不到该按钮

---

## 三、状态管理 `state`

```js
const state = {
  style: '',           // 当前产品样式：''|'板材'|'圆盘'|'纸箱式'|'插底式'|'焊底式'|'骨架箱'|'全包式'
  boxCat: false,       // "箱子"大类是否展开
  dimType: '',         // ''|'外尺'|'内尺'
  materialType: '普通', // 普通|回料+母料|新料+透明母料|防静电|导电|耐低温|阻燃
  lastBoxStyle: ''     // 上次选的箱型，切走再切回时恢复
};
```

### 样式选择逻辑
- 板材/圆盘/箱子 三个顶层 chip
- 纸箱式/插底式/焊底式/骨架箱/全包式 五个子 chip，默认隐藏
- 点"箱子" → 展开子行 + 显示外尺/内尺选择
- 高度输入框只在箱类5种样式显示（板材/圆盘不显示高度）

---

## 四、四大计算模块

### calcStep1() — 产品参数/体量
返回：`{A(厚度), B(克重), E(长), F(宽), G(高), H(数量), I(板材长), J(板材宽), Ia(板材长②), Ja(板材宽②), K(形状系数), L(单产品面积), M(总立方数), N(总吨数), ur(使用率小数)}`

各样式公式：
- **板材**：面积 L=长×宽×使用率，总立方=面积×厚度×数量÷1e9，总吨数=面积×克重×数量÷1e6
- **纸箱式/插底式**：板材长=2L+2W+40，板材宽=W+H+15
- **焊底式**：双板——板①(箱体)=纸箱式公式、板②(盖板)=长+宽+50，面积=板①+板②
- **骨架箱**：长=E+30，宽=0.5F<G时取G+5否则0.5F+10
- **全包式**：板材长=2L+2W+40，板材宽=W+H+15
- **圆盘**：外径E、内径F；板材长=板材宽=E+10；使用率=π((E/2)²-(F/2)²)/E²

### calcStep2() — 原料/板材价格
返回：`{S(原料成本), T(原料售价), U(平方价), V(板材售价单), W(板材售价总), X(利润率)}`

- 原料成本 = 各料按比例加权 + 固定成本
- 含税时 售价 = (成本+利润)×(1+税率)
- 平方价 = 售价 × 克重 / 1000

### calcStep3() — 后加工费用
遍历 `#cb_grid` + `#cb_grid2` + `#cb_custom_grid` 勾选框，汇总 checked 工序价格。
返回：`{sum(加工费合计), details(工序数组), sheetUnitPrice, productUnitPrice, quantity}`

### calcStep4() — 附加费用/最终报价
返回：`{I(最终单件报价), J(最终报价总), E(运费), G(零头修正), H(价格修正)}`

公式：最终报价(单) = (成品价格(单) + (运费+刀模+丝网)/数量) × 零头修正 + 价格修正

---

## 五、打印/导出系统

### 打印弹窗 HTML（行 2840）
```html
<div class="print-overlay" id="printSheetModal">
  <div class="print-sheet">
    <h1>报价单</h1>
    <div class="ps-printopts">
      <button data-opt="verify" onclick="selectPrintOpt('verify')">计算联</button>
      <button data-opt="customer" onclick="selectPrintOpt('customer')">客户联</button>
    </div>
    <div id="printSheetContent"></div>
    <div class="ps-actions">
      <button onclick="doPrintSheet()">🖨 打印 / 另存为PDF</button>
      <button onclick="exportCurrentExcel()">📊 导出 Excel</button>
      <button onclick="closePrintSheet()">关闭</button>
    </div>
  </div>
</div>
```

### 核心函数

| 函数 | 说明 |
|------|------|
| `openPrintSheet()` | 打开弹窗，调 buildPrintParts() 生成内容，默认显示计算联 |
| `buildPrintParts()` | **核心**：生成两套 HTML——`customer`/`verify`（flex布局，屏幕+PDF用）和 `customerExcel`/`verifyExcel`（table布局，Excel用），存入 `_printParts` |
| `renderPrintSheet()` | 按 `_printOption` 把对应 HTML 写入 `#printSheetContent` |
| `selectPrintOpt(opt)` | 切换 verify/customer |
| `togglePrintLine(el)` | 点击"隐藏"按钮，切换行的 `hidden-line` 类，按钮文字在"隐藏/显示"间切换 |
| `doPrintSheet()` | 直接 `window.print()`，CSS 的 `@media print` 自动排除隐藏行 |
| `getCleanExcelHTML()` | 用正则分离 `<style>` 和 table 内容，过滤隐藏行（`data-label` 匹配），输出完整 HTML |
| `exportCurrentExcel()` | 按 `_printOption` 调用导出 |
| `downloadExcel(html, filename)` | 生成 Blob → 下载 .xls |

### 隐藏行机制
- 每行 `<div class="calc-row print-line">` 带 `<button class="line-hide-btn">隐藏</button>`
- 点击 → 行加 `hidden-line` 类 → 屏幕显示虚线框+"显示"按钮 → **打印/Excel 时整行消失**
- CSS：`@media print { .calc-row.hidden-line { display:none !important; } }`
- Excel 过滤：`getCleanExcelHTML()` 用正则匹配 `data-label` 属性删除对应 `<tr>`

### buildPrintParts() 返回值
```js
return {
  customer,       // 客户联 HTML（flex布局，屏幕+PDF）
  verify,         // 计算联 HTML（flex布局，屏幕+PDF）
  customerExcel,  // 客户联 HTML（table布局，Excel专用，全部内联style）
  verifyExcel,    // 计算联 HTML（table布局，Excel专用，全部内联style）
  dateTxt         // 日期字符串
};
```

### 计算联三栏布局
- **左栏（已知条件）**：产品样式、原料配方、比例、厚度、克重、尺寸、后加工工序、附加情况（运费/刀模/丝网/零头/价格修正）
- **中栏（计算过程）**：四段公式展示（体量→原料→后加工→附加），用 `cpLine()` 生成
- **右栏（计算结果）**：最终单价、数量、大货总价、是否含税、总体积、总吨数、是否含运、客户收货地址（8项）

### 客户联两栏布局
- **左栏**：已知条件（与计算联相同，但后加工工序只显示名称不带价格）
- **右栏**：计算结果（与计算联完全一致的8项）

### Excel 导出关键点
- Excel 不支持 `<style>` class 样式 → 所有 `td` 必须用**内联 style**
- `getCleanExcelHTML()` 用正则（不用 DOMParser，避免 `<style>` 丢失）
- 隐藏行通过 `data-label` 属性正则匹配过滤

---

## 六、模板/重置系统

- localStorage key: `bh_quote_template`
- `captureDefaults()`：读取模板，版本号校验
- `applyDefaults()`：恢复模板值到 DOM + 调用 selectStyle/syncStyleUI/selectDimType
- `resetAll()`：调 applyDefaults + 清空智能识别框 + calcAll
- `doSaveTemplate()`：管理员存模板（与重置用同一 key）

---

## 七、OCR 图片识别

- Tesseract.js v5 CDN
- `ocrAndFill(inputEl)`：选图 → 识别 `chi_sim+eng` → 填入 `#parseInput` → 自动调 `parseAndFill()`

---

## 八、工具函数

| 函数 | 说明 |
|------|------|
| `val(id)` | 读取 input 值 → float |
| `text(id, t)` | 写入 textContent |
| `fmt(v, d)` | 四舍五入保留 d 位小数 |
| `cpLine(k, formula, calc, val)` | 计算过程四段式 HTML |
| `cpHead(t)` | 计算过程小标题 |
| `showToast(msg)` | 顶部 toast 2秒消失 |
| `setVal(id, v)` | 写 input value + 触发 input 事件 |
| `setSelect(id, v)` | 设 select value + 触发 change |
| `dimShow(r1)` | 根据样式返回尺寸显示文本 |

---

## 九、修改工作流（每次改代码的标准步骤）

1. **定位**: `grep -n "关键词" index.html` 找到行号（**不要靠记忆，行号会变**）
2. **阅读**: `Read` 相关代码段，确认修改范围
3. **编辑**: `Edit` 修改（同一处多行编辑合并成一次）
4. **bump 版本**: `TEMPLATE_VERSION` 加 1（当前行 1760）
5. **JS 语法校验**:
   ```bash
   cd hollow-board-deploy
   awk '/<script>/{p=1; next} /<\/script>/{p=0} p' index.html > hollow_check.js
   node --check hollow_check.js && echo "JS OK"
   rm -f hollow_check.js
   ```
   > 注意：用 awk 不用 sed，Git Bash 的 sed 在中文路径上有 bug
6. **部署**: `workbuddy_cloudstudio_deploy` 工具部署 → 拿到新 URL
7. **测试**: 用户在线测试，确认效果

---

## 十、注意事项

1. **行号会变**：每次增删代码后行号偏移，永远用 grep 重新定位
2. **打印单公式对齐**：打印单中栏的计算过程格式必须与 calcStep1~4 一致，改一边必须改两边
3. **Excel 内联样式**：Excel 对 `<style>` class 支持差，所有 table 单元格必须用内联 `style`
4. **getCleanExcelHTML 不用 DOMParser**：DOMParser 会把 `<style>` 移到 head 导致丢失，用正则分离
5. **箱子没选外/内尺**：打印单计算过程不渲染，提示"请先选择外尺或内尺"
6. **密码硬编码**：在 `checkAuth()` 里，改密码改数字即可
