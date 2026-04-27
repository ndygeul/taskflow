async function checkAdminStatus() {
    try {
        const res = await fetch('/api/admin/status');
        const data = await res.json();
        const group = document.getElementById('adminMenuGroup');
        const btn = document.getElementById('btnAdminToggle');

        if (data.is_logged_in) {
            group.classList.remove('d-none');
            btn.classList.replace('btn-outline-secondary', 'btn-danger');
            btn.innerHTML = '<i class="bi bi-box-arrow-right"></i> 관리자 해제';
        } else {
            group.classList.add('d-none');
            btn.classList.replace('btn-danger', 'btn-outline-secondary');
            btn.innerHTML = '<i class="bi bi-gear-fill"></i> 관리자';
        }
        return data;
    } catch (e) { return { is_initialized: false, is_logged_in: false }; }
}

function setupAdminEvents() {
    const btnAdminToggle = document.getElementById('btnAdminToggle');
    if (btnAdminToggle) {
        btnAdminToggle.addEventListener('click', function() {
            const isLogged = !document.getElementById('adminMenuGroup').classList.contains('d-none');
            if (isLogged) {
                if(confirm("관리자 모드를 종료하시겠습니까?")) fetch('/api/admin/logout', { method: 'POST' }).then(() => { location.reload(); });
            } else {
                checkAdminStatus().then(status => {
                    if (!status.is_initialized) {
                        new bootstrap.Modal(document.getElementById('modalAdminInit')).show();
                    } else {
                        const loginModal = new bootstrap.Modal(document.getElementById('modalAdminLogin'));
                        loginModal.show();
                        setTimeout(()=>document.getElementById('loginPw').focus(), 500);
                    }
                });
            }
        });
    }

    const btnLoginSubmit = document.getElementById('btnLoginSubmit');
    if(btnLoginSubmit) {
        const action = async () => {
            const pw = document.getElementById('loginPw').value; if (!pw) return;
            const res = await fetch('/api/admin/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password: pw }) });
            if (res.ok) { 
                bootstrap.Modal.getInstance(document.getElementById('modalAdminLogin')).hide(); 
                checkAdminStatus(); 
                window.dispatchEvent(new CustomEvent('admin:login'));
            } else { alert("비밀번호 오류"); document.getElementById('loginPw').value=''; document.getElementById('loginPw').focus(); }
        };
        btnLoginSubmit.addEventListener('click', action);
        document.getElementById('loginPw').addEventListener('keypress', (e)=>{if(e.key==='Enter') action()});
    }

    const btnInitSubmit = document.getElementById('btnInitSubmit');
    if(btnInitSubmit) {
        btnInitSubmit.addEventListener('click', async function() {
            const pw = document.getElementById('initPw').value; const pwConfirm = document.getElementById('initPwConfirm').value;
            if (pw !== pwConfirm) { alert("비밀번호 불일치"); return; }
            const res = await fetch('/api/admin/init', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password: pw, confirm_password: pwConfirm }) });
            if (res.ok) { alert("설정 완료."); bootstrap.Modal.getInstance(document.getElementById('modalAdminInit')).hide(); checkAdminStatus(); }
        });
    }

    const btnChangePwSubmit = document.getElementById('btnChangePwSubmit');
    if(btnChangePwSubmit) {
        btnChangePwSubmit.addEventListener('click', async function() {
            const cur = document.getElementById('currentPw').value; const newP = document.getElementById('newPw').value; const conf = document.getElementById('newPwConfirm').value;
            if(newP !== conf) { alert("새 비밀번호 불일치"); return; }
            const res = await fetch('/api/admin/change-password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ current_password: cur, new_password: newP, confirm_password: conf }) });
            if(res.ok) { alert("변경 완료"); bootstrap.Modal.getInstance(document.getElementById('modalAdminChangePw')).hide(); } else { const err = await res.json(); alert(err.detail); }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkAdminStatus();
    setupAdminEvents();

    const linkChangePw = document.getElementById('linkChangePw');
    if(linkChangePw) linkChangePw.addEventListener('click', (e) => { e.preventDefault(); new bootstrap.Modal(document.getElementById('modalAdminChangePw')).show(); });
});
