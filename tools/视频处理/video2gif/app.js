function initDragDrop(dropArea, fileInput, onFileSelected, accept) {
  function acceptFile(file) {
    if (!file) return false;
    if (!accept || accept === "*/*") return true;
    if (accept.endsWith("/*")) return file.type.startsWith(accept.replace("*", ""));
    if (accept.startsWith(".")) return file.name.toLowerCase().endsWith(accept.toLowerCase());
    return file.type === accept;
  }

  function handleFile(file) {
    if (!acceptFile(file)) return;
    onFileSelected(file);
  }

  dropArea.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

  ["dragenter", "dragover"].forEach(eventName => {
    dropArea.addEventListener(eventName, e => {
      e.preventDefault();
      dropArea.classList.add("highlight");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropArea.addEventListener(eventName, e => {
      e.preventDefault();
      dropArea.classList.remove("highlight");
    });
  });

  dropArea.addEventListener("drop", e => {
    const file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
    handleFile(file);
  });
}

// 元素引用
const videoFileInput = document.getElementById("videoFile");
const videoPreview = document.getElementById("videoPreview");
const startTimeInput = document.getElementById("startTime");
const durationInput = document.getElementById("duration");
const fpsInput = document.getElementById("fps");
const qualityInput = document.getElementById("quality");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const convertBtn = document.getElementById("convertBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const gifPreview = document.getElementById("gifPreview");
const downloadBtn = document.getElementById("downloadBtn");
const errorText = document.getElementById("errorText");
const dropArea = document.getElementById("drop-area");

// 创建画布和上下文
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

// 保存上传文件的原始文件名
let originalFileName = "";

// 使用通用拖拽功能初始化
initDragDrop(dropArea, videoFileInput, handleFiles, "video/*");

// 处理文件选择
function handleFiles(file) {
  const videoURL = URL.createObjectURL(file);
  videoPreview.src = videoURL;
  // 保存原始文件名（去除扩展名）
  originalFileName = file.name.replace(/\.[^/.]+$/, "");
}

// 转换按钮处理
convertBtn.addEventListener("click", async () => {
  if (!videoPreview.src) {
    errorText.textContent = "请先选择一个视频文件";
    return;
  }

  const startTime = parseFloat(startTimeInput.value) || 0;
  const duration = parseFloat(durationInput.value) || 3;
  const fps = parseInt(fpsInput.value) || 10;
  const quality = parseInt(qualityInput.value) || 80;
  const width = parseInt(widthInput.value) || 320;
  const height = parseInt(heightInput.value) || 240;

  // 保存原来的onseeked处理器
  const originalOnseeked = videoPreview.onseeked;

  convertBtn.disabled = true;
  errorText.textContent = "";
  progressContainer.style.display = "block";
  statusText.textContent = "处理视频中...";

  try {
    // 设置视频和画布尺寸
    canvas.width = width;
    canvas.height = height;

    // 计算帧数和帧间隔
    const totalFrames = Math.ceil(duration * fps);
    const frameInterval = 1 / fps;
    let framesProcessed = 0;

    // 确保视频已加载并设置到正确的位置
    videoPreview.currentTime = startTime;
    await new Promise((resolve) => {
      videoPreview.onseeked = resolve;
    });

    // 收集帧数据
    const frames = [];

    // 获取视频帧
    async function captureFrames() {
      for (let i = 0; i < totalFrames; i++) {
        if (videoPreview.currentTime >= startTime + duration) {
          break;
        }

        // 绘制当前帧到画布
        ctx.drawImage(videoPreview, 0, 0, width, height);

        // 保存当前帧
        frames.push(canvas.toDataURL("image/png"));

        // 更新进度
        framesProcessed++;
        progressBar.value = (framesProcessed / totalFrames) * 100;
        statusText.textContent = `添加帧 ${framesProcessed}/${totalFrames}`;

        // 移动到下一帧
        videoPreview.currentTime += frameInterval;

        // 等待视频移动到新位置
        await new Promise((resolve) => {
          videoPreview.onseeked = resolve;
        });
      }

      // 使用gifshot生成GIF
      statusText.textContent = "正在生成GIF...";

      gifshot.createGIF(
        {
          images: frames,
          gifWidth: width,
          gifHeight: height,
          interval: 1 / fps,
          quality: quality / 100,
          progressCallback: function (progress) {
            progressBar.value = progress * 100;
            statusText.textContent = `渲染GIF: ${Math.round(
              progress * 100
            )}%`;
          },
        },
        function (obj) {
          if (!obj.error) {
            const gifUrl = obj.image;
            gifPreview.src = gifUrl;
            downloadBtn.style.display = "block";
            statusText.textContent = "转换完成!";
            convertBtn.disabled = false;
            // 恢复原来的onseeked处理器
            videoPreview.onseeked = originalOnseeked;
          } else {
            errorText.textContent = "转换失败: " + obj.error;
            convertBtn.disabled = false;
            videoPreview.onseeked = originalOnseeked;
            console.error(obj.error);
          }
        }
      );
    }

    captureFrames();
  } catch (error) {
    errorText.textContent = "转换失败: " + error.message;
    convertBtn.disabled = false;
    // 恢复原来的onseeked处理器
    videoPreview.onseeked = originalOnseeked;
    console.error(error);
  }
});

// 下载按钮处理
downloadBtn.addEventListener("click", () => {
  if (gifPreview.src) {
    const a = document.createElement("a");
    a.href = gifPreview.src;
    // 使用原始文件名，如果没有则使用默认名称
    const fileName = originalFileName ?
      `${originalFileName}.gif` :
      `video-to-gif-${new Date().getTime()}.gif`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});


// 在视频加载完成后更新尺寸信息
videoPreview.onloadedmetadata = () => {
  durationInput.value = Math.min(5, videoPreview.duration);
  widthInput.value = videoPreview.videoWidth;
  heightInput.value = videoPreview.videoHeight;
};
