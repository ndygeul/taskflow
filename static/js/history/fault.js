const DESC_TEMPLATE = `1.장애발생일시: \n2.장애복구일시: \n3.관련서비스: \n4.장애내용: \n5.조치내용: \n6.장애원인: `;
let currentList = []; let currentPage = 1; const itemsPerPage = 10; let faultChartInstances = {};

function toggleDirectInput(fieldId) {
    const sel = document.getElementById(fieldId + 'Sel'); const grp = document.getElementById(fieldId + 'Group'); const inp = document.getElementById(fieldId);
    if (sel.value === 'DIRECT') { sel.classList.add('d-none'); grp.classList.remove('d-none'); inp.focus(); }
}
function cancelDirectInput(fieldId) {
    const sel = document.getElementById(fieldId + 'Sel'); const grp = document.getElementById(fieldId + 'Group'); const inp = document.getElementById(fieldId);
    grp.classList.add('d-none'); sel.classList.remove('d-none'); sel.value = ""; inp.value = ""; 
}
function getFieldValue(fieldId) {
    const sel = document.getElementById(fieldId + 'Sel');
    if (sel && sel.value !== 'DIRECT' && !sel.classList.contains('d-none')) return sel.value;
    return document.getElementById(fieldId).value;
}
function setFieldValue(fieldId, value) {
    const sel = document.getElementById(fieldId + 'Sel'); const grp = document.getElementById(fieldId + 'Group'); const inp = document.getElementById(fieldId);
    if(!value) { cancelDirectInput(fieldId); return; }
    let exists = Array.from(sel.options).some(opt => opt.value === value && value !== 'DIRECT');
    if(exists) { grp.classList.add('d-none'); sel.classList.remove('d-none'); sel.value = value; inp.value = ''; } 
    else { sel.classList.add('d-none'); sel.value = 'DIRECT'; grp.classList.remove('d-none'); inp.value = value; }
}

