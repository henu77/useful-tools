import {
  Muxer,
  ArrayBufferTarget
} from "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm";

const IMAGE_DURATION_MS = 500;
const FPS = 30;
const FRAME_DURATION_US = Math.round(1_000_000 / FPS);
const FRAMES_PER_IMAGE = Math.max(1, Math.round((IMAGE_DURATION_MS / 1000) * FPS));

const imageInput = document.getElementById("imageInput");
const dropzone = document.getElementById("dropzone");
const previewGrid = document.getElementById("previewGrid");
const emptyState = document.getElementById("emptyState");
const imageCount = document.getElementById("imageCount");
const timelineHint = document.getElementById("timelineHint");
const clearBtn = document.getElementById("clearBtn");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const progressBlock = document.getElementById("progressBlock");
const progressLabel = document.getElementById("progressLabel");
const progressPercent = document.getElementById("progressPercent");
const progressValue = document.getElementById("progressValue");
const videoPreview = document.getElementById("videoPreview");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const errorText = document.getElementById("errorText");

let frames = [];
let dragId = null;
let outputBlob = null;
let outputUrl = "";

imageInput.addEventListener("change", event => {
  addFiles(event.target.files);
  event.target.value = "";
});

clearBtn.addEventListener("click", clearAll);
generateBtn.addEventListener("click", generateVideo);
downloadBtn.addEventListener("click", downloadVideo);

["dragenter", "dragover"].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add("active");
  });
});

["dragleave", "drop"].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove("active");
  });
});

dropzone.addEventListener("drop", event => {
  addFiles(event.dataTransfer.files);
});

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter(file => file.type.startsWith("image/"));
  if (!files.length) {
    return;
  }

  files.forEach(file => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const objectUrl = URL.createObjectURL(file);
    frames.push({
      id,
      file,
      name: file.name,
      size: file.size,
      url: objectUrl
    });
  });

  resetOutput();
  renderList();
}

function renderList() {
  previewGrid.innerHTML = "";

  if (!frames.length) {
    previewGrid.classList.add("empty");
    previewGrid.appendChild(emptyState);
  } else {
    previewGrid.classList.remove("empty");
    frames.forEach((item, index) => {
      previewGrid.appendChild(createCard(item, index));
    });
  }

  imageCount.textContent = `${frames.length} 张图片`;
  timelineHint.textContent = `预计视频时长 ${(frames.length * IMAGE_DURATION_MS / 1000).toFixed(1)} 秒`;
}

function createCard(item, index) {
  const card = document.createElement("article");
  card.className = "preview-card";
  card.draggable = true;
  card.dataset.id = item.id;

  card.innerHTML = `
    <button type="button" class="remove-btn" data-action="remove" aria-label="删除图片">×</button>
    <div class="thumb-wrap">
      <img src="${item.url}" alt="${escapeHtml(item.name)}" />
    </div>
    <div class="card-body">
      <p class="card-index">第 ${index + 1} 张 · 0.5 秒</p>
      <p class="card-meta">${escapeHtml(item.name)}</p>
      <p class="card-meta">${formatFileSize(item.size)}</p>
    </div>
  `;

  card.addEventListener("click", event => {
    if (event.target.dataset.action === "remove") {
      removeFrame(item.id);
    }
  });

  card.addEventListener("dragstart", () => {
    dragId = item.id;
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    dragId = null;
    card.classList.remove("dragging");
    document.querySelectorAll(".preview-card").forEach(el => el.classList.remove("drag-over"));
  });

  card.addEventListener("dragover", event => {
    event.preventDefault();
  });

  card.addEventListener("dragenter", event => {
    event.preventDefault();
    if (dragId && dragId !== item.id) {
      card.classList.add("drag-over");
    }
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drag-over");
  });

  card.addEventListener("drop", event => {
    event.preventDefault();
    card.classList.remove("drag-over");
    if (!dragId || dragId === item.id) {
      return;
    }

    const fromIndex = frames.findIndex(frame => frame.id === dragId);
    const toIndex = frames.findIndex(frame => frame.id === item.id);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const [moved] = frames.splice(fromIndex, 1);
    frames.splice(toIndex, 0, moved);
    resetOutput();
    renderList();
  });

  return card;
}

function removeFrame(id) {
  const index = frames.findIndex(item => item.id === id);
  if (index === -1) {
    return;
  }

  URL.revokeObjectURL(frames[index].url);
  frames.splice(index, 1);
  resetOutput();
  renderList();
}

function clearAll() {
  frames.forEach(item => URL.revokeObjectURL(item.url));
  frames = [];
  resetOutput();
  renderList();
  setError("");
}

