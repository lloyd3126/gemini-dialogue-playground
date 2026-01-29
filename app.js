// DOM 元素
const apiKeyInput = document.getElementById('apiKey');
const aspectRatioSelect = document.getElementById('aspectRatio');
const imageSizeSelect = document.getElementById('imageSize');
const contentsContainer = document.getElementById('contentsContainer');
const addContentBtn = document.getElementById('addContentBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const errorMessage = document.getElementById('errorMessage');

// 狀態
let contentItems = [];
let currentImageBase64 = null;
const CONTENTS_STORAGE_KEY = 'gemini_contents';
let currentAspectRatio = '1:1';
let currentImageSize = '1K';

// 初始化
function init() {
    // 從 localStorage 讀取 API Key
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // 讀取對話內容
    const hasRestored = loadContents();

    // 新增第一個內容項目
    if (!hasRestored) {
        addContentItem('user');
    }

    // 事件監聽
    addContentBtn?.addEventListener('click', () => addContentItem('user'));
    clearAllBtn?.addEventListener('click', clearAllContents);

    // 儲存 API Key
    apiKeyInput.addEventListener('change', () => {
        localStorage.setItem('gemini_api_key', apiKeyInput.value);
    });

    // 若仍有下拉選單存在，保持同步
    if (aspectRatioSelect) {
        currentAspectRatio = aspectRatioSelect.value || currentAspectRatio;
    }
    if (imageSizeSelect) {
        currentImageSize = imageSizeSelect.value || currentImageSize;
    }
}

function saveContents() {
    try {
        localStorage.setItem(CONTENTS_STORAGE_KEY, JSON.stringify(contentItems));
    } catch (error) {
        console.warn('Failed to save contents:', error);
    }
}

function loadContents() {
    try {
        const raw = localStorage.getItem(CONTENTS_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return false;

        contentItems = parsed.map((item, index) => ({
            id: typeof item.id === 'number' ? item.id : Date.now() + index,
            role: item.role === 'model' ? 'model' : 'user',
            type: item.type === 'image' ? 'image' : 'text',
            text: typeof item.text === 'string' ? item.text : '',
            imageData: typeof item.imageData === 'string' ? item.imageData : null,
            mimeType: typeof item.mimeType === 'string' ? item.mimeType : null
        }));

        contentsContainer.innerHTML = '';
        contentItems.forEach(item => renderContentItem(item, null));
        updateSingleItemControls();
        return true;
    } catch (error) {
        console.warn('Failed to load contents:', error);
        return false;
    }
}

function clearAllContents() {
    contentItems = [];
    currentImageBase64 = null;
    contentsContainer.innerHTML = '';
    localStorage.removeItem(CONTENTS_STORAGE_KEY);
    hideError();
    addContentItem('user');
}

function moveContentItem(id, direction) {
    const index = contentItems.findIndex(i => i.id === id);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= contentItems.length) return;

    const [item] = contentItems.splice(index, 1);
    contentItems.splice(targetIndex, 0, item);

    const currentElement = document.getElementById(`content-${id}`);
    if (!currentElement) {
        saveContents();
        return;
    }

    if (direction < 0) {
        const prevElement = currentElement.previousElementSibling;
        if (prevElement) {
            contentsContainer.insertBefore(currentElement, prevElement);
        }
    } else {
        const nextElement = currentElement.nextElementSibling;
        if (nextElement) {
            contentsContainer.insertBefore(nextElement, currentElement);
        }
    }

    saveContents();
}

function updateSingleItemControls() {
    const isSingle = contentItems.length <= 1;
    contentsContainer.querySelectorAll('.content-item').forEach(itemEl => {
        const removeBtn = itemEl.querySelector('.btn-remove');
        const moveUpBtn = itemEl.querySelector('.btn-move-up');
        const moveDownBtn = itemEl.querySelector('.btn-move-down');

        if (removeBtn) removeBtn.disabled = isSingle;
        if (moveUpBtn) moveUpBtn.disabled = isSingle;
        if (moveDownBtn) moveDownBtn.disabled = isSingle;
    });
}

function updateDownloadButtonStateForItem(element, item) {
    const downloadBtn = element.querySelector('.btn-download-item');
    if (!downloadBtn) return;

    let disabled = true;
    if (item.role === 'model') {
        if (item.type === 'image') {
            disabled = !item.imageData;
        } else {
            disabled = !item.text || !item.text.trim();
        }
    }

    downloadBtn.disabled = disabled;
}

function updateDownloadButtonStateById(id) {
    const item = contentItems.find(i => i.id === id);
    const element = document.getElementById(`content-${id}`);
    if (!item || !element) return;
    updateDownloadButtonStateForItem(element, item);
}

function updateRequestActionStateForItem(element, item) {
    const hasText = !!item.text && item.text.trim().length > 0;
    const hasImage = !!item.imageData;
    const canGenerate = item.role === 'user' && (hasText || hasImage);

    element.querySelectorAll('.btn-cycle').forEach(btn => {
        btn.disabled = !canGenerate;
    });

    const generateImageBtn = element.querySelector('.btn-generate-image');
    if (generateImageBtn) generateImageBtn.disabled = !canGenerate;

    const generateTextBtn = element.querySelector('.btn-generate-text');
    if (generateTextBtn) generateTextBtn.disabled = !canGenerate;
}

function updateRequestActionStateById(id) {
    const item = contentItems.find(i => i.id === id);
    const element = document.getElementById(`content-${id}`);
    if (!item || !element) return;
    updateRequestActionStateForItem(element, item);
}

// 新增內容項目
function addContentItem(role = 'user', insertAfterId = null) {
    const id = Date.now();
    const item = { id, role, type: 'text', text: '', imageData: null, mimeType: null };
    if (insertAfterId) {
        const insertIndex = contentItems.findIndex(i => i.id === insertAfterId);
        if (insertIndex >= 0) {
            contentItems.splice(insertIndex + 1, 0, item);
            renderContentItem(item, insertAfterId);
            saveContents();
            updateSingleItemControls();
            return;
        }
    }
    contentItems.push(item);
    renderContentItem(item, null);
    saveContents();
    updateSingleItemControls();
}

function insertContentItem(item, insertAfterId) {
    const insertIndex = contentItems.findIndex(i => i.id === insertAfterId);
    if (insertIndex >= 0) {
        contentItems.splice(insertIndex + 1, 0, item);
        renderContentItem(item, insertAfterId);
    } else {
        contentItems.push(item);
        renderContentItem(item, null);
    }
    saveContents();
    updateSingleItemControls();
}

// 渲染內容項目
function renderContentItem(item, insertAfterId = null) {
    const div = document.createElement('div');
    div.className = 'content-item';
    div.id = `content-${item.id}`;

    div.innerHTML = `
        <div class="content-item-header">
            <div class="role-toggle" data-id="${item.id}">
                <button type="button" class="role-toggle-btn ${item.role === 'user' ? 'active' : ''}" data-id="${item.id}" data-role="user">請求</button>
                <button type="button" class="role-toggle-btn ${item.role === 'model' ? 'active' : ''}" data-id="${item.id}" data-role="model">回應</button>
            </div>
            <div class="content-type-toggle" data-id="${item.id}">
                <button type="button" class="btn-type-cycle" data-id="${item.id}" data-type="${item.type}">${item.type === 'image' ? '圖片' : '文字'}</button>
            </div>
            <div class="content-item-actions content-item-actions-top">
                <button type="button" class="btn-remove" data-id="${item.id}">移除</button>
                <button type="button" class="btn-move btn-move-up" data-id="${item.id}">上移</button>
                <button type="button" class="btn-move btn-move-down" data-id="${item.id}">下移</button>
                <button type="button" class="btn-add btn-add-inline" data-id="${item.id}">新增</button>
            </div>
        </div>
        
        <div class="content-panel text-panel ${item.type === 'text' ? 'active' : ''}" data-id="${item.id}">
            <textarea class="text-input" data-id="${item.id}" placeholder="輸入提示詞...">${item.text}</textarea>
        </div>
        
        <div class="content-panel image-panel ${item.type === 'image' ? 'active' : ''}" data-id="${item.id}">
            <div class="image-upload-area" data-id="${item.id}">
                <input type="file" accept="image/*" data-id="${item.id}">
                <div class="upload-placeholder">
                    <p>點擊或拖曳圖片到此處上傳</p>
                </div>
            </div>
        </div>

        <div class="content-item-actions content-item-actions-bottom">
            <button type="button" class="btn-cycle" data-id="${item.id}" data-cycle="aspect" style="${item.role === 'user' ? '' : 'display: none;'}">${currentAspectRatio}</button>
            <button type="button" class="btn-cycle" data-id="${item.id}" data-cycle="size" style="${item.role === 'user' ? '' : 'display: none;'}">${currentImageSize}</button>
            <button type="button" class="btn-generate-image" data-id="${item.id}" style="${item.role === 'user' ? '' : 'display: none;'}">生成圖片</button>
            <button type="button" class="btn-generate-text" data-id="${item.id}" style="${item.role === 'user' ? '' : 'display: none;'}">生成文字</button>
            <button type="button" class="btn-download-item" data-id="${item.id}" style="${item.role === 'model' ? '' : 'display: none;'}">下載</button>
        </div>
    `;

    if (insertAfterId) {
        const afterElement = document.getElementById(`content-${insertAfterId}`);
        if (afterElement && afterElement.nextSibling) {
            contentsContainer.insertBefore(div, afterElement.nextSibling);
        } else if (afterElement) {
            contentsContainer.appendChild(div);
        } else {
            contentsContainer.appendChild(div);
        }
    } else {
        contentsContainer.appendChild(div);
    }

    // 綁定事件
    bindContentItemEvents(div, item.id);

    updateSingleItemControls();
    updateDownloadButtonStateForItem(div, item);
    updateRequestActionStateForItem(div, item);

    // 若已有圖片資料，渲染預覽
    if (item.imageData) {
        const uploadArea = div.querySelector('.image-upload-area');
        if (uploadArea) {
            applyImagePreview(uploadArea, item.imageData, item.mimeType, item.id);
        }
    }
}

function applyImagePreview(uploadArea, base64Data, mimeType, id) {
    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;
    uploadArea.classList.add('has-image');
    uploadArea.innerHTML = `
        <input type="file" accept="image/*" data-id="${id}">
        <img src="${dataUrl}" class="image-preview" alt="已上傳的圖片">
        <p style="margin-top: 0.5rem; color: var(--text-secondary);">點擊更換圖片</p>
    `;

    const newFileInput = uploadArea.querySelector('input[type="file"]');
    newFileInput.addEventListener('change', (ev) => {
        const newFile = ev.target.files[0];
        if (newFile) {
            handleImageUpload(newFile, id, uploadArea);
        }
    });
}

// 綁定內容項目事件
function bindContentItemEvents(element, id) {
    // 角色切換
    element.querySelectorAll('.role-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.dataset.role;
            const item = contentItems.find(i => i.id === id);
            if (item) {
                item.role = role;
                saveContents();
            }

            const generateImageBtn = element.querySelector('.btn-generate-image');
            if (generateImageBtn) {
                generateImageBtn.style.display = role === 'user' ? '' : 'none';
            }

            const generateTextBtn = element.querySelector('.btn-generate-text');
            if (generateTextBtn) {
                generateTextBtn.style.display = role === 'user' ? '' : 'none';
            }

            const downloadBtn = element.querySelector('.btn-download-item');
            if (downloadBtn) {
                downloadBtn.style.display = role === 'model' ? '' : 'none';
            }

            element.querySelectorAll('.btn-cycle').forEach(cycleBtn => {
                cycleBtn.style.display = role === 'user' ? '' : 'none';
            });

            const toggleContainer = element.querySelector('.role-toggle');
            if (toggleContainer) {
                toggleContainer.querySelectorAll('.role-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }

            if (item) {
                updateDownloadButtonStateForItem(element, item);
                updateRequestActionStateForItem(element, item);
            }
        });
    });

    // 移除按鈕
    element.querySelector('.btn-remove').addEventListener('click', () => {
        if (contentItems.length > 1) {
            contentItems = contentItems.filter(i => i.id !== id);
            element.remove();
            saveContents();
            updateSingleItemControls();
        } else {
            showError('至少需要一個內容項目');
        }
    });

    // 新增按鈕（在移除按鈕右側）
    const inlineAddBtn = element.querySelector('.btn-add-inline');
    if (inlineAddBtn) {
        inlineAddBtn.addEventListener('click', () => addContentItem('user', id));
    }

    const moveUpBtn = element.querySelector('.btn-move-up');
    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', () => moveContentItem(id, -1));
    }

    const moveDownBtn = element.querySelector('.btn-move-down');
    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', () => moveContentItem(id, 1));
    }

    const generateImageBtn = element.querySelector('.btn-generate-image');
    if (generateImageBtn) {
        generateImageBtn.addEventListener('click', () => handleGenerateFromItem(id, generateImageBtn, 'image'));
    }

    const generateTextBtn = element.querySelector('.btn-generate-text');
    if (generateTextBtn) {
        generateTextBtn.addEventListener('click', () => handleGenerateFromItem(id, generateTextBtn, 'text'));
    }

    const downloadBtn = element.querySelector('.btn-download-item');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => handleDownloadItem(id));
    }

    element.querySelectorAll('.btn-cycle').forEach(btn => {
        btn.addEventListener('click', () => {
            const cycleType = btn.dataset.cycle;
            if (cycleType === 'aspect') {
                const options = ['1:1', '2:3', '3:2', '16:9', '9:16'];
                const currentIndex = options.indexOf(currentAspectRatio);
                const nextIndex = (currentIndex + 1) % options.length;
                currentAspectRatio = options[nextIndex];
                if (aspectRatioSelect) aspectRatioSelect.value = options[nextIndex];
                btn.textContent = options[nextIndex];
            } else if (cycleType === 'size') {
                const options = ['1K', '2K', '4K'];
                const currentIndex = options.indexOf(currentImageSize);
                const nextIndex = (currentIndex + 1) % options.length;
                currentImageSize = options[nextIndex];
                if (imageSizeSelect) imageSizeSelect.value = options[nextIndex];
                btn.textContent = options[nextIndex];
            }
        });
    });

    // 文字/圖片切換（單一按鈕）
    const typeCycleBtn = element.querySelector('.btn-type-cycle');
    if (typeCycleBtn) {
        typeCycleBtn.addEventListener('click', () => {
            const item = contentItems.find(i => i.id === id);
            if (!item) return;

            item.type = item.type === 'text' ? 'image' : 'text';
            saveContents();

            typeCycleBtn.dataset.type = item.type;
            typeCycleBtn.textContent = item.type === 'image' ? '圖片' : '文字';

            element.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
            element.querySelector(`.${item.type}-panel`).classList.add('active');

            updateDownloadButtonStateForItem(element, item);
            updateRequestActionStateForItem(element, item);
        });
    }

    // 文字輸入
    const textInput = element.querySelector('.text-input');
    if (textInput) {
        const autoResize = (target) => {
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
        };

        textInput.addEventListener('input', (e) => {
            const item = contentItems.find(i => i.id === id);
            if (item) {
                item.text = e.target.value;
                updateDownloadButtonStateForItem(element, item);
                updateRequestActionStateForItem(element, item);
            }
            autoResize(e.target);
            saveContents();
        });

        // 初始高度校正
        autoResize(textInput);
    }

    // 圖片上傳
    const uploadArea = element.querySelector('.image-upload-area');
    const fileInput = uploadArea.querySelector('input[type="file"]');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--accent-primary)';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file, id, uploadArea);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file, id, uploadArea);
        }
    });
}

