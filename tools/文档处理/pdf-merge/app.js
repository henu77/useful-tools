(function () {
  'use strict';

  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileList');
  const mergeBtn = document.getElementById('mergeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const addBtn = document.getElementById('addBtn');
  const statusEl = document.getElementById('status');

  const files = [];
  let dragIndex = -1;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function renderList() {
    fileListEl.innerHTML = '';

    if (files.length === 0) {
      fileListEl.innerHTML = '<div class="empty">暂无文件</div>';
      mergeBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    files.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.draggable = true;
      row.dataset.index = String(idx);
      row.innerHTML = `
        <div class="idx">${idx + 1}</div>
        <div>
          <div class="name" title="${f.file.name}">${f.file.name}</div>
          <div class="meta">${formatSize(f.file.size)}</div>
        </div>
        <button class="btn btn-danger" data-remove="${idx}" style="padding:6px 10px;font-size:.8rem;">删除</button>
      `;

      row.addEventListener('dragstart', () => {
        dragIndex = idx;
        row.classList.add('dragging');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        dragIndex = -1;
      });

      row.addEventListener('dragover', e => {
        e.preventDefault();
      });

      row.addEventListener('drop', e => {
        e.preventDefault();
        const to = Number(row.dataset.index);
        if (dragIndex < 0 || dragIndex === to) return;
        const [moved] = files.splice(dragIndex, 1);
        files.splice(to, 0, moved);
        renderList();
        setStatus('已更新文件顺序', 'ok');
      });

      fileListEl.appendChild(row);
    });

    mergeBtn.disabled = files.length < 2;
    clearBtn.disabled = false;
  }

  function addFiles(selected) {
    if (!selected || selected.length === 0) return;

    let added = 0;
    for (const file of selected) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        continue;
      }
      files.push({ file });
      added += 1;
    }

    renderList();

    if (added === 0) {
      setStatus('未检测到有效 PDF 文件', 'err');
      return;
    }

    if (files.length < 2) {
      setStatus('至少需要 2 个 PDF 才能合并', '');
    } else {
      setStatus(`已添加 ${files.length} 个 PDF，可开始合并`, 'ok');
    }
  }

  // 点击上传区域触发文件选择
  dropArea.addEventListener('click', () => fileInput.click());
  addBtn.addEventListener('click', () => fileInput.click());

  // 文件选择变化
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  // 拖拽进入和悬停
  ['dragenter', 'dragover'].forEach(type => {
    dropArea.addEventListener(type, e => {
      e.preventDefault();
      dropArea.classList.add('dragover');
    });
  });

  // 拖拽离开和放下
  ['dragleave', 'drop'].forEach(type => {
    dropArea.addEventListener(type, e => {
      e.preventDefault();
      dropArea.classList.remove('dragover');
    });
  });

  // 拖拽放下文件
  dropArea.addEventListener('drop', e => {
    addFiles(e.dataTransfer.files || []);
  });

  // 删除单个文件
  fileListEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const idx = Number(btn.dataset.remove);
    files.splice(idx, 1);
    renderList();
    setStatus(files.length ? '已移除文件' : '请先添加 PDF 文件', files.length ? 'ok' : '');
  });

  // 清空列表
  clearBtn.addEventListener('click', () => {
    files.length = 0;
    renderList();
    setStatus('已清空文件列表', '');
  });

  // 合并 PDF
  mergeBtn.addEventListener('click', async () => {
    if (files.length < 2) {
      setStatus('至少需要 2 个 PDF 文件', 'err');
      return;
    }

    mergeBtn.disabled = true;
    setStatus('正在合并，请稍候...', '');

    try {
      const outPdf = await PDFLib.PDFDocument.create();

      for (const item of files) {
        const bytes = await item.file.arrayBuffer();
        const inPdf = await PDFLib.PDFDocument.load(bytes);
        const pages = await outPdf.copyPages(inPdf, inPdf.getPageIndices());
        pages.forEach(p => outPdf.addPage(p));
      }

      const mergedBytes = await outPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${Date.now()}.pdf`;
      a.click();

      URL.revokeObjectURL(url);
      setStatus('合并成功，已开始下载', 'ok');
    } catch (err) {
      console.error(err);
      setStatus('合并失败，请检查 PDF 是否损坏或受加密保护', 'err');
    } finally {
      renderList();
    }
  });

  // 初始化渲染
  renderList();
})();