async function generateVideo() {
  if (!frames.length) {
    setError("请先上传至少一张图片。");
    return;
  }

  if (!window.VideoEncoder || !window.VideoFrame) {
    setError("当前浏览器不支持 MP4 编码，请使用较新的 Chrome、Edge 或其他支持 WebCodecs 的浏览器。");
    return;
  }

  setError("");
  toggleBusy(true);
  setProgress(2, "正在读取图片...");

  try {
    const loadedImages = await Promise.all(
      frames.map((frame, index) => loadImage(frame.url, index, frames.length))
    );

    const width = Math.max(...loadedImages.map(item => item.image.naturalWidth || item.image.width));
    const height = Math.max(...loadedImages.map(item => item.image.naturalHeight || item.image.height));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("当前浏览器不支持 Canvas 2D。");
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      fastStart: "in-memory",
      video: {
        codec: "avc",
        width: canvas.width,
        height: canvas.height,
        frameRate: FPS
      }
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: error => {
        throw error;
      }
    });

    const codec = await pickSupportedCodec();
    if (!codec) {
      throw new Error("当前浏览器不支持 H.264 MP4 编码。");
    }

    encoder.configure({
      codec,
      width: canvas.width,
      height: canvas.height,
      bitrate: 6_000_000,
      framerate: FPS,
      avc: { format: "avc" }
    });

    let frameIndex = 0;
    const totalFrames = loadedImages.length * FRAMES_PER_IMAGE;

    for (let i = 0; i < loadedImages.length; i += 1) {
      drawFrame(ctx, canvas.width, canvas.height, loadedImages[i].image);

      for (let repeat = 0; repeat < FRAMES_PER_IMAGE; repeat += 1) {
        const frame = new VideoFrame(canvas, {
          timestamp: frameIndex * FRAME_DURATION_US,
          duration: FRAME_DURATION_US
        });

        encoder.encode(frame, { keyFrame: frameIndex % FPS === 0 });
        frame.close();
        frameIndex += 1;

        setProgress(
          10 + Math.round((frameIndex / totalFrames) * 78),
          `正在编码第 ${i + 1}/${loadedImages.length} 张图片...`
        );
      }
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    outputBlob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    updateVideoPreview(outputBlob);
    setProgress(100, "MP4 生成完成");
    downloadBtn.classList.remove("hidden");
  } catch (error) {
    setError(error.message || "生成失败，请稍后重试。");
    progressBlock.classList.add("hidden");
  } finally {
    toggleBusy(false);
  }
}

function loadImage(url, index, total) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      setProgress(
        4 + Math.round(((index + 1) / total) * 6),
        `已读取 ${index + 1}/${total} 张图片`
      );
      resolve({ image });
    };
    image.onerror = () => reject(new Error("有图片读取失败，请重新上传后重试。"));
    image.src = url;
  });
}

function drawFrame(ctx, width, height, image) {
  ctx.fillStyle = "#120d09";
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

async function pickSupportedCodec() {
  const candidates = [
    "avc1.640028",
    "avc1.4d4028",
    "avc1.42E01E"
  ];

  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: 1280,
        height: 720,
        bitrate: 6_000_000,
        framerate: FPS,
        avc: { format: "avc" }
      });

      if (support.supported) {
        return codec;
      }
    } catch (error) {
      continue;
    }
  }

  return "";
}

function updateVideoPreview(blob) {
  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
  }

  outputUrl = URL.createObjectURL(blob);
  videoPreview.src = outputUrl;
  videoPreview.style.display = "block";
  videoPreview.parentElement.classList.add("ready");
  videoPlaceholder.style.display = "none";
}

function downloadVideo() {
  if (!outputBlob || !outputUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = outputUrl;
  link.download = `image-sequence-${Date.now()}.mp4`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resetOutput() {
  outputBlob = null;
  downloadBtn.classList.add("hidden");
  progressBlock.classList.add("hidden");
  progressValue.style.width = "0%";
  progressPercent.textContent = "0%";
  progressLabel.textContent = "准备中...";
  videoPreview.removeAttribute("src");
  videoPreview.load();
  videoPreview.style.display = "none";
  videoPreview.parentElement.classList.remove("ready");
  videoPlaceholder.style.display = "grid";

  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = "";
  }
}

function toggleBusy(isBusy) {
  generateBtn.disabled = isBusy;
  clearBtn.disabled = isBusy;
  imageInput.disabled = isBusy;
  dropzone.style.pointerEvents = isBusy ? "none" : "auto";
}

function setProgress(percent, label) {
  progressBlock.classList.remove("hidden");
  progressValue.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressLabel.textContent = label;
}

function setError(message) {
  errorText.textContent = message;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

renderList();
