(function () {
  'use strict';

  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('fileInput');
  const previewArea = document.getElementById('previewArea');
  const statusEl = document.getElementById('status');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const clearBtn = document.getElementById('clearBtn');
  const formatSelect = document.getElementById('formatSelect');
  const scaleSelect = document.getElementById('scaleSelect');

  let pdfDoc = null;
  let pdfFile = null;
  const pageImages = [];

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function showLoading() {
    previewArea.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span>正在解析 PDF...</span>
      </div>
    `;
  }

  function clearAll() {
    pdfDoc = null;
    pdfFile = null;
    pageImages.length = 0;
    previewArea.innerHTML = '';
    setStatus('请选择 PDF 文件');
    exportAllBtn.disabled = true;
  }

  async function loadPDF(file) {
    if (!file) return;

    clearAll();
    pdfFile = file;
    showLoading();

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      setStatus(`已加载 "${file.name}"，共 ${pdfDoc.numPages} 页`);
      await renderAllPages();
      exportAllBtn.disabled = false;
    } catch (err) {
      console.error(err);
      previewArea.innerHTML = '';
      setStatus('加载失败，请确保文件是有效的 PDF');
    }
  }

  async function renderAllPages() {
    previewArea.innerHTML = '';
    pageImages.length = 0;

    const scale = parseFloat(scaleSelect.value);
    const format = formatSelect.value;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'png' ? undefined : 0.92;
      const dataUrl = canvas.toDataURL(mimeType, quality);

      pageImages.push({
        pageNum: i,
        dataUrl: dataUrl,
        format: format
      });

      const item = createPreviewItem(i, canvas, dataUrl, format);
      previewArea.appendChild(item);
    }
  }

  function createPreviewItem(pageNum, canvas, dataUrl, format) {
    const div = document.createElement('div');
    div.className = 'preview-item';

    // 复制 canvas 内容
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    displayCanvas.getContext('2d').drawImage(canvas, 0, 0);

    div.innerHTML = `
      <div class="canvas-wrapper"></div>
      <div class="page-info">
        <span>第 ${pageNum} 页</span>
        <button class="download-btn">下载</button>
      </div>
    `;

    div.querySelector('.canvas-wrapper').appendChild(displayCanvas);

    // 下载按钮
    div.querySelector('.download-btn').addEventListener('click', () => {
      downloadImage(dataUrl, `page_${pageNum}.${format}`);
    });

    // 点击预览大图
    displayCanvas.style.cursor = 'zoom-in';
    displayCanvas.addEventListener('click', () => {
      openModal(dataUrl);
    });

    return div;
  }

  function downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function downloadAll() {
    if (pageImages.length === 0) return;

    pageImages.forEach((img, idx) => {
      setTimeout(() => {
        downloadImage(img.dataUrl, `page_${img.pageNum}.${img.format}`);
      }, idx * 200);
    });
  }

  // 模态框
  function openModal(dataUrl) {
    let modal = document.getElementById('imageModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'imageModal';
      modal.style.cssText = `
        display: none; position: fixed; z-index: 1000; left: 0; top: 0;
        width: 100%; height: 100%; background-color: rgba(0,0,0,0.9);
        align-items: center; justify-content: center; cursor: zoom-out;
      `;
      modal.innerHTML = `
        <img style="max-width: 90%; max-height: 90vh; object-fit: contain;">
      `;
      modal.addEventListener('click', () => modal.style.display = 'none');
      document.body.appendChild(modal);
    }
    modal.querySelector('img').src = dataUrl;
    modal.style.display = 'flex';
  }

  // 事件绑定
  // dropArea 点击触发文件选择
  dropArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      loadPDF(fileInput.files[0]);
    }
    fileInput.value = '';
  });

  // 阻止按钮点击事件冒泡到 dropArea，避免重复触发
  const uploadBtn = document.querySelector('.btn-upload');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', e => e.stopPropagation());
  }

  ['dragenter', 'dragover'].forEach(type => {
    dropArea.addEventListener(type, e => {
      e.preventDefault();
      dropArea.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(type => {
    dropArea.addEventListener(type, e => {
      e.preventDefault();
      dropArea.classList.remove('dragover');
    });
  });

  dropArea.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      loadPDF(files[0]);
    }
  });

  clearBtn.addEventListener('click', clearAll);
  exportAllBtn.addEventListener('click', downloadAll);

  // 格式或缩放变化时重新渲染
  formatSelect.addEventListener('change', () => {
    if (pdfDoc) renderAllPages();
  });

  scaleSelect.addEventListener('change', () => {
    if (pdfDoc) renderAllPages();
  });

})();
