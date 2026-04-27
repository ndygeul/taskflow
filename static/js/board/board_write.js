var pendingFiles = [];
let existingFiles = [];
let editorInstance = null; 

const ckeditorToolbar = [
    'heading', '|',
    'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|',
    'bold', 'italic', 'underline', 'strikethrough', '|',
    'alignment', '|',
    'bulletedList', 'numberedList', '|',
    'insertTable', 'imageUpload', 'blockQuote', '|',
    'undo', 'redo'
];

const removePluginsList = [
    'CKBox', 'CKFinder', 'EasyImage', 
    'Base64UploadAdapter',
    'RealTimeCollaborativeComments', 'RealTimeCollaborativeTrackChanges', 'RealTimeCollaborativeRevisionHistory',
    'PresenceList', 'Comments', 'TrackChanges', 'TrackChangesData', 'RevisionHistory', 
    'Pagination', 'WProofreader', 'MathType', 'SlashCommand', 'Template', 'DocumentOutline', 
    'FormatPainter', 'TableOfContents', 'PasteFromOfficeEnhanced'
];

class CustomUploadAdapter {
    constructor(loader, context) {
        this.loader = loader;
        this.context = context;
    }
    upload() {
        return this.loader.file.then(file => new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("context", this.context);
            
            $.ajax({
                url: '/api/upload', type: 'POST', data: formData,
                contentType: false, processData: false,
                success: function(res) { resolve({ default: res.url }); },
                error: function(err) { reject(err); }
            });
        }));
    }
    abort() {}
}

function MyUploadAdapterPlugin(editor, context) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
        return new CustomUploadAdapter(loader, context);
    };
}