function handleDownloadItem(itemId) {
    const item = contentItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.type === 'image') {
        if (!item.imageData) {
            showError('尚未有圖片可下載');
            return;
        }
        const mimeType = item.mimeType || 'image/png';
        const link = document.createElement('a');
        link.href = `data:${mimeType};base64,${item.imageData}`;
        link.download = `image-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    const text = item.text || '';
    if (!text.trim()) {
        showError('尚未有文字可下載');
        return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `text-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 處理圖片上傳
function handleImageUpload(file, id, uploadArea) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        const item = contentItems.find(i => i.id === id);
        if (item) {
            item.imageData = base64;
            item.mimeType = file.type;
        }
        applyImagePreview(uploadArea, base64, file.type, id);
        saveContents();
        updateDownloadButtonStateById(id);
        updateRequestActionStateById(id);
    };
    reader.readAsDataURL(file);
}

// 建構請求內容
function buildContents() {
    return contentItems.map(item => {
        const content = { role: item.role, parts: [] };

        if (item.type === 'text' && item.text.trim()) {
            content.parts.push({ text: item.text.trim() });
        } else if (item.type === 'image' && item.imageData) {
            const part = {
                inline_data: {
                    mime_type: item.mimeType || 'image/png',
                    data: item.imageData
                }
            };
            content.parts.push(part);
        }

        return content;
    }).filter(c => c.parts.length > 0);
}

