document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const globalQualitySlider = document.getElementById('global-quality');
    const globalQualityValue = document.getElementById('global-quality-value');
    const saveAllBtn = document.getElementById('save-all');
    const resetAllBtn = document.getElementById('reset-all');
    const imagesContainer = document.getElementById('images-container');
    const statusContainer = document.getElementById('status-container');
    const statusFill = document.getElementById('status-fill');
    const statusText = document.getElementById('status-text');

    let images = []; // 存储图片数据
    const MAX_IMAGES = 20; // 最大图片数量

    // 更新全局质量显示
    const updateGlobalQualityDisplay = () => {
        const quality = parseFloat(globalQualitySlider.value);
        globalQualityValue.textContent = `${Math.round(quality * 100)}%`;
    };

    // 初始化全局质量显示
    updateGlobalQualityDisplay();

    // 全局质量滑块事件
    globalQualitySlider.addEventListener('input', () => {
        updateGlobalQualityDisplay();
        applyGlobalQuality();
    });

    // 应用全局质量到所有图片
    const applyGlobalQuality = () => {
        const globalQuality = parseFloat(globalQualitySlider.value);

        images.forEach(image => {
            // 更新单张图片的滑块值
            image.qualitySlider.value = globalQuality;
            // 更新显示
            image.qualityValue.textContent = `${Math.round(globalQuality * 100)}%`;
            // 重新压缩
            compressImage(image);
        });

        // 启用保存按钮
        saveAllBtn.disabled = images.length === 0;
    };

    // 重置所有图片到原始状态
    const resetAllImages = () => {
        images.forEach(image => {
            // 重置为原始图片
            image.preview.src = image.originalSrc;
            image.compressedBlob = null;
            image.compressedDataURL = null;
            image.currentQuality = parseFloat(globalQualitySlider.value);

            // 重置滑块
            image.qualitySlider.value = image.currentQuality;
            image.qualityValue.textContent = `${Math.round(image.currentQuality * 100)}%`;

            // 更新文件大小显示
            image.sizeElement.textContent = formatFileSize(image.originalSize);
        });

        // 重新压缩所有图片
        images.forEach(compressImage);
    };

    // 格式化文件大小
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // 压缩图片
    const compressImage = (imageObj) => {
        const quality = parseFloat(imageObj.qualitySlider.value);
        imageObj.currentQuality = quality;
        imageObj.qualityValue.textContent = `${Math.round(quality * 100)}%`;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 设置canvas尺寸
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = imageObj.img.width;
        let height = imageObj.img.height;

        // 按比例缩放大图
        if (width > height && width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
        } else if (height > maxHeight) {
            width = width * (maxHeight / height);
            height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // 绘制图片到canvas
        ctx.drawImage(imageObj.img, 0, 0, width, height);

        // 获取压缩后的data URL (根据文件类型选择mimeType)
        let mimeType = 'image/jpeg';
        if (imageObj.file.name.toLowerCase().endsWith('.png')) {
            mimeType = 'image/png';
        } else if (imageObj.file.name.toLowerCase().endsWith('.webp')) {
            mimeType = 'image/webp';
        }

        // PNG使用固定质量1.0，其他格式使用设置的质量
        const exportQuality = mimeType === 'image/png' ? 1.0 : quality;
        const dataURL = canvas.toDataURL(mimeType, exportQuality);

        // 更新预览
        imageObj.preview.src = dataURL;

        // 计算压缩后的大小
        const byteString = atob(dataURL.split(',')[1]);
        const compressedSize = byteString.length;

        // 更新文件大小显示
        const originalSize = imageObj.originalSize;
        const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);
        imageObj.sizeElement.innerHTML = `${formatFileSize(compressedSize)} <span style="color: ${savedPercent > 0 ? 'green' : 'red'}; margin-left: 5px;">(${savedPercent > 0 ? '-' : ''}${Math.abs(savedPercent)}%)</span>`;

        // 保存压缩后的数据
        imageObj.compressedDataURL = dataURL;
        imageObj.compressedSize = compressedSize;

        // 转换dataURL为Blob
        imageObj.compressedBlob = dataURLtoBlob(dataURL);
    };

    // dataURL转Blob
    const dataURLtoBlob = (dataurl) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new Blob([u8arr], {type: mime});
    };

    // 处理文件上传
    const handleFiles = (files) => {
        // 限制最大图片数量
        if (images.length + files.length > MAX_IMAGES) {
            alert(`最多只能上传 ${MAX_IMAGES} 张图片！当前已选择 ${images.length} 张，还可添加 ${MAX_IMAGES - images.length} 张。`);
            return;
        }

        // 清空空状态
        if (images.length === 0) {
            imagesContainer.innerHTML = '';
        }

        // 处理每个文件
        Array.from(files).forEach(file => {
            if (!file.type.match('image.*')) {
                alert(`${file.name} 不是有效的图片文件，已跳过`);
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // 创建图片卡片
                    const imageCard = document.createElement('div');
                    imageCard.className = 'image-card';

                    const preview = document.createElement('img');
                    preview.className = 'image-preview';
                    preview.src = e.target.result;

                    const imageInfo = document.createElement('div');
                    imageInfo.className = 'image-info';

                    const imageName = document.createElement('div');
                    imageName.className = 'image-name';
                    imageName.textContent = file.name;

                    const imageMeta = document.createElement('div');
                    imageMeta.className = 'image-meta';

                    const sizeElement = document.createElement('div');
                    sizeElement.innerHTML = formatFileSize(file.size);

                    const typeElement = document.createElement('div');
                    typeElement.textContent = file.type.split('/')[1].toUpperCase();

                    const perImageControl = document.createElement('div');
                    perImageControl.className = 'per-image-control';

                    const qualitySlider = document.createElement('input');
                    qualitySlider.type = 'range';
                    qualitySlider.min = '0.1';
                    qualitySlider.max = '1.0';
                    qualitySlider.step = '0.01';
                    qualitySlider.value = globalQualitySlider.value;
                    qualitySlider.className = 'quality-slider';

                    const qualityValue = document.createElement('span');
                    qualityValue.className = 'quality-value';
                    qualityValue.textContent = `${Math.round(parseFloat(qualitySlider.value) * 100)}%`;

                    // 组装DOM
                    imageMeta.appendChild(sizeElement);
                    imageMeta.appendChild(typeElement);

                    perImageControl.appendChild(qualitySlider);
                    perImageControl.appendChild(qualityValue);

                    imageInfo.appendChild(imageName);
                    imageInfo.appendChild(imageMeta);
                    imageInfo.appendChild(perImageControl);

                    imageCard.appendChild(preview);
                    imageCard.appendChild(imageInfo);

                    imagesContainer.appendChild(imageCard);

                    // 创建图片对象
                    const imageObj = {
                        file,
                        img,
                        preview,
                        originalSrc: e.target.result,
                        originalSize: file.size,
                        currentQuality: parseFloat(qualitySlider.value),
                        qualitySlider,
                        qualityValue,
                        sizeElement,
                        compressedBlob: null,
                        compressedDataURL: null,
                        compressedSize: null,
                        card: imageCard
                    };

                    images.push(imageObj);

                    // 单张图片质量调整
                    qualitySlider.addEventListener('input', () => {
                        imageObj.qualityValue.textContent = `${Math.round(parseFloat(qualitySlider.value) * 100)}%`;
                        compressImage(imageObj);
                    });

                    // 初始压缩
                    compressImage(imageObj);

                    // 更新按钮状态
                    saveAllBtn.disabled = false;
                    resetAllBtn.disabled = false;
                };

                img.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    };

    // 上传区域点击事件
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });

    // 文件输入变化事件
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
            // 重置input，以便可以重复选择相同文件
            e.target.value = '';
        }
    });

    // 拖放事件
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('drag-over');
    }

    function unhighlight() {
        dropArea.classList.remove('drag-over');
    }

    // 处理拖放的文件
    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length) {
            handleFiles(files);
        }
    });

    // 批量保存所有图片
    saveAllBtn.addEventListener('click', () => {
        if (images.length === 0) return;

        statusContainer.style.display = 'block';
        statusText.textContent = '准备打包图片...';
        statusFill.style.width = '5%';

        // 创建ZIP文件
        const zip = new JSZip();
        const imgFolder = zip.folder("compressed_images");
        let processedCount = 0;

        // 添加所有压缩后的图片到ZIP
        images.forEach((image, index) => {
            // 使用原始文件名，但替换扩展名为.jpg（除非是png且质量为1.0）
            let filename = image.file.name;
            const mimeType = image.compressedDataURL.split(';')[0].split(':')[1];

            // 对于JPEG或WEBP，确保使用.jpg或.webp扩展名
            if (mimeType === 'image/jpeg' && !filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
                filename = filename.replace(/\.[^/.]+$/, "") + '.jpg';
            } else if (mimeType === 'image/webp' && !filename.toLowerCase().endsWith('.webp')) {
                filename = filename.replace(/\.[^/.]+$/, "") + '.webp';
            }

            // 添加到zip
            imgFolder.file(filename, image.compressedBlob);

            // 更新进度
            processedCount++;
            const progress = Math.min(95, Math.round((processedCount / images.length) * 100));
            statusFill.style.width = `${progress}%`;
            statusText.textContent = `正在添加图片 ${processedCount}/${images.length}...`;

            // 当所有图片添加完成后生成ZIP
            if (processedCount === images.length) {
                statusText.textContent = '生成ZIP文件中...';
                statusFill.style.width = '95%';

                zip.generateAsync({type: "blob"}, (metadata) => {
                    statusFill.style.width = `${Math.min(99, 95 + metadata.percent * 0.05)}%`;
                })
                .then((content) => {
                    statusFill.style.width = '100%';
                    statusText.textContent = '下载完成！';

                    // 保存ZIP文件
                    saveAs(content, `compressed_images_${new Date().getTime()}.zip`);

                    // 2秒后隐藏状态栏
                    setTimeout(() => {
                        statusContainer.style.display = 'none';
                    }, 2000);
                })
                .catch((err) => {
                    console.error("生成ZIP文件时出错:", err);
                    alert("生成ZIP文件时出错，请重试");
                    statusContainer.style.display = 'none';
                });
            }
        });
    });

    // 重置所有图片
    resetAllBtn.addEventListener('click', () => {
        if (images.length === 0) return;

        if (confirm('确定要重置所有图片到初始状态吗？当前的压缩设置将会丢失。')) {
            resetAllImages();
        }
    });
});
