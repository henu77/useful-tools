const fs = require('fs').promises;
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(ROOT_DIR, 'tools');

const RE_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

function isHidden(name) {
  return name.startsWith('.');
}

async function isDirectory(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function validate() {
  const errors = [];
  let checkedTools = 0;

  try {
    await fs.access(TOOLS_DIR);
  } catch {
    errors.push(`找不到 tools 目录: ${TOOLS_DIR}`);
    return { errors, checkedTools };
  }

  const categories = await fs.readdir(TOOLS_DIR);

  for (const categoryName of categories) {
    if (isHidden(categoryName)) continue;

    const categoryPath = path.join(TOOLS_DIR, categoryName);
    if (!(await isDirectory(categoryPath))) continue;

    const toolDirs = await fs.readdir(categoryPath);

    for (const toolName of toolDirs) {
      if (isHidden(toolName)) continue;

      const toolPath = path.join(categoryPath, toolName);
      if (!(await isDirectory(toolPath))) continue;

      checkedTools += 1;

      const indexPath = path.join(toolPath, 'index.html');

      let html = '';
      try {
        html = await fs.readFile(indexPath, 'utf8');
      } catch {
        errors.push(`[缺少 index.html] ${path.relative(ROOT_DIR, toolPath)}`);
        continue;
      }

      const titleMatch = RE_TITLE.exec(html);
      const title = titleMatch ? titleMatch[1].trim() : '';
      if (!title) {
        errors.push(`[缺少或空 title] ${path.relative(ROOT_DIR, indexPath)}`);
      }
    }
  }

  return { errors, checkedTools };
}

validate()
  .then(({ errors, checkedTools }) => {
    if (errors.length > 0) {
      console.error('❌ 工具结构校验失败:');
      for (const err of errors) {
        console.error(`- ${err}`);
      }
      console.error(`\n已检查工具目录: ${checkedTools}`);
      process.exit(1);
    }

    console.log(`✅ 工具结构校验通过，已检查工具目录: ${checkedTools}`);
  })
  .catch(err => {
    console.error('❌ 校验执行异常:', err);
    process.exit(1);
  });