$(document).ready(function() {
    const boardCode = $('#boardCode').val();

    if ($('#mode').val() === 'edit') {
        const cachedPw = sessionStorage.getItem('edit_password');
        if (cachedPw) { $('#password').val(cachedPw); $('#passwordWrapper').hide(); }

        extractExistingFilesFromRawData();
    }

    CKEDITOR.ClassicEditor.create(document.querySelector('#summernote'), {
        language: 'ko',
        removePlugins: removePluginsList,
        extraPlugins: [function(editor) { MyUploadAdapterPlugin(editor, boardCode); }],
        toolbar: ckeditorToolbar,
        alignment: {
            options: [ 'left', 'center', 'right', 'justify' ]
        },
        fontFamily: {
            options: [
                'default',
                'Pretendard, sans-serif',
                '맑은 고딕, Malgun Gothic, sans-serif',
                '돋움, Dotum, sans-serif',
                '굴림, Gulim, sans-serif',
                'D2Coding, monospace'
            ]
        },
        fontSize: {
            options: [ 9, 10, 11, 'default', 14, 18, 20, 24, 28, 30, 36 ]
        }
    }).then(editor => {
        editorInstance = editor;
    }).catch(err => {
        console.error("Editor init error:", err);
    });

    function extractExistingFilesFromRawData() {
        let rawContent = $('#summernote').val();
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = rawContent;

        let attachedFilesContainer = tempDiv.querySelector('.ezk-attached-files');
        
        if (attachedFilesContainer) {
            let links = attachedFilesContainer.querySelectorAll('a.file-link-item');
            links.forEach(link => {
                existingFiles.push({
                    url: link.getAttribute('href'),
                    name: link.getAttribute('download') || link.innerText.trim()
                });
            });

            attachedFilesContainer.remove();

            $('#summernote').val(tempDiv.innerHTML);

            renderExistingFiles();
        } else {
            let links = tempDiv.querySelectorAll('a.file-link-item');
            if (links.length > 0) {
                links.forEach(link => {
                    existingFiles.push({
                        url: link.getAttribute('href'),
                        name: link.getAttribute('download') || link.textContent.replace('📄', '').trim()
                    });
                    link.remove();
                });
                $('#summernote').val(tempDiv.innerHTML);
                renderExistingFiles();
            }
        }
    }

    function renderExistingFiles() {
        const container = $('#existingFilesArea'); 
        container.empty();
        
        if (existingFiles.length > 0) {
            let html = '<div class="p-3 mb-2 rounded" style="background-color: #2b3035; border: 1px solid #495057;">';
            html += '<div class="small fw-bold text-secondary mb-2"><i class="bi bi-paperclip"></i> 기존 첨부파일 (X를 누르면 제외됩니다)</div>';
            existingFiles.forEach((file, index) => {
                html += `
                <div class="d-inline-flex align-items-center bg-dark border border-secondary rounded px-2 py-1 me-2 mb-2" style="font-size:0.85rem;">
                    <i class="bi bi-file-earmark-check text-success me-2"></i>
                    <span class="text-light me-2">${file.name}</span>
                    <button type="button" class="btn-close btn-close-white" style="font-size:0.6rem;" onclick="removeExistingFile(${index})" aria-label="삭제"></button>
                </div>`;
            });
            html += '</div>';
            container.append(html);
        }
    }

    window.removeExistingFile = function(index) {
        existingFiles.splice(index, 1);
        renderExistingFiles();
    };

    $('#btnAttachFile').on('click', function() { $('#hiddenFileInput').click(); });
    $('#hiddenFileInput').on('change', function() {
        if (this.files.length > 0) { pendingFiles.push(this.files[0]); renderPendingFiles(); $(this).val(''); }
    });

    function renderPendingFiles() {
        const container = $('#attachedFilesArea'); container.empty();
        if (pendingFiles.length > 0) {
            let html = '<div class="p-3 rounded" style="background-color: #212529; border: 1px dashed #495057;">';
            html += '<div class="small fw-bold text-info mb-2"><i class="bi bi-cloud-arrow-up"></i> 신규 업로드 대기 파일</div>';
            pendingFiles.forEach((file, index) => {
                html += `
                <div class="d-inline-flex align-items-center bg-dark border border-secondary rounded px-2 py-1 me-2 mb-2" style="font-size:0.85rem;">
                    <i class="bi bi-file-earmark-plus text-info me-2"></i>
                    <span class="text-light me-2">${file.name}</span>
                    <button type="button" class="btn-close btn-close-white" style="font-size:0.6rem;" onclick="removePendingFile(${index})" aria-label="삭제"></button>
                </div>`;
            });
            html += '</div>';
            container.append(html);
        }
    }
    window.removePendingFile = function(index) { pendingFiles.splice(index, 1); renderPendingFiles(); };

    $('#title, #writer, #password').on('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); $('#btnSave').click(); } });

    $('#btnSave').on('click', async function() {
        const title = $('#title').val(); const writer = $('#writer').val(); const password = $('#password').val();
        const categorySelect = $('#category');
        const categoryValue = categorySelect.length > 0 ? categorySelect.val() : null;

        if (categorySelect.length > 0 && !categoryValue) { alert("말머리(카테고리)를 선택해주세요."); categorySelect.focus(); return; }
        if (!title || !writer || !password) { alert("필수 항목을 입력하세요."); return; }
        
        let content = editorInstance.getData();

        if (content.trim() === '' && pendingFiles.length === 0 && existingFiles.length === 0) { alert("내용을 입력해주세요."); return; }

        if (content.includes('data:image/')) {
            alert("이미지 업로드가 진행 중이거나 실패했습니다.\n잠시 후 다시 시도하거나, 이미지를 지우고 다시 붙여넣어 주세요.");
            return;
        }

        const $btn = $(this); const originalText = $btn.html();
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> 저장 중...');
        $('#fileStatus').text('첨부파일 처리 중...');

        try {
            let uploadedFilesInfo = [];
            if (pendingFiles.length > 0) {
                const uploadPromises = pendingFiles.map(file => {
                    let formData = new FormData(); formData.append("file", file); formData.append("context", boardCode);
                    return $.ajax({ url: '/api/upload', type: "POST", data: formData, contentType: false, processData: false });
                });
                const results = await Promise.all(uploadPromises);
                results.forEach(res => { uploadedFilesInfo.push({ name: res.original_name, url: res.url }); });
            }

            const finalFilesList = [...existingFiles, ...uploadedFilesInfo];

            if (finalFilesList.length > 0) {
                let fileListHtml = '<div class="ezk-attached-files" style="display:none;">';
                finalFilesList.forEach(file => {
                    fileListHtml += `<a href="${file.url}" class="file-link-item" download="${file.name}" style="text-decoration:none;"><div style="display: inline-flex; align-items: center; padding: 6px 12px; border: 1px solid #dee2e6; border-radius: 4px; background-color: #f8f9fa; font-size: 13px; color: #333; margin-right: 8px; margin-bottom: 8px;"><span style="font-size: 16px; margin-right: 8px; color: #0d6efd;">📄</span><span style="font-weight: 600;">${file.name}</span></div></a>`;
                });
                fileListHtml += '</div>';
                content += fileListHtml;
            }

            const data = { 
                title: title, content: content, writer: writer, password: password, 
                is_secret: $('#isSecret').is(':checked'), is_notice: $('#isNotice').is(':checked'), category: categoryValue
            };
            
            const mode = $('#mode').val();
            let url = `/api/posts/${boardCode}`; let method = 'POST';
            if (mode === 'edit') { url = `/api/posts/${$('#postId').val()}`; method = 'PUT'; }

            const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

            if (res.ok) {
                sessionStorage.removeItem('edit_password');
                alert("저장되었습니다."); window.location.href = `/board/${boardCode}`;
            } else {
                const err = await res.json(); alert("오류: " + err.detail);
                $btn.prop('disabled', false).html(originalText); $('#fileStatus').text('');
            }
        } catch (err) {
            console.error(err); alert("파일 업로드 또는 저장 중 오류가 발생했습니다.");
            $btn.prop('disabled', false).html(originalText); $('#fileStatus').text('');
        }
    });
});

const editorObserver = new MutationObserver((mutations, obs) => {
    const editors = document.querySelectorAll('.ck-editor');
    if (editors.length > 0) {
        addEditorResizeHandle();
        obs.disconnect();
    }
});

editorObserver.observe(document.body, { childList: true, subtree: true });

function addEditorResizeHandle() {
    const editorWrappers = document.querySelectorAll('.ck-editor');

    const savedHeight = localStorage.getItem('boardEditorHeight');
    if (savedHeight) {
        editorWrappers.forEach(wrapper => {
            wrapper.style.setProperty('--editor-custom-height', savedHeight);
        });
    }

    editorWrappers.forEach(wrapper => {
        if (wrapper.querySelector('.custom-editor-resizer')) return;

        const editableArea = wrapper.querySelector('.ck-editor__editable');
        if (!editableArea) return;

        const resizer = document.createElement('div');
        resizer.className = 'custom-editor-resizer';
        resizer.innerHTML = '<div class="resizer-grip"></div>';

        wrapper.appendChild(resizer);

        let isResizing = false;
        let startY;
        let startHeight;
        let finalHeight = null;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = editableArea.getBoundingClientRect().height;
            
            resizer.classList.add('active-drag');
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dy = e.clientY - startY;
            let newHeight = startHeight + dy;

            if (newHeight < 300) newHeight = 300;

            finalHeight = newHeight;

            wrapper.style.setProperty('--editor-custom-height', `${newHeight}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('active-drag');
                document.body.style.userSelect = '';

                if (finalHeight !== null) {
                    localStorage.setItem('boardEditorHeight', `${finalHeight}px`);
                }
            }
        });
    });
}