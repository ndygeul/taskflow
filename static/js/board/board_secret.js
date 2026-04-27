document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('accessPassword');
    const btn = document.getElementById('btnCheck');

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', function() {
        const pw = input.value.trim();
        if (!pw) { alert("비밀번호를 입력하세요."); return; }

        const postId = window.currentPostId || window.location.pathname.split('/').pop();

        fetch(`/api/posts/${postId}/access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        }).then(async res => {
            if (res.ok) {
                location.reload();
            } else {
                alert("비밀번호가 일치하지 않습니다.");
                input.value = '';
                input.focus();
            }
        }).catch(() => alert("서버 오류가 발생했습니다."));
    });
});