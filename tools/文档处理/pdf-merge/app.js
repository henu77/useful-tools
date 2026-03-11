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

  // 渲染 PDF 第一页预览
  async function renderPDFPreview(file, canvasEl) {
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);

      const scale = 0.5;
      const viewport = page.getViewport({ scale });

      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
    } catch (err) {
      console.error('预览渲染失败:', err);
      canvasEl.parentElement.innerHTML = '<div class="no-preview">预览<br>失败</div>';
    }
  }

  function renderList() {
    fileListEl.innerHTML = '';

    if (files.length === 0) {
      fileListEl.innerHTML = '<div class="empty">暂无文件，请添加 PDF 文件</div>';
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
        <div class="preview-box">
          <canvas id="preview-${idx}"></canvas>
        </div>
        <div class="file-info">
          <div class="name" title="${f.file.name}">
            <span class="idx">${idx + 1}</span>
            ${f.file.name}
          </div>
          <div class="meta">${formatSize(f.file.size)}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" data-preview="${idx}" title="预览">👁️</button>
          <button class="btn btn-danger" data-remove="${idx}" title="删除">删除</button>
        </div>
      `;

      // 渲染预览
      const canvas = row.querySelector(`#preview-${idx}`);
      renderPDFPreview(f.file, canvas);

      // 拖拽事件
      row.addEventListener('dragstart', () => {
        dragIndex = idx;
        row.classList.add('dragging');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        document.querySelectorAll('.item').forEach(el => el.classList.remove('drag-over'));
        dragIndex = -1;
      });

      row.addEventListener('dragover', e => {
        e.preventDefault();
      });

      row.addEventListener('dragenter', e => {
        e.preventDefault();
        if (dragIndex !== idx) {
          row.classList.add('drag-over');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });

      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
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

  // 模态框预览
  function openPreviewModal(idx) {
    const f = files[idx];
    if (!f) return;

    let modal = document.getElementById('previewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'previewModal';
      modal.className = 'modal';
      modal.innerHTML = '<img id="modalImg">';
      modal.addEventListener('click', () => modal.classList.remove('active'));
      document.body.appendChild(modal);
    }

    // 渲染大图
    const img = document.getElementById('modalImg');
    renderPDFPreviewLarge(f.file).then(dataUrl => {
      img.src = dataUrl;
      modal.classList.add('active');
    });
  }

  async function renderPDFPreviewLarge(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/png');
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

  // 列表点击事件（删除和预览）
  fileListEl.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      const idx = Number(removeBtn.dataset.remove);
      files.splice(idx, 1);
      renderList();
      setStatus(files.length ? '已移除文件' : '请先添加 PDF 文件', files.length ? 'ok' : '');
      return;
    }

    const previewBtn = e.target.closest('[data-preview]');
    if (previewBtn) {
      const idx = Number(previewBtn.dataset.preview);
      openPreviewModal(idx);
    }
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