// 依項目生成
async function handleGenerateFromItem(itemId, button, mode = 'image') {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showError('請輸入 API Key');
        return;
    }

    const contents = buildContents();
    if (contents.length === 0) {
        showError('請至少輸入一個內容');
        return;
    }

    // 更新 UI
    const originalText = button.textContent;
    button.disabled = true;
    const startTime = performance.now();
    button.textContent = '0.00s';
    const timerId = setInterval(() => {
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        button.textContent = `${elapsedSeconds.toFixed(2)}s`;
    }, 100);
    hideError();

    try {
        const isImage = mode === 'image';
        const modelName = isImage ? 'gemini-3-pro-image-preview' : 'gemini-3-flash-preview';
        const requestBody = {
            contents: contents
        };

        if (isImage) {
            requestBody.generationConfig = {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: currentAspectRatio,
                    imageSize: currentImageSize
                }
            };
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || '請求失敗');
        }

        // 解析回應
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('沒有收到生成結果');
        }

        const parts = candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
            throw new Error('回應格式錯誤');
        }

        if (mode === 'text') {
            const textPart = parts.find(p => p.text);
            if (!textPart) {
                throw new Error('沒有收到文字');
            }
            const textItem = {
                id: Date.now(),
                role: 'model',
                type: 'text',
                text: textPart.text,
                imageData: null,
                mimeType: null
            };
            insertContentItem(textItem, itemId);
            return;
        }

        // 尋找圖片
        const imagePart = parts.find(p => p.inline_data || p.inlineData);
        if (!imagePart) {
            throw new Error('沒有收到圖片');
        }

        // 取得圖片資料
        const inlineData = imagePart.inline_data || imagePart.inlineData;
        currentImageBase64 = inlineData.data;
        const mimeType = inlineData.mime_type || inlineData.mimeType || 'image/png';

        const imageItem = {
            id: Date.now(),
            role: 'model',
            type: 'image',
            text: '',
            imageData: currentImageBase64,
            mimeType: mimeType
        };
        insertContentItem(imageItem, itemId);


    } catch (error) {
        showError(error.message);
    } finally {
        clearInterval(timerId);
        button.disabled = false;
        button.textContent = originalText;
    }
}

// 顯示錯誤
function showError(message) {
    errorMessage.textContent = '錯誤：' + message;
    errorMessage.style.display = 'block';
}

// 隱藏錯誤
function hideError() {
    errorMessage.style.display = 'none';
}

// 啟動
init();
