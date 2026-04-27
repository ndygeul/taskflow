document.addEventListener('DOMContentLoaded', function() {
    let authAction = ''; 
    const authModal = new bootstrap.Modal(document.getElementById('authModal'));

    window.openEditModal = async function() { 
        authAction = 'edit'; 
        try {
            const myToken = sessionStorage.getItem(`journal_token_${currentJournalId}`);
            const res = await fetch(`/journal/api/${currentJournalId}/check-lock`, {
                headers: { 'X-Lock-Token': myToken || '' }
            });
            const data = await res.json();
            
            if (data.locked) {
                alert(`[수정 불가] 현재 다른 근무자가 이 일지를 수정 중입니다.\n\n사용자 IP: ${data.editor_ip}`);
                return; 
            }
            showAuthModal('수정 확인', 'primary');
        } catch (e) { console.error(e); alert("통신 오류"); }
    };

    window.openDeleteModal = function() { authAction = 'delete'; showAuthModal('삭제 확인', 'danger'); };

    function showAuthModal(title, btnClass) {
        document.getElementById('authModalTitle').innerText = title;
        document.getElementById('btnAuthConfirm').className = `btn btn-${btnClass} btn-sm`;
        document.getElementById('authPassword').value = '';
        authModal.show();
        setTimeout(() => document.getElementById('authPassword').focus(), 500);
    }

    document.getElementById('authPassword').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') document.getElementById('btnAuthConfirm').click();
    });

    document.getElementById('btnAuthConfirm').addEventListener('click', async function() {
        const pw = document.getElementById('authPassword').value;
        if (!pw) return;

        try {
            const verifyRes = await fetch(`/journal/api/${currentJournalId}/verify`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ password: pw })
            });
            const verifyData = await verifyRes.json();
            
            if (!verifyRes.ok || !verifyData.valid) {
                alert("비밀번호가 일치하지 않습니다.");
                document.getElementById('authPassword').value = '';
                document.getElementById('authPassword').focus();
                return;
            }

            if (authAction === 'edit') {
                sessionStorage.setItem('edit_password', pw);
                window.location.href = `/journal/edit/${currentJournalId}`;
            } else {
                const delRes = await fetch(`/journal/${currentJournalId}`, {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ password: pw })
                });
                if (delRes.ok) {
                    alert("삭제되었습니다.");
                    window.location.href = "/journal";
                } else {
                    alert("삭제 중 오류가 발생했습니다.");
                }
            }
        } catch(e) {
            console.error(e);
            alert("서버 통신 오류가 발생했습니다.");
        }
    });
});

window.verifySecretPassword = async function(journalId) {
    const pwdInput = document.getElementById('secret-password');
    const pwd = pwdInput.value.trim();
    
    if (!pwd) {
        alert('비밀번호를 입력해주세요.');
        pwdInput.focus();
        return;
    }
    
    try {
        const response = await fetch(`/journal/api/${journalId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        
        const data = await response.json();
        
        if (response.ok && data.valid) {
            document.getElementById('secret-prompt-container').classList.add('d-none');
            document.getElementById('journal-content-container').classList.remove('d-none');
        } else {
            alert('비밀번호가 일치하지 않습니다.');
            pwdInput.value = '';
            pwdInput.focus();
        }
    } catch (error) {
        console.error("비밀번호 확인 오류:", error);
        alert('서버 통신 중 오류가 발생했습니다.');
    }
};