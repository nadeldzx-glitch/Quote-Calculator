/**
 * 一次性差异冒烟测试：在相同 DOM 桩环境下分别运行 源码版 与 混淆版 的每个 script 块，
 * 比较二者行为是否一致（同样跑完 / 同样在何处抛错）。用于首次启用混淆前的信心验证。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function extract(file) {
  const html = readFileSync(file, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const out = []; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function makeAny() {
  const fn = function () { return any; };
  const any = new Proxy(fn, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return (h) => (h === 'string' ? '' : 0);
      if (p === 'then') return undefined;
      if (p === Symbol.iterator) return function* () {};
      return any;
    },
    apply() { return any; },
    construct() { return any; },
    set() { return true; }
  });
  return any;
}

async function run(tag, blocks) {
  const any = makeAny();
  const store = {};
  const asyncErrors = [];
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, JSON, Math, Date, Number, String, Array, Object, RegExp, Error, TypeError,
    parseFloat, parseInt, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, escape, unescape,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    document: any, navigator: any, location: any, history: any,
    getComputedStyle: () => any, requestAnimationFrame: (f) => 0,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }),
    prompt: () => null, alert: () => {}, confirm: () => true,
    Image: makeAny(), FileReader: makeAny(), Tesseract: makeAny(), XMLHttpRequest: makeAny()
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const results = [];
  for (let i = 0; i < blocks.length; i++) {
    try {
      vm.runInContext(blocks[i], ctx, { timeout: 8000, filename: `${tag}-block${i}.js` });
      results.push('completed');
    } catch (e) {
      results.push(`${e.name}: ${String(e.message).slice(0, 90)}`);
    }
  }
  // 让 promise 微任务/回调沉淀，收集异步错误
  const rej = [];
  const onRej = (e) => rej.push(`${e && e.name}: ${String(e && e.message).slice(0, 90)}`);
  process.on('unhandledRejection', onRej);
  await new Promise((r) => setTimeout(r, 500));
  process.off('unhandledRejection', onRej);
  return { results, asyncErrors: rej };
}

const srcBlocks = extract('src/index.html');
const obfBlocks = extract('hollow-board-deploy/index.html');
console.log(`块数: src=${srcBlocks.length} obf=${obfBlocks.length}`);

const a = await run('src', srcBlocks);
const b = await run('obf', obfBlocks);
console.log('src  同步结果:', JSON.stringify(a.results));
console.log('obf  同步结果:', JSON.stringify(b.results));
console.log('src  异步异常:', JSON.stringify(a.asyncErrors));
console.log('obf  异步异常:', JSON.stringify(b.asyncErrors));

const parity = JSON.stringify(a.results) === JSON.stringify(b.results);
console.log('PARITY:', parity ? 'PASS（两版行为一致）' : 'DIVERGE（需人工排查）');
process.exit(parity ? 0 : 2);
