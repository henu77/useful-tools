let originalPdfBuffer = null; // 始终保存一份"纯净无水印"的原始文件缓冲
let currentPdfBytes = null;   // 保存当前带有水印的最新文件缓冲
let activeBlobUrl = null;     // 用于释放内存

// 工具函数：File 转 ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// 核心绘图：带高清缩放的文本转图像
function createTextWatermarkImage(text, color, fontSize) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 视网膜高清倍率（设为 2 倍，让 PDF 里的图片极度清晰）
  const scale = 2;
  const renderSize = fontSize * scale;

  ctx.font = `bold ${renderSize}px sans-serif`;
  const textMetrics = ctx.measureText(text);
  const width = textMetrics.width;
  const height = renderSize * 1.5;

  canvas.width = width;
  canvas.height = height;

  ctx.font = `bold ${renderSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  return {
    base64: canvas.toDataURL('image/png'),
    // 返回真实在 PDF 中应该显示的物理尺寸
    width: width / scale,
    height: height / scale
  };
}

// 主生成逻辑
async function generateWatermark() {
  if (!originalPdfBuffer) return;

  document.getElementById('loadingState').style.display = 'block';

  try {
    // 获取当前所有表单的值
    const text = document.getElementById('watermarkText').value;
    const colorHex = document.getElementById('watermarkColor').value;
    const fontSize = parseInt(document.getElementById('watermarkSize').value);
    const opacity = parseFloat(document.getElementById('watermarkOpacity').value);
    const angle = parseInt(document.getElementById('watermarkAngle').value);
    const spacing = parseInt(document.getElementById('watermarkDensity').value);

    // 每次都从【最原始的无水印 PDF】重新加载，防止水印叠加黑屏
    const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBuffer);

    if (text.trim() !== '') {
      // 生成高清水印图片及物理尺寸
      const watermarkData = createTextWatermarkImage(text, colorHex, fontSize);
      const watermarkImage = await pdfDoc.embedPng(watermarkData.base64);

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        const diagonal = Math.sqrt(width * width + height * height);

        for (let x = -diagonal; x < diagonal; x += spacing) {
          for (let y = -diagonal; y < diagonal; y += spacing) {
            page.drawImage(watermarkImage, {
              x: x,
              y: y,
              width: watermarkData.width,
              height: watermarkData.height,
              opacity: opacity,
              rotate: PDFLib.degrees(angle),
            });
          }
        }
      }
    }

    currentPdfBytes = await pdfDoc.save();

    // 清理旧的 Blob URL 释放内存
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }

    // 渲染新预览
    const blob = new Blob([currentPdfBytes], { type: 'application/pdf' });
    activeBlobUrl = URL.createObjectURL(blob);
    document.getElementById('pdfPreview').src = activeBlobUrl;

  } catch (error) {
    console.error(error);
  } finally {
    document.getElementById('loadingState').style.display = 'none';
  }
}

// 防抖函数：延迟执行，避免频繁触发卡顿
function debounce(func, wait) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), wait);
  };
}

// 绑定防抖版本的生成函数，延迟 300ms
const debouncedGenerate = debounce(generateWatermark, 300);

// 监听所有输入控件的变动
const inputs = [
  'watermarkText', 'watermarkColor', 'watermarkSize',
  'watermarkOpacity', 'watermarkAngle', 'watermarkDensity'
];

inputs.forEach(id => {
  const element = document.getElementById(id);
  element.addEventListener('input', (e) => {
    // 如果是滑动条，实时更新旁边的数值显示
    if (e.target.type === 'range') {
      const suffix = id === 'watermarkAngle' ? '°' : '';
      document.getElementById(id + 'Val').innerText = e.target.value + suffix;
    }
    // 触发重新生成
    debouncedGenerate();
  });
});

// 处理文件上传
document.getElementById('pdfFile').addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (file) {
    // 1. 读取原始文件并保存在内存中
    originalPdfBuffer = await readFileAsArrayBuffer(file);

    // 2. 界面状态更新
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('controls').style.opacity = '1';
    document.getElementById('controls').style.pointerEvents = 'auto';
    document.getElementById('downloadBtn').disabled = false;

    // 3. 立即触发第一次渲染
    generateWatermark();
  }
});

// 处理下载
function downloadPDF() {
  if (!currentPdfBytes) return;
  const blob = new Blob([currentPdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'watermarked_document.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
