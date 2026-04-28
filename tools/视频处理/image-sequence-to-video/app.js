import {
  Muxer,
  ArrayBufferTarget
} from "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm";

const DEFAULT_IMAGE_DURATION_SECONDS = 0.5;
const DEFAULT_FPS = 30;
const MIN_IMAGE_DURATION_SECONDS = 0.1;
const MAX_IMAGE_DURATION_SECONDS = 10;
const MIN_FPS = 1;
const MAX_FPS = 60;
const MIN_BITRATE = 20_000_000;
const MAX_BITRATE = 80_000_000;
const MAX_CODED_AREA = 2_097_152;

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
const fpsInput = document.getElementById("fpsInput");
const durationInput = document.getElementById("durationInput");
const fpsSummary = document.getElementById("fpsSummary");
const durationSummary = document.getElementById("durationSummary");
const durationStat = document.getElementById("durationStat");

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
fpsInput.addEventListener("input", handleConfigChange);
durationInput.addEventListener("input", handleConfigChange);
fpsInput.addEventListener("blur", normalizeConfigInputs);
durationInput.addEventListener("blur", normalizeConfigInputs);

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
  const settings = getVideoSettings();
  previewGrid.innerHTML = "";

  if (!frames.length) {
    previewGrid.classList.add("empty");
    previewGrid.appendChild(emptyState);
  } else {
    previewGrid.classList.remove("empty");
    frames.forEach((item, index) => {
      previewGrid.appendChild(createCard(item, index, settings));
    });
  }

  imageCount.textContent = `${frames.length} 张图片`;
  timelineHint.textContent = `预计视频时长 ${formatSeconds(frames.length * settings.imageDurationSeconds)} 秒`;
  fpsSummary.textContent = `${settings.fps} FPS`;
  durationSummary.textContent = `${formatSeconds(settings.imageDurationSeconds)} 秒`;
  durationStat.textContent = `${formatSeconds(settings.imageDurationSeconds)}s`;
}

