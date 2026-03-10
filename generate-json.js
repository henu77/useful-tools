/**
 * generate-json.js
 * 自动扫描 tools/ 目录，提取各工具页面的元信息，
 * 并生成供前端调用的 data/tools.json 配置文件。
 *
 * 使用方法：node generate-json.js
 */

const fs = require('fs').promises;
const path = require('path');

// ── 路径配置 ────────────────────────────────────────────────────────────────
const ROOT_DIR   = __dirname;                          // 项目根目录
const TOOLS_DIR  = path.join(ROOT_DIR, 'tools');       // 工具源目录
const DATA_DIR   = path.join(ROOT_DIR, 'data');        // 输出目录
const OUTPUT_FILE = path.join(DATA_DIR, 'tools.json'); // 输出文件

// ── 正则表达式 ───────────────────────────────────────────────────────────────
// 匹配 <title>...</title>，支持标签跨行、属性及空白字符
const RE_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
// 匹配 <meta name="description" content="...">，属性顺序不固定
const RE_DESC  = /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["'][^>]*>/i;
// 同上，补充 content 在 name 前面的写法
const RE_DESC2 = /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']description["'][^>]*>/i;
// 匹配 <meta name="icon" content="...">
const RE_ICON  = /<meta[^>]+name\s*=\s*["']icon["'][^>]+content\s*=\s*["']([^"']*)["'][^>]*>/i;
// 同上，content 在 name 前面
const RE_ICON2 = /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']icon["'][^>]*>/i;

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 判断路径是否为目录
 * @param {string} p 绝对路径
 * @returns {Promise<boolean>}
 */
async function isDirectory(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 从 HTML 字符串中提取元信息
 * @param {string} html       HTML 文件内容
 * @param {string} folderName 工具文件夹名（作为 name 的兜底值）
 * @returns {{ name: string, desc: string, icon: string }}
 */
function extractMeta(html, folderName) {
  // 提取工具名称
  const titleMatch = RE_TITLE.exec(html);
  const name = titleMatch ? titleMatch[1].trim() : folderName;

  // 提取描述（兼容两种属性顺序）
  const descMatch = RE_DESC.exec(html) || RE_DESC2.exec(html);
  const desc = descMatch ? descMatch[1].trim() : '暂无描述';

  // 提取图标（兼容两种属性顺序）
  const iconMatch = RE_ICON.exec(html) || RE_ICON2.exec(html);
  const icon = iconMatch ? iconMatch[1].trim() : '🔧';

  return { name, desc, icon };
}

/**
 * 过滤系统隐藏条目（以 . 开头，如 .DS_Store、.git 等）
 * @param {string} name 文件/文件夹名
 * @returns {boolean}
 */
function isHidden(name) {
  return name.startsWith('.');
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('========================================');
  console.log('  🚀 开始生成 tools.json …');
  console.log('========================================\n');

  // 确保 tools/ 目录存在
  try {
    await fs.access(TOOLS_DIR);
  } catch {
    console.error(`❌ 找不到工具目录：${TOOLS_DIR}`);
    console.error('   请确认 tools/ 文件夹与脚本位于同一根目录下。');
    process.exit(1);
  }

  // 读取第一层（分类目录）
  const categoryEntries = await fs.readdir(TOOLS_DIR);

  let totalCategories = 0;
  let totalTools = 0;
  const result = [];

  for (const categoryName of categoryEntries) {
    // 忽略隐藏文件
    if (isHidden(categoryName)) continue;

    const categoryPath = path.join(TOOLS_DIR, categoryName);

    // 忽略非目录
    if (!(await isDirectory(categoryPath))) continue;

    // 读取第二层（工具目录）
    const toolEntries = await fs.readdir(categoryPath);
    const items = [];

    for (const toolName of toolEntries) {
      // 忽略隐藏文件
      if (isHidden(toolName)) continue;

      const toolPath = path.join(categoryPath, toolName);

      // 忽略非目录
      if (!(await isDirectory(toolPath))) continue;

      const indexPath = path.join(toolPath, 'index.html');

      // 忽略没有 index.html 的工具目录
      try {
        await fs.access(indexPath);
      } catch {
        console.warn(`  ⚠️  跳过（无 index.html）：${categoryName}/${toolName}`);
        continue;
      }

      // 读取 HTML 并提取元信息
      let html = '';
      try {
        html = await fs.readFile(indexPath, 'utf-8');
      } catch (err) {
        console.warn(`  ⚠️  读取失败，跳过：${categoryName}/${toolName} — ${err.message}`);
        continue;
      }

      const { name, desc, icon } = extractMeta(html, toolName);

      // 生成相对访问路径（统一使用正斜杠，兼容 Web）
      const toolRelPath = `tools/${categoryName}/${toolName}/index.html`;

      items.push({ name, icon, desc, path: toolRelPath });

      console.log(`  ✅ [${categoryName}] ${name}  ${icon}`);
      totalTools++;
    }

    // 忽略空分类（下面没有合法工具的目录）
    if (items.length === 0) {
      console.log(`  ℹ️  分类"${categoryName}"下暂无有效工具，已跳过。`);
      continue;
    }

    result.push({ category: categoryName, items });
    totalCategories++;
  }

  // 确保输出目录存在（不存在则递归创建）
  await fs.mkdir(DATA_DIR, { recursive: true });

  // 写入 JSON 文件（格式化输出，方便人工查阅）
  const jsonContent = JSON.stringify(result, null, 2);
  await fs.writeFile(OUTPUT_FILE, jsonContent, 'utf-8');

  console.log('\n========================================');
  console.log(`  📂 分类数量：${totalCategories}`);
  console.log(`  🔨 工具数量：${totalTools}`);
  console.log(`  💾 已写入：${OUTPUT_FILE}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('\n❌ 脚本执行出错：', err);
  process.exit(1);
});
