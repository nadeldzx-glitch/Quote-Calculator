/**
 * 构建产物结构性校验（CI 在 build 后、deploy 前运行；失败会阻断部署）
 * 用法：node scripts/verify-build.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'hollow-board-deploy', 'index.html');
const html = readFileSync(OUT, 'utf8');

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures += 1;
};

// 1) 每个内联 script 语法有效（不执行，仅编译）
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = 0, syntaxOk = 0;
while ((m = re.exec(html))) {
  blocks += 1;
  try { new Function(m[1]); syntaxOk += 1; } catch (e) {
    console.log(`  block ${blocks} 语法错误: ${e.message}`);
  }
}
check(`内联 script 块数 >= 2 (实际 ${blocks})`, blocks >= 2);
check(`全部 script 语法通过 (${syntaxOk}/${blocks})`, syntaxOk === blocks);

// 2) 混淆标记：大量 _0x 十六进制标识符
const hexCount = (html.match(/_0x/g) || []).length;
check(`混淆标识符 _0x 数量 > 500 (实际 ${hexCount})`, hexCount > 500);

// 3) 全局函数名保留（HTML 内联 onclick 依赖）
for (const fn of ['calcStep1', 'calcStep2', 'calcStep3', 'calcStep4', 'doSaveTemplate', 'publishSharedTemplate', 'loadSharedTemplate']) {
  check(`全局函数保留: ${fn}`, html.includes(fn));
}

// 4) 外链 CDN 脚本（Tesseract.js）保留
check('Tesseract CDN script 保留', /<script[^>]*src=["'][^"']*tesseract/i.test(html));

// 5) HTML 骨架完整
check('DOCTYPE 存在', /^<!DOCTYPE html>/i.test(html.trim()));
check('页面大小 > 100KB', html.length > 100 * 1024);

// 6) 若提供了 token 环境变量，构建产物不应再含占位符的明文（占位符应已被替换）
if (process.env.QUOTE_SHARED_TEMPLATE_TOKEN) {
  check('token 已注入（无占位符明文）', !html.includes('__GH_TOKEN_FROM_SECRET__'));
}

console.log(failures === 0 ? '\nVERIFY OK' : `\nVERIFY FAILED: ${failures} 项`);
process.exit(failures === 0 ? 0 : 1);
