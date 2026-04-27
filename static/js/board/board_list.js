document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/admin/status').then(res=>res.json()).then(data=>{ if(data.is_logged_in) document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('d-none')); });
    window.addEventListener('admin:login', function(){ document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('d-none')); });
    
    const checkAll = document.getElementById('checkAll');
    if(checkAll) checkAll.addEventListener('change', function(){ document.querySelectorAll('.post-chk').forEach(chk => chk.checked = this.checked); });

    const btnBulkDelete = document.getElementById('btnBulkDelete');
    if(btnBulkDelete) btnBulkDelete.addEventListener('click', async function() {
        const checked = document.querySelectorAll('.post-chk:checked');
        if(checked.length === 0) return alert('삭제할 게시글을 선택해주세요.');
        if(!confirm('정말 삭제하시겠습니까?')) return;
        const ids = Array.from(checked).map(el => parseInt(el.value));
        try {
            const res = await fetch('/api/admin/posts/bulk-delete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ post_ids: ids }) });
            if(res.ok) location.reload(); else alert("오류 발생");
        } catch(e) { alert("통신 오류"); }
    });

    const btnMoveCopy = document.getElementById('btnMoveCopy');
    if(btnMoveCopy) {
        btnMoveCopy.addEventListener('click', function() {
            const checked = document.querySelectorAll('.post-chk:checked');
            if(checked.length === 0) {
                alert('선택된 게시글이 없습니다.');
                return;
            }
            const ids = Array.from(checked).map(el => parseInt(el.value));
            if(typeof openPostMoveCopyModal === 'function') {
                openPostMoveCopyModal(ids);
            } else {
                alert('기능 로드 실패. 새로고침 해주세요.');
            }
        });
    }
});

function searchBoard() {
    const keyword = document.getElementById('searchInput').value;
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || '';
    
    let url = `${currentPath}?page=1`;
    if(keyword) url += `&q=${encodeURIComponent(keyword)}`;
    if(category) url += `&category=${encodeURIComponent(category)}`;
    
    location.href = url;
}