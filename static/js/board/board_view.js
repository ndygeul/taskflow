document.addEventListener('DOMContentLoaded', function() {
    const contentArea = document.querySelector('.post-content');
    if (contentArea) {
        const attachmentWrapper = contentArea.querySelector('.ezk-attached-files');
        if (attachmentWrapper) {
            const listContainer = document.getElementById('ezk-attachment-list');
            if (listContainer) {
                attachmentWrapper.querySelectorAll('a.file-link-item').forEach(link => {
                    const innerDiv = link.querySelector('div');
                    if (innerDiv) {
                        innerDiv.removeAttribute('style');
                        innerDiv.className = 'btn btn-dark border-secondary d-inline-flex align-items-center px-3 py-2 text-light transition-hover';
                        
                        const spans = innerDiv.querySelectorAll('span');
                        spans.forEach(span => {
                            span.removeAttribute('style');
                            if (span.innerText.includes('📄')) {
                                span.className = 'me-2 text-primary fs-5';
                            } else {
                                span.className = 'fw-bold text-light';
                            }
                        });
                    }
                    link.style.display = 'inline-block';
                    link.style.textDecoration = 'none';
                    listContainer.appendChild(link);
                });

                attachmentWrapper.remove();
                const viewArea = document.getElementById('ezk-attachment-view');
                if (viewArea) viewArea.style.display = 'block';
            }
        }
    }

    if (window.currentPostId) {
        fetch(`/api/posts/${window.currentPostId}/navigation`)
        .then(res => res.json())
        .then(data => {
            const navContainer = document.getElementById('postNavContainer');
            if (navContainer) navContainer.style.display = 'block';
            
            const prevLink = document.getElementById('prevPostLink');
            const prevTitle = document.getElementById('prevPostTitle');
            if (prevLink && prevTitle) {
                if (data.prev) { 
                    prevTitle.innerText = data.prev.title; 
                    prevLink.href = `/board/view/${data.prev.id}`; 
                } else {
                    prevLink.classList.add('opacity-50', 'pe-none');
                }
            }
            
            const nextLink = document.getElementById('nextPostLink');
            const nextTitle = document.getElementById('nextPostTitle');
            if (nextLink && nextTitle) {
                if (data.next) { 
                    nextTitle.innerText = data.next.title; 
                    nextLink.href = `/board/view/${data.next.id}`; 
                } else {
                    nextLink.classList.add('opacity-50', 'pe-none');
                }
            }
        }).catch(err => console.error("네비게이션 로드 오류:", err));
    }

    const btnRealEdit = document.getElementById('btnRealEdit');
    if (btnRealEdit) {
        btnRealEdit.addEventListener('click', function() {
            const pwInput = document.getElementById('editPassword');
            if (!pwInput) return;
            
            const pw = pwInput.value; 
            if(!pw) { alert("비밀번호를 입력하세요."); return; }
            
            const cleanPw = pw.trim();

            fetch(`/api/posts/${window.currentPostId}/verify`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ password: cleanPw }) 
            })
            .then(async res => {
                if(res.ok) {
                    sessionStorage.setItem('edit_password', cleanPw);
                    location.href = `/board/edit/${window.currentPostId}`;
                } else {
                    alert("비밀번호가 일치하지 않습니다."); 
                    pwInput.value = ''; 
                    pwInput.focus();
                }
            }).catch(() => alert("서버 오류가 발생했습니다."));
        });
    }

    const btnRealDelete = document.getElementById('btnRealDelete');
    if (btnRealDelete) {
        btnRealDelete.addEventListener('click', function() {
            const pwInput = document.getElementById('deletePassword');
            if (!pwInput) return;

            const pw = pwInput.value; 
            if(!pw) { alert("비밀번호를 입력하세요."); return; }
            
            const cleanPw = pw.trim(); 

            fetch(`/api/posts/${window.currentPostId}`, { 
                method: 'DELETE', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ password: cleanPw }) 
            })
            .then(async res => {
                if(res.ok) {
                    alert("삭제되었습니다.");
                    location.href = `/board/${window.currentBoardCode}`;
                } else {
                    alert("비밀번호가 일치하지 않거나 권한이 없습니다.");
                    pwInput.value = ''; 
                    pwInput.focus();
                }
            }).catch(() => alert("서버 오류가 발생했습니다."));
        });
    }
});

window.openEditModal = function() {
    const modalEl = document.getElementById('editModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
};

window.openDeleteModal = function() {
    const modalEl = document.getElementById('deleteModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
};