document.addEventListener('DOMContentLoaded', () => {
    loadList(1);
    document.getElementById('ftDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('ftDesc').value = DESC_TEMPLATE; 

    document.getElementById('btnSaveFt')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const data = {
            fault_date: document.getElementById('ftDate').value,
            system: getFieldValue('ftSystem'),
            field_name: getFieldValue('ftField'),
            equipment_name: document.getElementById('ftName').value,
            checker: document.getElementById('ftChecker').value || "",
            is_emergency: document.getElementById('ftEmergency').checked,
            description: document.getElementById('ftDesc').value
        };

        if(!data.fault_date || !data.system || !data.field_name || !data.equipment_name) {
            alert("발생일자, 시스템, 분야, 장비명은 필수 입력입니다."); return;
        }

        try {
            const res = await fetch('/fault/api/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            if(res.ok) {
                document.getElementById('ftName').value = '';
                document.getElementById('ftChecker').value = '';
                document.getElementById('ftEmergency').checked = false;
                document.getElementById('ftDesc').value = DESC_TEMPLATE; 
                cancelDirectInput('ftSystem'); cancelDirectInput('ftField');
                loadList(1);
            } else alert("등록 실패");
        } catch(e) { console.error(e); }
    });

    document.getElementById('btnUpdateFt')?.addEventListener('click', updateFault);
    document.getElementById('btnSearch')?.addEventListener('click', () => loadList(1));
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') loadList(1); });
    document.getElementById('btnExportExcel')?.addEventListener('click', () => { window.location.href = `/fault/api/export?search=${encodeURIComponent(document.getElementById('searchInput').value)}`; });

    document.getElementById('btnShowStats')?.addEventListener('click', async () => {
        try {
            const res = await fetch('/fault/api/stats'); const stats = await res.json();
            new bootstrap.Modal(document.getElementById('statsModal')).show();
            Chart.defaults.color = '#adb5bd'; Chart.defaults.font.family = 'Pretendard';
            if(faultChartInstances.sys) faultChartInstances.sys.destroy(); if(faultChartInstances.fld) faultChartInstances.fld.destroy(); if(faultChartInstances.mon) faultChartInstances.mon.destroy();
            const comOpt = { responsive: true, maintainAspectRatio: false };
            faultChartInstances.sys = new Chart(document.getElementById('chartSystem'), { type: 'doughnut', data: { labels: Object.keys(stats.system), datasets: [{ data: Object.values(stats.system), backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#0dcaf0'], borderWidth: 0 }]}, options: comOpt });
            faultChartInstances.fld = new Chart(document.getElementById('chartField'), { type: 'pie', data: { labels: Object.keys(stats.field), datasets: [{ data: Object.values(stats.field), backgroundColor: ['#6f42c1', '#d63384', '#fd7e14', '#198754', '#adb5bd'], borderWidth: 0 }]}, options: comOpt });
            faultChartInstances.mon = new Chart(document.getElementById('chartMonthly'), { type: 'bar', data: { labels: Object.keys(stats.monthly), datasets: [{ label: '장애 건수', data: Object.values(stats.monthly), backgroundColor: '#dc3545', borderRadius: 4 }]}, options: { ...comOpt, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
        } catch(e) { console.error(e); }
    });
});

async function loadList(page = 1) {
    currentPage = page; const searchKw = document.getElementById('searchInput').value;
    try {
        const res = await fetch(`/fault/api/list?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(searchKw)}`, { cache: 'no-store' });
        const data = await res.json();
        const tbody = document.getElementById('faultTableBody');
        document.getElementById('totalCount').textContent = data.total_count; currentList = data.items; 

        if(!data.items || data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="text-muted py-4">조회된 이력이 없습니다.</td></tr>'; renderPagination(0); return; }

        let html = '';
        data.items.forEach((item, index) => {
            const no = data.total_count - ((page - 1) * itemsPerPage) - index;
            const emg = item.is_emergency ? `<span class="badge bg-danger">O</span>` : `<span class="text-muted">-</span>`;
            const descBtn = `<button class="btn btn-outline-info btn-sm py-0 px-2" onclick="openDescModal(${item.id})"><i class="bi bi-card-text me-1"></i>내용 보기</button>`;

            html += `<tr>
                <td>${no}</td><td>${item.fault_date}</td>
                <td><span class="badge bg-secondary bg-opacity-25 text-secondary border">${item.system}</span></td>
                <td>${item.field_name}</td>
                <td class="fw-bold text-center">${item.equipment_name}</td>
                <td>${item.checker || '-'}</td> <td>${emg}</td>
                <td>${descBtn}</td>
                <td>
                    <button class="btn btn-outline-secondary btn-sm py-0 px-2 me-1" onclick="openEditModal(${item.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteFault(${item.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html; renderPagination(data.total_count);
    } catch(e) { console.error(e); }
}

function renderPagination(totalCount) {
    const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
    let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link border-secondary" href="#" onclick="event.preventDefault(); loadList(${currentPage - 1})">이전</a></li>`;
    for(let i = 1; i <= totalPages; i++) {
        const activeClass = currentPage === i ? 'active bg-danger border-danger' : 'border-secondary';
        html += `<li class="page-item"><a class="page-link ${activeClass}" href="#" onclick="event.preventDefault(); loadList(${i})">${i}</a></li>`;
    }
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link border-secondary" href="#" onclick="event.preventDefault(); loadList(${currentPage + 1})">다음</a></li>`;
    document.getElementById('pagination').innerHTML = html;
}

async function deleteFault(id) {
    if(!confirm("이 장애 이력을 삭제하시겠습니까?")) return;
    try {
        const res = await fetch(`/fault/api/${id}`, { method: 'DELETE' });
        if(res.ok) loadList(currentPage); else alert("삭제 실패");
    } catch(e) { console.error(e); }
}

function openDescModal(id) {
    const item = currentList.find(i => i.id === id); if(!item) return;
    document.getElementById('viewDescContent').innerHTML = (item.description && item.description.trim() !== "") ? item.description.replace(/\n/g, '<br>') : '<span class="text-muted">상세 내역이 없습니다.</span>';
    new bootstrap.Modal(document.getElementById('viewDescModal')).show();
}

function openEditModal(id) {
    const item = currentList.find(i => i.id === id); if(!item) return;
    document.getElementById('editFtId').value = item.id;
    document.getElementById('editFtDate').value = item.fault_date;
    setFieldValue('editFtSystem', item.system);
    setFieldValue('editFtField', item.field_name);
    document.getElementById('editFtName').value = item.equipment_name;
    document.getElementById('editFtChecker').value = item.checker || "";
    document.getElementById('editFtEmergency').checked = item.is_emergency;
    document.getElementById('editFtDesc').value = item.description || DESC_TEMPLATE;
    new bootstrap.Modal(document.getElementById('editFtModal')).show();
}

async function updateFault() {
    const id = document.getElementById('editFtId').value;
    const data = {
        fault_date: document.getElementById('editFtDate').value,
        system: getFieldValue('editFtSystem'),
        field_name: getFieldValue('editFtField'),
        equipment_name: document.getElementById('editFtName').value,
        checker: document.getElementById('editFtChecker').value || "",
        is_emergency: document.getElementById('editFtEmergency').checked,
        description: document.getElementById('editFtDesc').value
    };
    try {
        const res = await fetch(`/fault/api/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        if(res.ok) { bootstrap.Modal.getInstance(document.getElementById('editFtModal')).hide(); loadList(currentPage); } 
        else alert("수정 실패");
    } catch(e) { console.error(e); }
}