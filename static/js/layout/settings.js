let managerSortable = null;
let selectorSortable = null;
let boardModalInstance = null;
let menuModalInstance = null;
let selectorModalInstance = null;
let targetBoardCode = null;

document.addEventListener('DOMContentLoaded', function() {
    const boardModalEl = document.getElementById('boardManagerModal');
    if(boardModalEl) {
        boardModalInstance = new bootstrap.Modal(boardModalEl);
        boardModalEl.addEventListener('show.bs.modal', loadBoardList);
    }
    const menuModalEl = document.getElementById('modalMenuManager');
    if(menuModalEl) menuModalInstance = new bootstrap.Modal(menuModalEl);
    
    const selectorModalEl = document.getElementById('modalBoardSelector');
    if(selectorModalEl) selectorModalInstance = new bootstrap.Modal(selectorModalEl);

    setupMenuEvents();
    
    const btnUpdateBoard = document.getElementById('btnUpdateBoard');
    if(btnUpdateBoard) btnUpdateBoard.addEventListener('click', updateBoard);
    
    const btnUpdateUrlMenu = document.getElementById('btnUpdateUrlMenu');
    if(btnUpdateUrlMenu) btnUpdateUrlMenu.addEventListener('click', updateUrlMenu);

    const editNameInput = document.getElementById('editBoardName');
    if(editNameInput) editNameInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') updateBoard(); });

    if(document.getElementById('btnDeleteConfirm')) {
        document.getElementById('btnDeleteConfirm').addEventListener('click', async function() {
            const pw = document.getElementById('deletePw').value; if(!pw) return alert("비밀번호 입력");
            const res = await fetch(`/api/boards/${targetBoardCode}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
            if(res.ok) { 
                alert("삭제됨"); 
                bootstrap.Modal.getInstance(document.getElementById('modalBoardDelete')).hide(); 
                loadBoardList(); 
                loadNavMenu(); 
                if(typeof currentBoardCode !== 'undefined' && currentBoardCode === targetBoardCode) location.href='/'; 
            } else { alert("오류"); document.getElementById('deletePw').value=''; }
        });
        document.getElementById('deletePw').addEventListener('keypress', (e)=>{if(e.key==='Enter') document.getElementById('btnDeleteConfirm').click()});
    }

    const urlMenuModalEl = document.getElementById('createUrlMenuModal');
    if(urlMenuModalEl) {
        urlMenuModalEl.addEventListener('show.bs.modal', async function() {
            const select = document.getElementById('urlMenuParentId');
            try {
                const res = await fetch('/api/admin/menus');
                if(res.ok) {
                    const menus = await res.json();
                    let html = '<option value="" selected>-- 최상위 그룹 (1차 메뉴) --</option>';
                    menus.forEach(m => html += `<option value="${m.id}">${m.name}</option>`);
                    select.innerHTML = html;
                }
            } catch(e) {}
        });
    }
});

function setupMenuEvents() {
    const linkMenuSetting = document.getElementById('linkMenuSetting');
    if(linkMenuSetting) linkMenuSetting.addEventListener('click', (e) => { e.preventDefault(); if(menuModalInstance) { menuModalInstance.show(); loadAdminMenuList(); } });
    
    const linkBoardSetting = document.getElementById('linkBoardSetting');
    if(linkBoardSetting) linkBoardSetting.addEventListener('click', (e) => { e.preventDefault(); if(boardModalInstance) boardModalInstance.show(); });

    const btnCreateMenu = document.getElementById('btnCreateMenu');
    if(btnCreateMenu) {
        btnCreateMenu.addEventListener('click', async () => {
            const name = document.getElementById('newMenuName').value; const code = document.getElementById('newMenuCode').value;
            if(!name || !code) return alert("입력 필요");
            const res = await fetch('/api/admin/menus', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, code }) });
            if(res.ok) { document.getElementById('newMenuName').value = ''; document.getElementById('newMenuCode').value = ''; loadAdminMenuList(); loadNavMenu(); } else { alert("오류 발생"); }
        });
    }

    const btnCreateUrlMenu = document.getElementById('btnCreateUrlMenu');
    if(btnCreateUrlMenu) {
        btnCreateUrlMenu.addEventListener('click', async () => {
            const name = document.getElementById('urlMenuName').value; 
            const url = document.getElementById('urlMenuLink').value;
            const isExternal = document.getElementById('urlMenuExternal').checked;

            const isSidebar = document.getElementById('locSidebar').checked;
            const parentId = isSidebar ? null : (document.getElementById('urlMenuParentId').value || null);
            
            if(!name || !url) return alert("이름과 URL은 필수입니다.");
            
            try {
                const res = await fetch('/api/admin/menus/url', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({ 
                        name, 
                        url, 
                        parent_id: parentId ? parseInt(parentId) : null, 
                        is_external: isExternal,
                        is_sidebar: isSidebar
                    }) 
                });
                
                if(res.ok) { 
                    alert("생성되었습니다."); 
                    bootstrap.Modal.getInstance(document.getElementById('createUrlMenuModal')).hide();
                    document.getElementById('urlMenuName').value = '';
                    document.getElementById('urlMenuLink').value = '';
                    loadNavMenu(); 
                } else { 
                    alert("생성 실패"); 
                }
            } catch(e) { 
                console.error(e); 
                alert("통신 오류"); 
            }
        });
    }

    const btnCreateBoard = document.getElementById('btnCreateBoard');
    if(btnCreateBoard) {
        btnCreateBoard.addEventListener('click', async () => {
            const name = document.getElementById('newBoardName').value; const code = document.getElementById('newBoardCode').value; const desc = document.getElementById('newBoardDesc').value; const cat = document.getElementById('newBoardCategory').value;
            if(!name || !code) return alert("입력 필요");
            const res = await fetch('/api/boards/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, code, description: desc, category_list: cat }) });
            if(res.ok) { alert("생성됨"); loadBoardList(); loadNavMenu(); document.getElementById('newBoardName').value = ''; document.getElementById('newBoardCode').value = ''; } else { alert("오류 발생"); }
        });
    }

    const btnSaveMenuOrder = document.getElementById('btnSaveMenuOrder');
    if(btnSaveMenuOrder) {
        btnSaveMenuOrder.addEventListener('click', async () => {
            const ids = Array.from(document.getElementById('menuListGroup').children).map(li => parseInt(li.dataset.id));
            const res = await fetch('/api/admin/menus/reorder', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ menu_ids: ids }) });
            if(res.ok) { alert("저장됨"); loadNavMenu(); btnSaveMenuOrder.style.display = 'none'; }
        });
    }

    const btnApplySelection = document.getElementById('btnApplyBoardSelection');
    if(btnApplySelection) {
        btnApplySelection.addEventListener('click', async () => {
            const menuId = document.getElementById('modalBoardSelector').dataset.menuId;
            const checkboxes = document.querySelectorAll('.board-select-chk');
            const promises = [];
            checkboxes.forEach(chk => {
                const boardCode = chk.value; const targetMenuId = chk.checked ? parseInt(menuId) : null; const originalMenuId = chk.dataset.originalMenuId ? parseInt(chk.dataset.originalMenuId) : null;
                if ((chk.checked && originalMenuId !== targetMenuId) || (!chk.checked && originalMenuId == menuId)) {
                    promises.push(fetch(`/api/admin/boards/${boardCode}/menu`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ menu_id: targetMenuId }) }));
                }
            });
            await Promise.all(promises); alert("적용되었습니다."); if(selectorModalInstance) selectorModalInstance.hide(); loadNavMenu(); if(document.getElementById('boardManagerModal').classList.contains('show')) loadBoardList();
        });
    }

    const btnSaveUnassigned = document.getElementById('btnSaveBoardOrderManager');
    if(btnSaveUnassigned) btnSaveUnassigned.addEventListener('click', () => saveBoardOrder('unassignedBoardList', 'btnSaveBoardOrderManager'));

    const btnSaveSelector = document.getElementById('btnSaveBoardOrderSelector');
    if(btnSaveSelector) btnSaveSelector.addEventListener('click', () => saveBoardOrder('currentMenuBoardList', 'btnSaveBoardOrderSelector'));
}

async function loadAdminMenuList() {
    const res = await fetch('/api/admin/menus');
    const menus = await res.json();
    const listGroup = document.getElementById('menuListGroup');
    listGroup.innerHTML = '';
    menus.forEach(menu => {
        const li = document.createElement('li'); li.className = 'list-group-item d-flex justify-content-between align-items-center'; li.dataset.id = menu.id;
        li.innerHTML = `<div class="d-flex align-items-center"><i class="bi bi-list me-3 text-secondary handle" style="cursor:grab;"></i><span class="fw-bold">${menu.name}</span><span class="text-secondary small ms-2">(${menu.code})</span></div><div class="btn-group"><button class="btn btn-outline-primary btn-sm py-0" onclick="openBoardConfig(${menu.id})">게시판 관리</button><button class="btn btn-outline-danger btn-sm py-0" onclick="deleteMenu(${menu.id})">삭제</button></div>`;
        listGroup.appendChild(li);
    });
    new Sortable(listGroup, { handle: '.handle', animation: 150, onEnd: () => document.getElementById('btnSaveMenuOrder').style.display = 'inline-block' });
}

async function loadBoardList() {
    let menuMap = {};
    try { const mRes = await fetch('/api/admin/menus'); if(mRes.ok) (await mRes.json()).forEach(m => menuMap[m.id] = m.name); } catch(e) {}
    const res = await fetch('/api/boards/');
    const boards = await res.json();
    const assignedList = document.getElementById('assignedBoardList');
    const unassignedList = document.getElementById('unassignedBoardList');
    assignedList.innerHTML = ''; unassignedList.innerHTML = '';
    let hasAssigned = false; let hasUnassigned = false;

    boards.forEach(board => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
        li.dataset.id = board.id;

        const iconClass = board.url ? 'bi-link-45deg text-info' : (board.menu_id ? 'bi-check-circle-fill text-success' : 'bi-grip-vertical text-secondary');
        const isUrlMenu = !!board.url;
        const btnEdit = isUrlMenu ? `<button class="btn btn-outline-secondary btn-sm py-0 ms-2 flex-shrink-0" onclick="openUrlMenuEditModal(${board.id}, '${board.name}', '${board.url}', ${board.is_external}, ${board.is_sidebar})"><i class="bi bi-pencil"></i></button>` : `<button class="btn btn-outline-secondary btn-sm py-0 ms-2 flex-shrink-0" onclick="openEditBoardModal(${board.id}, '${board.name}', '${board.description || ''}', '${board.category_list || ''}')"><i class="bi bi-pencil"></i></button>`;
        const btnDelete = `<button class="btn btn-outline-danger btn-sm py-0 ms-1 flex-shrink-0" onclick="deleteBoard('${board.code}')">삭제</button>`;

        if (board.menu_id) {
            hasAssigned = true;
            li.innerHTML = `
                <div class="d-flex align-items-center flex-grow-1" style="min-width: 0;">
                    <i class="bi ${iconClass} me-2 flex-shrink-0 ${isUrlMenu ? '' : 'opacity-50'}"></i>
                    <span class="text-truncate me-2">
                        <strong>${board.name}</strong>
                        <span class="text-secondary small ms-1">(${board.code})</span>
                    </span>
                    <span class="badge bg-secondary bg-opacity-25 text-secondary border flex-shrink-0">${menuMap[board.menu_id] || '분류됨'}</span>
                </div>
                <div class="d-flex align-items-center flex-shrink-0 ms-2">
                    ${btnEdit}${btnDelete}
                </div>`;
            assignedList.appendChild(li);
        } else {
            hasUnassigned = true;
            const isChecked = board.is_visible ? 'checked' : '';
            const textStyle = board.is_visible ? '' : 'text-muted text-decoration-line-through';
            li.innerHTML = `
                <div class="d-flex align-items-center flex-grow-1" style="min-width: 0;">
                    <i class="bi ${iconClass} me-2 handle flex-shrink-0" style="cursor:grab;"></i>
                    <span class="text-truncate ${textStyle} me-2">
                        <strong>${board.name}</strong>
                        <span class="text-secondary small ms-1">(${board.code})</span>
                    </span>
                    <span class="badge bg-light text-dark border flex-shrink-0">미분류</span>
                </div>
                <div class="d-flex align-items-center flex-shrink-0 ms-2">
                    <div class="form-check form-switch m-0 me-2 flex-shrink-0">
                        <input class="form-check-input" type="checkbox" role="switch" onchange="toggleBoardVisibility(${board.id}, this.checked)" ${isChecked}>
                    </div>
                    ${btnEdit}${btnDelete}
                </div>`;
            unassignedList.appendChild(li);
        }
    });

    if (!hasAssigned) assignedList.innerHTML = '<li class="list-group-item text-center text-muted fst-italic small py-2">소속된 항목이 없습니다.</li>';
    if (!hasUnassigned) unassignedList.innerHTML = '<li class="list-group-item text-center text-muted fst-italic small py-2">미분류 항목이 없습니다.</li>';

    if(managerSortable) managerSortable.destroy();
    managerSortable = new Sortable(unassignedList, { handle: '.handle', animation: 150, ghostClass: 'bg-light', onEnd: () => document.getElementById('btnSaveBoardOrderManager').style.display = 'inline-block' });
}

window.openUrlMenuEditModal = function(id, name, url, isExternal, isSidebar) {
    document.getElementById('editUrlMenuId').value = id;
    document.getElementById('editUrlMenuName').value = name;
    document.getElementById('editUrlMenuLink').value = url;
    document.getElementById('editUrlMenuExternal').checked = isExternal;

    if(isSidebar) {
        document.getElementById('editLocSidebar').checked = true;
    } else {
        document.getElementById('editLocTop').checked = true;
    }

    new bootstrap.Modal(document.getElementById('modalUrlMenuEdit')).show();
};
window.openEditBoardModal = function(id, name, desc, category) {
    document.getElementById('editBoardId').value = id; document.getElementById('editBoardName').value = name; document.getElementById('editBoardDesc').value = desc; document.getElementById('editBoardCategory').value = category || '';
    new bootstrap.Modal(document.getElementById('modalBoardEdit')).show();
};
window.deleteMenu = async function(id) { if(confirm("메뉴를 삭제하시겠습니까?")) { const res = await fetch(`/api/admin/menus/${id}`, { method: 'DELETE' }); if(res.ok) { loadAdminMenuList(); loadNavMenu(); } } };
window.deleteBoard = function(code) { targetBoardCode = code; const deleteModal = new bootstrap.Modal(document.getElementById('modalBoardDelete')); deleteModal.show(); setTimeout(() => document.getElementById('deletePw').focus(), 500); };

window.openBoardConfig = async function(menuId) {
    const res = await fetch('/api/boards/'); 
    const boards = await res.json();
    
    const currentList = document.getElementById('currentMenuBoardList');
    const otherList = document.getElementById('otherMenuBoardList');
    currentList.innerHTML = ''; 
    otherList.innerHTML = '';
    
    let currentEmpty = true;
    let otherEmpty = true;

    boards.forEach(board => {
        const isCurrentMenu = (board.menu_id === menuId);
        const isChecked = isCurrentMenu;
        
        let subText = '';
        if (!isCurrentMenu && board.menu_id) {
            subText = '<span class="badge bg-secondary bg-opacity-10 text-secondary border ms-2">타 메뉴</span>';
        } else if (!isCurrentMenu && !board.menu_id) {
            subText = '<span class="badge bg-light text-dark border ms-2">미분류</span>';
        }

        const div = document.createElement('div'); 
        div.className = 'list-group-item d-flex align-items-center p-2'; 
        div.dataset.id = board.id;

        const handleHtml = isCurrentMenu 
            ? `<i class="bi bi-grip-vertical text-secondary me-2 handle" style="cursor:grab;"></i>` 
            : `<i class="bi bi-dash text-secondary opacity-25 me-2 px-1"></i>`;

        div.innerHTML = `${handleHtml}
            <div class="form-check flex-grow-1 m-0">
                <input class="form-check-input board-select-chk" type="checkbox" value="${board.code}" id="chk_${board.id}" data-original-menu-id="${board.menu_id || ''}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label w-100 stretched-link" for="chk_${board.id}">
                    <strong class="${isCurrentMenu ? 'text-primary' : ''}">${board.name}</strong> 
                    <span class="text-secondary small">(${board.code})</span> 
                    ${subText}
                </label>
            </div>`;

        if (isCurrentMenu) {
            currentList.appendChild(div);
            currentEmpty = false;
        } else {
            otherList.appendChild(div);
            otherEmpty = false;
        }
    });

    if (currentEmpty) currentList.innerHTML = '<div class="p-3 text-center text-muted small fst-italic">소속된 게시판이 없습니다.</div>';
    if (otherEmpty) otherList.innerHTML = '<div class="p-3 text-center text-muted small fst-italic">목록이 없습니다.</div>';

    document.getElementById('modalBoardSelector').dataset.menuId = menuId; 
    document.getElementById('btnSaveBoardOrderSelector').style.display = 'none';
    
    if(selectorModalInstance) selectorModalInstance.show(); 
    else new bootstrap.Modal(document.getElementById('modalBoardSelector')).show();

    if(selectorSortable) selectorSortable.destroy();
    selectorSortable = new Sortable(currentList, { 
        handle: '.handle', 
        animation: 150, 
        ghostClass: 'bg-light',
        onEnd: () => document.getElementById('btnSaveBoardOrderSelector').style.display = 'inline-block' 
    });
};

async function updateUrlMenu() {
    const id = document.getElementById('editUrlMenuId').value;
    const name = document.getElementById('editUrlMenuName').value;
    const url = document.getElementById('editUrlMenuLink').value;
    const isExternal = document.getElementById('editUrlMenuExternal').checked;
    const isSidebar = document.getElementById('editLocSidebar').checked;

    if(!name || !url) return alert("이름과 URL은 필수입니다.");
    try {
        const res = await fetch(`/api/admin/menus/url/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, url, is_external: isExternal, is_sidebar: isSidebar })
        });
        if(res.ok) {
            alert("수정되었습니다.");
            bootstrap.Modal.getInstance(document.getElementById('modalUrlMenuEdit')).hide();
            loadBoardList();
            loadNavMenu();
        } else {
            alert("수정 실패");
        }
    } catch(e) {
        console.error(e);
        alert("통신 오류");
    }
}
async function updateBoard() {
    const id = document.getElementById('editBoardId').value; const name = document.getElementById('editBoardName').value; const desc = document.getElementById('editBoardDesc').value; const cat = document.getElementById('editBoardCategory').value;
    if(!name) return alert("게시판 이름을 입력해주세요.");
    try { const res = await fetch(`/api/admin/boards/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, description: desc, category_list: cat }) }); if(res.ok) { alert("수정되었습니다."); bootstrap.Modal.getInstance(document.getElementById('modalBoardEdit')).hide(); loadBoardList(); loadNavMenu(); } else { const err = await res.json(); alert("오류: " + err.detail); } } catch(e) { console.error(e); alert("통신 오류"); }
}
async function toggleBoardVisibility(boardId, isVisible) {
    try { const res = await fetch(`/api/admin/boards/${boardId}/visibility`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ is_visible: isVisible }) }); if (res.ok) { loadNavMenu(); loadBoardList(); } else { alert("실패"); loadBoardList(); } } catch(e) { console.error(e); alert("통신 오류"); }
}
async function saveBoardOrder(elementId, btnId) {
    const ids = Array.from(document.getElementById(elementId).children).map(el => parseInt(el.dataset.id));
    const res = await fetch('/api/admin/boards/reorder', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ board_ids: ids }) });
    if(res.ok) { alert("저장됨"); loadNavMenu(); loadBoardList(); document.getElementById(btnId).style.display = 'none'; } else { alert("실패"); }
}
