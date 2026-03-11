let imagesData = [];
const previewList = document.getElementById('previewList');
const statusText = document.getElementById('status');
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');

// 拖拽相关变量
let dragSrcEl = null;

// 1. 文件上传
document.getElementById('imageInput').addEventListener('change', function (e) {
  handleFiles(e.target.files);
  this.value = '';
});

function handleFiles(files) {
  if (!files.length) return;
  const total = files.length;
  let loaded = 0;

  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgObj = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        src: e.target.result,
        rotation: 0
      };
      imagesData.push(imgObj);
      renderPreviewItem(imgObj);
      loaded++;
      if (loaded === total) updatePageNumbers();
    };
    reader.readAsDataURL(file);
  });
}

// 2. 渲染卡片 (绑定拖拽)
function renderPreviewItem(imgData) {
  const div = document.createElement('div');
  div.className = 'preview-item';
  // 关键：整个 DIV 都可以拖拽
  div.draggable = true;
  div.dataset.id = imgData.id;

  div.innerHTML = `
            <div class="canvas-wrapper">
                <img src="${imgData.src}" class="preview-canvas" id="img-${imgData.id}"
                     style="transform: rotate(${imgData.rotation}deg);"
                     onclick="openModal('${imgData.id}')">
            </div>
            <span class="page-number"></span>
            <button class="tool-btn rotate-btn" onmousedown="event.stopPropagation()" onclick="rotateImage('${imgData.id}')" title="旋转">⟳</button>
            <button class="tool-btn delete-btn" onmousedown="event.stopPropagation()" onclick="removeImage('${imgData.id}')" title="删除">×</button>
        `;

  addDragEvents(div);
  previewList.appendChild(div);
}

// 3. 修复后的拖拽逻辑
function addDragEvents(item) {
  item.addEventListener('dragstart', function (e) {
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // 必须设置 dataTransfer，否则 Firefox 无法拖拽
    e.dataTransfer.setData('text/html', this.innerHTML);
  });

  item.addEventListener('dragenter', function (e) {
    // 添加视觉反馈
    if (this !== dragSrcEl) {
      this.classList.add('drag-over');
    }
  });

  item.addEventListener('dragleave', function (e) {
    this.classList.remove('drag-over');
  });

  item.addEventListener('dragover', function (e) {
    // 必须阻止默认事件，允许 Drop
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  });

  item.addEventListener('drop', function (e) {
    if (e.stopPropagation) e.stopPropagation();

    // 移除视觉样式
    this.classList.remove('drag-over');

    if (dragSrcEl !== this) {
      // DOM 交换位置
      const allItems = [...previewList.children];
      const srcIndex = allItems.indexOf(dragSrcEl);
      const targetIndex = allItems.indexOf(this);

      if (srcIndex < targetIndex) {
        // 向后拖：插在目标后面
        previewList.insertBefore(dragSrcEl, this.nextSibling);
      } else {
        // 向前拖：插在目标前面
        previewList.insertBefore(dragSrcEl, this);
      }

      // 拖拽完成后立即更新数据顺序
      syncArrayOrder();
      updatePageNumbers();
    }
    return false;
  });

  item.addEventListener('dragend', function () {
    this.classList.remove('dragging');
    // 清理所有 hover 样式，防止残留
    document.querySelectorAll('.preview-item').forEach(el => el.classList.remove('drag-over'));
  });
}

// 4. 数据同步与工具函数
function syncArrayOrder() {
  const newOrderIds = Array.from(previewList.children).map(el => el.dataset.id);
  const newImagesData = [];
  newOrderIds.forEach(id => {
    const img = imagesData.find(item => item.id == id);
    if (img) newImagesData.push(img);
  });
  imagesData = newImagesData;
}

function updatePageNumbers() {
  const items = document.querySelectorAll('.preview-item');
  items.forEach((item, index) => {
    item.querySelector('.page-number').innerText = `第 ${index + 1} 页`;
  });
  statusText.innerText = `当前共 ${imagesData.length} 页`;
}

window.rotateImage = function (id) {
  const imgObj = imagesData.find(img => img.id === id);
  if (imgObj) {
    imgObj.rotation = (imgObj.rotation + 90) % 360;
    const imgEl = document.getElementById(`img-${id}`);
    if (imgEl) imgEl.style.transform = `rotate(${imgObj.rotation}deg)`;
  }
};

window.removeImage = function (id) {
  imagesData = imagesData.filter(img => img.id != id);
  const el = document.querySelector(`.preview-item[data-id="${id}"]`);
  if (el) el.remove();
  updatePageNumbers();
};

window.clearAll = function () {
  imagesData = [];
  previewList.innerHTML = '';
  updatePageNumbers();
};

// 5. 模态框逻辑
window.openModal = function (id) {
  const imgObj = imagesData.find(img => img.id === id);
  if (imgObj) {
    modalImg.src = imgObj.src;
    modalImg.style.transform = `rotate(${imgObj.rotation}deg)`;
    modal.classList.add('active');
  }
};
window.closeModal = function () { modal.classList.remove('active'); };

// 6. PDF 生成 (带旋转处理)
function getRotatedImageDataUrl(imgObj) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (imgObj.rotation === 0) {
        resolve({ url: imgObj.src, width: img.width, height: img.height });
        return;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rads = imgObj.rotation * Math.PI / 180;
      const sin = Math.abs(Math.sin(rads));
      const cos = Math.abs(Math.cos(rads));
      canvas.width = img.width * cos + img.height * sin;
      canvas.height = img.width * sin + img.height * cos;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rads);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve({ url: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height });
    };
    img.src = imgObj.src;
  });
}

async function generatePDF() {
  if (!imagesData.length) return alert('请先添加图片');
  const btn = document.getElementById('generateBtn');
  const oldText = btn.innerText;
  btn.disabled = true; btn.innerText = '生成中...';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const a4W = 210, a4H = 297;

    for (let i = 0; i < imagesData.length; i++) {
      if (i > 0) doc.addPage();
      const data = await getRotatedImageDataUrl(imagesData[i]);
      const ratio = data.width / data.height;
      const pageRatio = a4W / a4H;
      let w, h;
      if (ratio > pageRatio) { w = a4W; h = w / ratio; }
      else { h = a4H; w = h * ratio; }
      doc.addImage(data.url, 'JPEG', (a4W - w) / 2, (a4H - h) / 2, w, h);
    }
    doc.save(`PDF_${Date.now()}.pdf`);
  } catch (e) {
    console.error(e);
    alert('生成失败');
  } finally {
    btn.disabled = false; btn.innerText = oldText;
  }
}