function createCard(item, index, settings) {
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
      <p class="card-index">第 ${index + 1} 张 · ${formatSeconds(settings.imageDurationSeconds)} 秒</p>
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

function handleConfigChange() {
  updateConfigInputs(false);
  resetOutput();
  renderList();
}

function normalizeConfigInputs() {
  updateConfigInputs(true);
  resetOutput();
  renderList();
}

function updateConfigInputs(forceNormalize) {
  const fps = clampNumber(
    Number.parseInt(fpsInput.value, 10) || DEFAULT_FPS,
    MIN_FPS,
    MAX_FPS
  );
  const duration = clampNumber(
    Number.parseFloat(durationInput.value) || DEFAULT_IMAGE_DURATION_SECONDS,
    MIN_IMAGE_DURATION_SECONDS,
    MAX_IMAGE_DURATION_SECONDS
  );

  if (forceNormalize || isValidNumberInput(fpsInput.value, MIN_FPS, MAX_FPS, true)) {
    fpsInput.value = String(Math.round(fps));
  }

  if (forceNormalize || isValidNumberInput(durationInput.value, MIN_IMAGE_DURATION_SECONDS, MAX_IMAGE_DURATION_SECONDS, false)) {
    durationInput.value = formatSeconds(duration);
  }
}

function isValidNumberInput(value, min, max, integerOnly) {
  if (!value.trim()) {
    return false;
  }

  const parsed = integerOnly ? Number.parseInt(value, 10) : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function getVideoSettings() {
  const fps = clampNumber(
    Number.parseInt(fpsInput.value, 10) || DEFAULT_FPS,
    MIN_FPS,
    MAX_FPS
  );
  const imageDurationSeconds = clampNumber(
    Number.parseFloat(durationInput.value) || DEFAULT_IMAGE_DURATION_SECONDS,
    MIN_IMAGE_DURATION_SECONDS,
    MAX_IMAGE_DURATION_SECONDS
  );
  const imageDurationUs = Math.round(imageDurationSeconds * 1_000_000);
  const framesPerImage = Math.max(1, Math.round(imageDurationSeconds * fps));

  return {
    fps,
    imageDurationSeconds,
    imageDurationUs,
    framesPerImage
  };
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

  const settings = getVideoSettings();

  setError("");
  toggleBusy(true);
  setProgress(2, "正在读取图片...");

  try {
    const loadedImages = await Promise.all(
      frames.map((frame, index) => loadImage(frame.url, index, frames.length))
    );

    const width = Math.max(...loadedImages.map(item => item.image.naturalWidth || item.image.width));
    const height = Math.max(...loadedImages.map(item => item.image.naturalHeight || item.image.height));
    const outputSize = getOutputSize(width, height);

    const canvas = document.createElement("canvas");
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
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
        frameRate: settings.fps
      }
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: error => {
        throw error;
      }
    });

    const bitrate = getHighQualityBitrate(canvas.width, canvas.height, settings.fps);
    const codec = await pickSupportedCodec(canvas.width, canvas.height, bitrate, settings.fps);
    if (!codec) {
      throw new Error("当前浏览器不支持当前分辨率的 H.264 MP4 编码，请尝试更小的图片尺寸。");
    }

    if (outputSize.scaled) {
      setProgress(
        8,
        `图片过大，已自动缩放输出为 ${canvas.width}×${canvas.height} 以适配 H.264 编码`
      );
    }

    encoder.configure({
      codec,
      width: canvas.width,
      height: canvas.height,
      bitrate,
      framerate: settings.fps,
      avc: { format: "avc" }
    });

    setProgress(
      10,
      `开始高画质编码，目标码率 ${formatBitrate(bitrate)}，${settings.fps} FPS / ${formatSeconds(settings.imageDurationSeconds)} 秒每张`
    );

    let frameIndex = 0;
    let timestampUs = 0;
    const totalFrames = loadedImages.length * settings.framesPerImage;

    for (let i = 0; i < loadedImages.length; i += 1) {
      drawFrame(ctx, canvas.width, canvas.height, loadedImages[i].image);
      const frameDurations = splitDuration(settings.imageDurationUs, settings.framesPerImage);

      for (let repeat = 0; repeat < settings.framesPerImage; repeat += 1) {
        const frameDurationUs = frameDurations[repeat];
        const frame = new VideoFrame(canvas, {
          timestamp: timestampUs,
          duration: frameDurationUs
        });

        encoder.encode(frame, { keyFrame: frameIndex % settings.fps === 0 });
        frame.close();
        timestampUs += frameDurationUs;
        frameIndex += 1;

        setProgress(
          10 + Math.round((frameIndex / totalFrames) * 78),
          `正在高画质编码第 ${i + 1}/${loadedImages.length} 张图片...`
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

function splitDuration(totalDurationUs, parts) {
  const baseDuration = Math.floor(totalDurationUs / parts);
  const remainder = totalDurationUs % parts;

  return Array.from({ length: parts }, (_, index) => baseDuration + (index < remainder ? 1 : 0));
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

async function pickSupportedCodec(width, height, bitrate, fps) {
  const candidates = [
    "avc1.640034",
    "avc1.640033",
    "avc1.640032",
    "avc1.640028",
    "avc1.4d4028",
    "avc1.42E01E"
  ];

  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
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

function getOutputSize(width, height) {
  const safeWidth = toEvenSize(width);
  const safeHeight = toEvenSize(height);

  if (safeWidth * safeHeight <= MAX_CODED_AREA) {
    return {
      width: safeWidth,
      height: safeHeight,
      scaled: false
    };
  }

  const scale = Math.sqrt(MAX_CODED_AREA / (safeWidth * safeHeight));
  const scaledWidth = toEvenSize(Math.max(2, Math.floor(safeWidth * scale)));
  const scaledHeight = toEvenSize(Math.max(2, Math.floor(safeHeight * scale)));

  return {
    width: scaledWidth,
    height: scaledHeight,
    scaled: true
  };
}

function getHighQualityBitrate(width, height, fps) {
  const pixelsPerFrame = width * height;
  const bitsPerPixel = 0.22;
  const estimated = Math.round(pixelsPerFrame * fps * bitsPerPixel);
  return clampNumber(estimated, MIN_BITRATE, MAX_BITRATE);
}

function formatBitrate(bitrate) {
  return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toEvenSize(value) {
  return value % 2 === 0 ? value : value + 1;
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
  fpsInput.disabled = isBusy;
  durationInput.disabled = isBusy;
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

function formatSeconds(value) {
  return trimTrailingZeros(value.toFixed(value < 1 ? 2 : 1));
}

function trimTrailingZeros(value) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

updateConfigInputs(true);
renderList();
