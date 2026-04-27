let isSaveSuccess = false;
let currentEditPassword = ''; 
let editors = {}; 

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
                error: function(err) { console.error(err); reject(err); }
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
    const mode = $('#mode').val();
    
    if (mode === 'edit') {
        const serverToken = $('#lockToken').val();
        if (serverToken) {
            const jId = $('#journalId').val();
            if (jId) sessionStorage.setItem(`journal_token_${jId}`, serverToken);
        }
        const cachedPw = sessionStorage.getItem('edit_password');
        if (cachedPw) { 
            currentEditPassword = cachedPw;
            $('#password').val(cachedPw); 
            $('#passwordWrapper').hide(); 
        }
    }

    window.addEventListener('beforeunload', function() {
        if (mode === 'edit' && !isSaveSuccess) {
            const journalId = $('#journalId').val();
            if (journalId) { navigator.sendBeacon(`/journal/api/${journalId}/unlock`); }
        }
    });

    $('#btnCancel').click(function(e) { e.preventDefault(); window.location.href = "/journal"; });
    $('#writerDay, #writerNight, #password, #title').on('keypress', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); $('#btnSave').click(); }
    });

    const initEditor = async (selector, key) => { 
        if ($(selector).length === 0) return;
        try {
            const editor = await CKEDITOR.ClassicEditor.create(document.querySelector(selector), {
                language: 'ko',
                removePlugins: removePluginsList,
                extraPlugins: [function(editor) { MyUploadAdapterPlugin(editor, 'journal'); }],
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
            });
            editors[key] = editor; 
        } catch (error) {
            console.error("Editor init error:", error);
        }
    };
    
    initEditor('#summernoteDay', 'day'); 
    initEditor('#summernoteHandover', 'handover'); 
    initEditor('#summernoteNight', 'night'); 
    initEditor('#summernoteEtc', 'etc');
    
    const existingDate = $('#workDate').val();
    flatpickr(".flatpickr-date", { dateFormat: "Y-m-d", locale: "ko", defaultDate: existingDate ? existingDate : new Date() });

    $('#workDate').change(function() { 
        if (mode === 'create') { 
            const d = $(this).val(); 
            if(d) { const day = ['일','월','화','수','목','금','토'][new Date(d).getDay()]; $('#title').val(`${d}(${day}) 업무일지`); } 
        } 
    });
    
    if (mode === 'create' && !$('#title').val()) $('#workDate').trigger('change');

    setTimeout(() => { 
        const checkAndExpand = (editorKey, collapseSelector) => {
            if (editors[editorKey] && editors[editorKey].getData().replace(/<[^>]*>?/gm, '').trim().length > 0) {
                $(collapseSelector).collapse('show');
                $(`.journal-header[data-bs-target="${collapseSelector}"]`).removeClass('collapsed');
            }
        };
        checkAndExpand('handover', '#collapseHandover');
        checkAndExpand('night', '#collapseNight');
        checkAndExpand('etc', '#collapseEtc');
    }, 500);

    $('#btnSave').click(async function() {
        try {
            const date = $('#workDate').val(); 
            const wDay = $('#writerDay').val(); 
            let pw = $('#password').val();
            if (mode === 'edit' && currentEditPassword !== '') pw = currentEditPassword;

            if(!date || !wDay || !pw) { alert("업무 일자, 주간 근무자, 비밀번호는 필수 항목입니다."); return; }
            
            const $btn = $(this);
            const originalText = $btn.html();
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> 저장 중...');

            const contentDay = editors['day'] ? editors['day'].getData() : '';
            const contentHandover = editors['handover'] ? editors['handover'].getData() : '';
            const contentNight = editors['night'] ? editors['night'].getData() : '';
            const contentEtc = editors['etc'] ? editors['etc'].getData() : '';

            if (contentDay.includes('data:image/') || contentHandover.includes('data:image/') || 
                contentNight.includes('data:image/') || contentEtc.includes('data:image/')) {
                alert("이미지 업로드가 진행 중이거나 실패했습니다.\n잠시 후 다시 시도하거나, 이미지를 지우고 다시 붙여넣어 주세요.");
                $btn.prop('disabled', false).html(originalText);
                return;
            }

            const data = {
                work_date: date, writer_day: wDay, writer_night: $('#writerNight').val(), 
                title: $('#title').val(), password: pw,
                content_day: contentDay, content_handover: contentHandover,
                content_night: contentNight, content_etc: contentEtc,
                is_notice: $('#is_notice').is(':checked') ? 1 : 0, 
                is_secret: $('#is_secret').is(':checked') ? 1 : 0
            };
            
            const url = mode === 'edit' ? `/journal/${$('#journalId').val()}` : '/journal/write';
            const method = mode === 'edit' ? 'PUT' : 'POST';
        
            const res = await fetch(url, { method: method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            
            if (res.ok) { 
                isSaveSuccess = true; sessionStorage.removeItem('edit_password'); 
                alert("저장되었습니다."); window.location.href = "/journal"; 
            } else { 
                const err = await res.json(); alert("오류: " + (err.detail || "저장 실패")); 
                $btn.prop('disabled', false).html(originalText);
            }
        } catch (e) { 
            console.error(e); alert("처리 중 자바스크립트 에러가 발생했습니다."); 
            $(this).prop('disabled', false).html('<i class="bi bi-check-lg"></i> 작성 완료');
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

    const savedHeight = localStorage.getItem('journalEditorHeight');
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
                    localStorage.setItem('journalEditorHeight', `${finalHeight}px`);

                    const allWrappers = document.querySelectorAll('.ck-editor');
                    allWrappers.forEach(w => w.style.setProperty('--editor-custom-height', `${finalHeight}px`));
                }
            }
        });
    });
}