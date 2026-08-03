/**
 * 构建脚本：src/index.html(可读源码) → hollow-board-deploy/index.html(混淆发布版)
 *
 * - 仅混淆内联 <script>（跳过带 src 的外链脚本，如 Tesseract.js CDN）
 * - HTML / CSS 不改动，保证 DOM id、内联 onclick 等引用不受破坏
 * - GITHUB_TOKEN 占位符由环境变量 QUOTE_SHARED_TEMPLATE_TOKEN 注入（CI 仓库 Secret）
 *   本地无此环境变量时保留占位符：计算器功能正常，仅“发布共享模板”会 401 提示
 *
 * 用法：node scripts/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src', 'index.html');
const OUT = join(root, 'hollow-board-deploy', 'index.html');
const TOKEN_PLACEHOLDER = '__GH_TOKEN_FROM_SECRET__';

const html = readFileSync(SRC, 'utf8');

// 1) 注入 token（CI 环境变量；缺省保留占位符）
const token = process.env.QUOTE_SHARED_TEMPLATE_TOKEN || TOKEN_PLACEHOLDER;
const withToken = html.split(TOKEN_PLACEHOLDER).join(token);
if (token === TOKEN_PLACEHOLDER) {
  console.warn('[build] 警告: 未提供 QUOTE_SHARED_TEMPLATE_TOKEN，发布共享模板功能将不可用');
}

// 2) 逐块混淆内联 <script>
let blockCount = 0;
const obfuscated = withToken.replace(
  /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
  (match, code) => {
    if (!code || !code.trim()) return match;
    blockCount += 1;
    const result = JavaScriptObfuscator.obfuscate(code, {
      target: 'browser',
      compact: true,
      renameGlobals: false,        // 保留全局函数名，兼容 HTML 内联 onclick="xxx()"
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 1.0,   // 全部字符串入数组编码：保证 token 绝不以明文出现
      splitStrings: false,         // 避免截断 emoji 等代理对字符
      numbersToExpressions: true,  // 让定价常量不易被直接阅读
      simplify: true,
      transformObjectKeys: false,  // 保守：不破坏 localStorage 模板键
      controlFlowFlattening: false,// 保守：避免性能与兼容性风险
      deadCodeInjection: false,
      sourceMap: false
    });
    return '<script>' + result.getObfuscatedCode() + '</script>';
  }
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, obfuscated, 'utf8');
console.log(`[build] OK: 混淆 ${blockCount} 个内联 script 块 -> ${OUT} (${obfuscated.length} bytes)`);
