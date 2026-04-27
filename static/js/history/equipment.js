let currentEquipmentList = []; let currentPage = 1; const itemsPerPage = 10; let chartInstances = {}; 

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
    loadEquipmentList(1);
    document.getElementById('eqDate').value = new Date().toISOString().split('T')[0];

    document.getElementById('btnSaveEq')?.addEventListener('click', async () => {
        const data = {
            replace_date: document.getElementById('eqDate').value,
            category: getFieldValue('eqCategory'),
            vendor: getFieldValue('eqVendor'),
            equipment_name: document.getElementById('eqName').value,
            part_name: getFieldValue('eqPart'),
            spec: document.getElementById('eqSpec').value || "",
            quantity: parseInt(document.getElementById('eqQty').value) || 1,
            description: document.getElementById('eqDesc').value || ""
        };
        if(!data.replace_date || !data.equipment_name || !data.category || !data.part_name) { alert("필수 항목 입력!"); return; }
        const res = await fetch('/equipment/api/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        if(res.ok) { 
            document.getElementById('eqName').value = ''; document.getElementById('eqSpec').value = ''; document.getElementById('eqQty').value = '1'; document.getElementById('eqDesc').value = '';
            cancelDirectInput('eqCategory'); cancelDirectInput('eqVendor'); cancelDirectInput('eqPart'); loadEquipmentList(1); 
        }
    });

    document.getElementById('btnUpdateEq')?.addEventListener('click', updateEquipment);
    document.getElementById('btnSearch')?.addEventListener('click', () => loadEquipmentList(1));
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') loadEquipmentList(1); });
    document.getElementById('btnExportExcel')?.addEventListener('click', () => { window.location.href = `/equipment/api/export?search=${encodeURIComponent(document.getElementById('searchInput').value)}`; });

    document.getElementById('btnShowStats')?.addEventListener('click', async () => {
        const res = await fetch('/equipment/api/stats'); const stats = await res.json();
        new bootstrap.Modal(document.getElementById('statsModal')).show();
        Chart.defaults.color = '#adb5bd';
        if(chartInstances.cat) chartInstances.cat.destroy(); if(chartInstances.ven) chartInstances.ven.destroy(); if(chartInstances.mon) chartInstances.mon.destroy();
        const cfg = { responsive: true, maintainAspectRatio: false };
        chartInstances.cat = new Chart(document.getElementById('chartCategory'), { type: 'doughnut', data: { labels: Object.keys(stats.category), datasets: [{ data: Object.values(stats.category), backgroundColor: ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6c757d'], borderWidth: 0 }]}, options: cfg });
        chartInstances.ven = new Chart(document.getElementById('chartVendor'), { type: 'pie', data: { labels: Object.keys(stats.vendor), datasets: [{ data: Object.values(stats.vendor), backgroundColor: ['#6f42c1', '#fd7e14', '#20c997', '#0dcaf0', '#adb5bd'], borderWidth: 0 }]}, options: cfg });
        chartInstances.mon = new Chart(document.getElementById('chartMonthly'), { type: 'bar', data: { labels: Object.keys(stats.monthly), datasets: [{ label: '건수', data: Object.values(stats.monthly), backgroundColor: '#0dcaf0', borderRadius: 4 }]}, options: { ...cfg, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
    });
});

async function loadEquipmentList(page = 1) {
    currentPage = page; const kw = document.getElementById('searchInput').value;
    const res = await fetch(`/equipment/api/list?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(kw)}`, { cache: 'no-store' });
    const data = await res.json();
    const tbody = document.getElementById('equipmentTableBody');
    document.getElementById('totalCount').textContent = data.total_count; currentEquipmentList = data.items;
    if(!data.items || data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="10" class="text-muted py-4">데이터 없음</td></tr>'; renderPagination(0); return; }
    let html = '';
    data.items.forEach((item, index) => {
        const no = data.total_count - ((page - 1) * itemsPerPage) - index;
        const descBtn = `<button class="btn btn-outline-info btn-sm py-0 px-2" onclick="openDescModal(${item.id})"><i class="bi bi-card-text me-1"></i>내용 보기</button>`;
        html += `<tr><td>${no}</td><td>${item.replace_date}</td><td><span class="badge bg-secondary bg-opacity-25 text-secondary border">${item.category}</span></td><td>${item.vendor || '-'}</td><td class="fw-bold text-center">${item.equipment_name}</td><td class="text-info">${item.part_name}</td><td>${item.spec || '-'}</td><td>${item.quantity}</td><td>${descBtn}</td><td><button class="btn btn-outline-secondary btn-sm py-0 px-2 me-1" onclick="openEditModal(${item.id})"><i class="bi bi-pencil"></i></button><button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteEquipment(${item.id})"><i class="bi bi-trash"></i></button></td></tr>`;
    });
    tbody.innerHTML = html; renderPagination(data.total_count);
}

function renderPagination(total) {
    const pages = Math.ceil(total / itemsPerPage) || 1;
    let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link border-secondary" href="#" onclick="event.preventDefault(); loadEquipmentList(${currentPage - 1})">이전</a></li>`;
    for(let i=1; i<=pages; i++) { html += `<li class="page-item"><a class="page-link ${currentPage === i ? 'active bg-primary border-primary' : 'border-secondary'}" href="#" onclick="event.preventDefault(); loadEquipmentList(${i})">${i}</a></li>`; }
    html += `<li class="page-item ${currentPage === pages ? 'disabled' : ''}"><a class="page-link border-secondary" href="#" onclick="event.preventDefault(); loadEquipmentList(${currentPage + 1})">다음</a></li>`;
    document.getElementById('pagination').innerHTML = html;
}

async function deleteEquipment(id) { if(confirm("삭제하시겠습니까?")) { const res = await fetch(`/equipment/api/${id}`, { method: 'DELETE' }); if(res.ok) loadEquipmentList(currentPage); } }

function openDescModal(id) {
    const item = currentEquipmentList.find(eq => eq.id === id); if(!item) return;
    document.getElementById('viewDescContent').innerHTML = item.description ? item.description.replace(/\n/g, '<br>') : '<span class="text-muted">내역 없음</span>';
    new bootstrap.Modal(document.getElementById('viewDescModal')).show();
}

function openEditModal(id) {
    const item = currentEquipmentList.find(eq => eq.id === id); if(!item) return;
    document.getElementById('editEqId').value = item.id; document.getElementById('editEqDate').value = item.replace_date;
    setFieldValue('editEqCategory', item.category); setFieldValue('editEqVendor', item.vendor); setFieldValue('editEqPart', item.part_name);
    document.getElementById('editEqName').value = item.equipment_name; document.getElementById('editEqSpec').value = item.spec || '';
    document.getElementById('editEqQty').value = item.quantity; document.getElementById('editEqDesc').value = item.description || '';
    new bootstrap.Modal(document.getElementById('editEqModal')).show();
}

async function updateEquipment() {
    const id = document.getElementById('editEqId').value;
    const data = { replace_date: document.getElementById('editEqDate').value, category: getFieldValue('editEqCategory'), vendor: getFieldValue('editEqVendor'), equipment_name: document.getElementById('editEqName').value, part_name: getFieldValue('editEqPart'), spec: document.getElementById('editEqSpec').value || "", quantity: parseInt(document.getElementById('editEqQty').value) || 1, description: document.getElementById('editEqDesc').value || "" };
    const res = await fetch(`/equipment/api/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if(res.ok) { bootstrap.Modal.getInstance(document.getElementById('editEqModal')).hide(); loadEquipmentList(currentPage); }
}