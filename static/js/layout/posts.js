let targetPostIds = [];

document.addEventListener('DOMContentLoaded', function() {
    const btnSubmitAction = document.getElementById('btnSubmitPostAction');
    if(btnSubmitAction) btnSubmitAction.addEventListener('click', submitPostMoveCopy);
});

window.openPostMoveCopyModal = async function(postIds) {
    if (!postIds || postIds.length === 0) { alert("선택된 게시글이 없습니다."); return; }
    targetPostIds = postIds;
    document.getElementById('selectedPostCount').textContent = `${postIds.length}개 선택됨`;
    const selectEl = document.getElementById('targetBoardSelect');
    selectEl.innerHTML = '<option value="">로딩 중...</option>';
    try {
        const res = await fetch('/api/boards/');
        if(res.ok) {
            const boards = await res.json();
            let html = '<option value="">게시판 선택...</option>';
            boards.forEach(b => { html += `<option value="${b.id}">[${b.code}] ${b.name}</option>`; });
            selectEl.innerHTML = html;
        } else { selectEl.innerHTML = '<option value="">로드 실패</option>'; }
    } catch(e) { selectEl.innerHTML = '<option value="">통신 오류</option>'; }
    new bootstrap.Modal(document.getElementById('modalPostMoveCopy')).show();
};

async function submitPostMoveCopy() {
    const action = document.querySelector('input[name="postAction"]:checked').value; 
    const targetBoardId = document.getElementById('targetBoardSelect').value;
    if(!targetBoardId) { alert("대상 게시판을 선택해주세요."); return; }
    if(!confirm(`정말 ${action === 'move' ? '이동' : '복사'}하시겠습니까?`)) return;
    try {
        const res = await fetch(`/api/admin/posts/${action}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ post_ids: targetPostIds, target_board_id: parseInt(targetBoardId) }) });
        if (res.ok) { const result = await res.json(); alert(result.message); bootstrap.Modal.getInstance(document.getElementById('modalPostMoveCopy')).hide(); location.reload(); } 
        else { const err = await res.json(); alert("오류: " + err.detail); }
    } catch(e) { alert("작업 중 오류 발생"); }
}
