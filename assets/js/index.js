(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const content = $('content');
  const sidebarNav = $('sidebarNav');
  const searchInput = $('searchInput');
  const headerTitle = $('headerTitle');
  const toolsCount = $('toolsCount');
  const countAll = $('countAll');

  let allData = [];
  let activeCategory = 'all';
  let searchQuery = '';

  async function loadData() {
    try {
      const res = await fetch('data/tools.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      allData = await res.json();
      initSidebar();
    } catch (err) {
      content.innerHTML = `
        <div class="state-msg">
          <div class="state-icon">⚠️</div>
          <p>无法加载 <code>data/tools.json</code>，请先运行 <code>node generate-json.js</code>。</p>
          <p>若在本地文件系统直接打开，请改用本地 HTTP 服务：<code>npx serve .</code></p>
          <p style="margin-top:8px;color:#e53e3e;font-size:.78rem;">${escHtml(err.message)}</p>
        </div>`;
    }
  }

  function initSidebar() {
    const total = allData.reduce((sum, cat) => sum + cat.items.length, 0);
    countAll.textContent = total;

    allData.forEach(cat => {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.category = cat.category;
      el.innerHTML = `<span>📁</span><span>${escHtml(cat.category)}</span>
                      <span class="nav-count">${cat.items.length}</span>`;
      el.addEventListener('click', () => selectCategory(cat.category));
      sidebarNav.appendChild(el);
    });

    render();
  }

  function selectCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.category === cat);
    });
    headerTitle.textContent = cat === 'all' ? '全部工具' : cat;
    searchInput.value = '';
    searchQuery = '';
    render();
  }

  document.querySelector('[data-category="all"]').addEventListener('click', () => {
    selectCategory('all');
  });

  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim().toLowerCase();
    render();
  });

  function render() {
    const kw = searchQuery;

    let cats = activeCategory === 'all'
      ? allData
      : allData.filter(cat => cat.category === activeCategory);

    if (kw) {
      cats = cats
        .map(cat => ({
          ...cat,
          items: cat.items.filter(tool =>
            tool.name.toLowerCase().includes(kw) ||
            tool.desc.toLowerCase().includes(kw)
          )
        }))
        .filter(cat => cat.items.length > 0);
    }

    const total = cats.reduce((sum, cat) => sum + cat.items.length, 0);
    toolsCount.textContent = `共 ${total} 个工具`;

    if (total === 0) {
      content.innerHTML = `
        <div class="state-msg">
          <div class="state-icon">🔍</div>
          <p>没有找到与 "<strong>${escHtml(kw)}</strong>" 相关的工具</p>
        </div>`;
      return;
    }

    content.innerHTML = cats.map(cat => `
      <div class="section">
        <div class="section-title">${escHtml(cat.category)}</div>
        <div class="cards-grid">
          ${cat.items.map(tool => `
            <a class="card" href="${escHtml(tool.path)}" target="_blank" rel="noopener noreferrer">
              <div class="card-icon">${escHtml(tool.icon)}</div>
              <div class="card-name">${hl(tool.name, kw)}</div>
              <div class="card-desc">${hl(tool.desc, kw)}</div>
              <div class="card-open">打开工具 →</div>
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hl(text, kw) {
    if (!kw) return escHtml(text);
    const safe = escHtml(text);
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return safe.replace(re, m => `<mark>${m}</mark>`);
  }

  loadData();
})();
