let openModals = {}; 
const modalContainer = document.getElementById('modal-container');

(function injectMaximizeStyles() {
    const styleId = 'mon-modal-fixed-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        /* 모달 최대화 시 스타일 강제 적용 */
        .mon-modal-window.maximized {
            position: fixed !important;
            top: 56px !important; 
            height: calc(100vh - 56px) !important;
            left: 0 !important;
            width: 100% !important;
            border-radius: 0 !important;
            transform: none !important;
            box-shadow: none !important;
        }
        @media (min-width: 768px) {
            .mon-modal-window.maximized {
                left: 16.666667% !important; 
                width: 83.333333% !important; 
            }
        }
    `;
    document.head.appendChild(style);
})();

function getDerivedPaths(logPath, dateStr) {
    const parts = logPath.split('/');
    const filename = parts.pop(); 
    const namePart = filename.substring(0, filename.lastIndexOf('.')) || filename; 
    const ext = filename.substring(filename.lastIndexOf('.')); 
    const basePath = parts.join('/').replace('/once', ''); 
    
    return {
        daily: `${basePath}/daily/${namePart}_${dateStr}${ext}`
    };
}

function openModal(item) {
    if (openModals[item.id]) {
        const instance = openModals[item.id];
        if (instance.isMinimized) toggleMinimize(item.id);
        bringToFront(instance.element);
        return;
    }
    const modalId = `modal-${item.id}`;
    const modalEl = document.createElement('div');
    modalEl.className = 'mon-modal-window'; 
    modalEl.id = modalId;
    modalEl.style.zIndex = getNextZIndex();

    modalEl.innerHTML = `
        <div class="mon-modal-header-bar">
            <span class="mon-modal-header-title">${item.title} (실시간 상태)</span>
            <div class="window-controls">
                <i class="fas fa-minus window-btn" title="최소화" onclick="event.stopPropagation(); toggleMinimize('${item.id}')"></i>
                <i class="far fa-square window-btn" title="최대화" onclick="event.stopPropagation(); toggleMaximize('${item.id}')"></i>
                <i class="fas fa-times window-btn btn-close" title="닫기" onclick="event.stopPropagation(); closeModal('${item.id}')"></i>
            </div>
        </div>
        <div class="mon-modal-body">
            <div class="mon-modal-controls">
                <input type="date" class="mon-date-input history-date">
                <input type="text" class="mon-date-input keyword-input" placeholder="검색어..." style="width: 150px;">
                <button class="mon-search-btn btn-search">조회</button>
                <button class="mon-search-btn btn-reset">오늘(실시간)</button>
            </div>
            <div class="log-box">Loading...</div>
        </div>
        <div class="mon-modal-footer"></div>`;
    modalContainer.appendChild(modalEl);

    const width = 900; const height = 700;
    const navbar = document.querySelector('.navbar');
    const minTop = navbar ? navbar.offsetHeight : 0;
    const minLeft = 250; 
    
    const availableWidth = window.innerWidth - minLeft;
    const availableHeight = window.innerHeight - minTop;
    let left = minLeft + (availableWidth - width) / 2;
    let top = minTop + (availableHeight - height) / 2;
    
    if (left < minLeft) left = minLeft;
    if (top < minTop) top = minTop;

    modalEl.style.width = `${width}px`; modalEl.style.height = `${height}px`;
    modalEl.style.left = `${left}px`; modalEl.style.top = `${top}px`;
    modalEl.style.transform = 'none';

    const instance = { id: item.id, config: item, element: modalEl, isManualMode: false, isMaximized: false, isMinimized: false, prevRect: null, zIndex: modalEl.style.zIndex };
    openModals[item.id] = instance;
    
    setupWindowEvents(instance);
    bringToFront(modalEl);
    
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    
    modalEl.querySelector('.history-date').value = today;
    loadLogData(instance, false, null); 
}

function closeModal(id) { 
    if (openModals[id]) { 
        openModals[id].element.remove(); 
        delete openModals[id]; 
        rearrangeMinimizedWindows(); 
    } 
}

function bringToFront(el) { 
    const maxZ = getNextZIndex(); 
    el.style.zIndex = maxZ; 
    document.querySelectorAll('.mon-modal-window').forEach(w => w.classList.remove('active')); 
    el.classList.add('active'); 
}

function getNextZIndex() { 
    const windows = document.querySelectorAll('.mon-modal-window'); 
    let max = 1000; 
    windows.forEach(w => { const z = parseInt(window.getComputedStyle(w).zIndex); if (z > max) max = z; }); 
    return max + 1; 
}

function setupWindowEvents(instance) {
    const el = instance.element; 
    const header = el.querySelector('.mon-modal-header-bar');
    
    header.addEventListener('click', (e) => { if (instance.isMinimized) { toggleMinimize(instance.id); } });
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('window-btn') || instance.isMinimized || instance.isMaximized) return;
        bringToFront(el);
        let isDragging = true; 
        const startX = e.clientX; 
        const startY = e.clientY; 
        const rect = el.getBoundingClientRect();
        el.style.transition = 'none'; el.style.transform = 'none'; 
        el.style.top = rect.top + 'px'; el.style.left = rect.left + 'px';
        const initialLeft = rect.left; const initialTop = rect.top;
        const navbar = document.querySelector('.navbar'); 
        const minTop = navbar ? navbar.offsetHeight : 0; 
        const sidebar = document.querySelector('.sticky-sidebar');
        const minLeft = (window.innerWidth >= 768 && sidebar) ? sidebar.offsetWidth : 0;

        function onMouseMove(ev) { 
            if (!isDragging) return; 
            const dx = ev.clientX - startX; const dy = ev.clientY - startY; 
            let newLeft = initialLeft + dx; let newTop = initialTop + dy;
            if (newTop < minTop) newTop = minTop; 
            if (newLeft < minLeft) newLeft = minLeft;
            el.style.left = `${newLeft}px`; el.style.top = `${newTop}px`; 
        }
        function onMouseUp() { isDragging = false; el.style.transition = ''; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    });

    header.addEventListener('dblclick', (e) => { if (!e.target.classList.contains('window-btn')) { toggleMaximize(instance.id); } });

    el.querySelector('.btn-search').onclick = () => { const dateVal = el.querySelector('.history-date').value; if(!dateVal) return alert("날짜를 선택해주세요."); instance.isManualMode = true; loadLogData(instance, false, dateVal); };
    el.querySelector('.btn-reset').onclick = () => { 
        const now = new Date();
        const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        
        el.querySelector('.history-date').value = today; 
        instance.element.querySelector('.keyword-input').value = ''; 
        instance.isManualMode = false; 
        loadLogData(instance, false, null); 
    };
    el.querySelector('.keyword-input').addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') {
            if(instance.isManualMode) filterText(instance);
            else el.querySelector('.btn-search').click();
        }
    });
    el.addEventListener('mousedown', () => bringToFront(el));
}

async function loadLogData(instance, isBackgroundRefresh, targetDate) {
    const logBox = instance.element.querySelector('.log-box');
    const titleSpan = instance.element.querySelector('.mon-modal-header-title');
    const keyword = instance.element.querySelector('.keyword-input').value.trim();
    
    let fetchUrl = "";
    if (targetDate) {
        const dateStr = targetDate.replace(/-/g, ''); 
        const paths = getDerivedPaths(instance.config.logPath, dateStr);
        fetchUrl = paths.daily;
        if(!isBackgroundRefresh) titleSpan.innerText = `${instance.config.title} (${targetDate} 이력)`;
    } else {
        fetchUrl = instance.config.logPath; 
        if(!isBackgroundRefresh) titleSpan.innerText = `${instance.config.title} (실시간 상태)`;
    }

    if(!isBackgroundRefresh) logBox.innerHTML = "데이터를 불러오는 중..."; 
    
    try {
        const res = await fetch(`${fetchUrl}?t=${Date.now()}`);
        if (!res.ok) {
            if(!isBackgroundRefresh) {
                const msg = targetDate ? `<span style='color:#aaa;'>선택하신 일자(${targetDate})의 로그가 없습니다.</span>` : "<span style='color:#aaa;'>로그 데이터가 없습니다.</span>";
                logBox.innerHTML = msg;
            }
            return;
        }
        const textData = await res.text();
        
        if (!targetDate) renderSnapshotLog(logBox, textData); 
        else renderTextLog(logBox, textData, keyword);        
        
    } catch (e) { if(!isBackgroundRefresh) logBox.innerHTML = "<span style='color:#ff1744'>로그 로드 실패</span>"; }
}

function renderSnapshotLog(logBox, text) {
    const lines = text.trim().split('\n');
    if (lines.length === 0) { logBox.innerHTML = "<div style='color:#aaa; text-align:center; padding-top:20px;'>내용 없음</div>"; return; }
    
    const timeLine = lines[0];
    const contentLines = lines.slice(1);
    const isFail = contentLines.length > 0;
    const statusColor = isFail ? '#ff1744' : '#00c853';
    const statusText = isFail ? '[ 장애 발생 ]' : '[ 정상 ]';
    const borderColor = isFail ? '#ff1744' : '#444';

    let html = `<div style="border-bottom: 2px solid ${borderColor}; padding: 15px; margin-bottom: 15px; background: rgba(255,255,255,0.05);">
                    <div style="font-weight:bold; font-size:1.4em; color:${statusColor}; margin-bottom:8px;">${statusText}</div>
                    <div style="color:#aaa; font-family:monospace; font-size:1.1em;"><i class="fas fa-clock me-2"></i>점검 시간: <span style="color:#fff;">${timeLine}</span></div>
                 </div>`;
    
    if (isFail) {
        html += `<div style="padding: 15px; background:#111; border-radius:4px; border: 1px solid #333;">
                    <div style="color:#e0e0e0; font-family:'D2Coding', monospace; white-space:pre-wrap; line-height:1.6; font-size:1.05em;">${contentLines.join('\n')}</div>
                 </div>`;
    } else {
        html += `<div style="padding: 40px; text-align:center; color:#555;">
                    <i class="fas fa-check-circle" style="font-size:3em; margin-bottom:10px; color:#333;"></i><br>특이사항이 없습니다.
                 </div>`;
    }
    logBox.innerHTML = html;
}

function renderTextLog(logBox, text, keyword) {
    if (!text.trim()) {
        logBox.innerHTML = "<div style='color:#aaa; text-align:center; padding-top:20px;'>로그 파일이 비어 있습니다.</div>";
        return;
    }

    const lines = text.trim().split('\n').reverse(); 
    let html = '';
    
    const isTimestampLine = (str) => {
        return /^\[\s*\d{2}\/\d{2}\s+\d{2}:\d{2}(?::\d{2})?\s*\]/.test(str);
    };

    const filteredLines = lines.filter(line => !keyword || line.toLowerCase().includes(keyword.toLowerCase()));

    if (filteredLines.length === 0) {
        if(keyword) logBox.innerHTML = `<div style="color:#aaa; text-align:center; margin-top:20px;">'${keyword}' 검색 결과가 없습니다.</div>`;
        else logBox.innerHTML = `<div style="color:#aaa; text-align:center; margin-top:20px;">표시할 로그가 없습니다.</div>`;
        return;
    }

    filteredLines.forEach((line) => {
        let styledLine = line
            .replace(/\[FAIL\]/g, '<span style="color:#ff1744; font-weight:bold;">[FAIL]</span>')
            .replace(/\[OK\]/g, '<span style="color:#00c853; font-weight:bold;">[OK]</span>');

        const isTime = isTimestampLine(line);
        if (isTime) {
            styledLine = `<span style="color:#ffd54f; font-weight:bold; font-size: 1.05em;">${styledLine}</span>`;
        } else {
            styledLine = styledLine.replace(/^\[(.*?)\]/, '<span style="color:#aaa;">[$1]</span>');
        }

        const borderStyle = isTime ? '1px solid #333' : 'none';
        const paddingStyle = isTime ? '6px 5px 15px 5px' : '6px 5px 0 5px'; 

        html += `<div style="border-bottom: ${borderStyle}; padding: ${paddingStyle}; font-size: 0.95em; color: #ddd; font-family: monospace; line-height:1.4;">${styledLine}</div>`;
    });

    logBox.innerHTML = html;
}

function filterText(instance) {
    const logBox = instance.element.querySelector('.log-box');
    const keyword = instance.element.querySelector('.keyword-input').value.trim().toLowerCase();
    const rows = logBox.querySelectorAll('div');
    rows.forEach(row => {
        if (!keyword || row.textContent.toLowerCase().includes(keyword)) { row.style.display = 'block'; } 
        else { row.style.display = 'none'; }
    });
}

function toggleMaximize(id) {
    const instance = openModals[id]; 
    const el = instance.element;
    if (instance.isMinimized) return; 
    
    if (!instance.isMaximized) {
        instance.prevRect = { 
            top: el.style.top, left: el.style.left, width: el.style.width, height: el.style.height, transform: el.style.transform 
        };
        el.classList.add('maximized'); 
        el.querySelector('.fa-square').className = 'far fa-clone window-btn'; 
        instance.isMaximized = true;
    } else {
        el.classList.remove('maximized'); 
        el.style.borderRadius = '8px';
        el.querySelector('.fa-clone').className = 'far fa-square window-btn';
        if(instance.prevRect) { 
            el.style.top = instance.prevRect.top; 
            el.style.left = instance.prevRect.left; 
            el.style.width = instance.prevRect.width; 
            el.style.height = instance.prevRect.height; 
            el.style.transform = instance.prevRect.transform; 
        }
        instance.isMaximized = false;
    }
    bringToFront(el);
}

function toggleMinimize(id) {
    const instance = openModals[id]; const el = instance.element;
    if (!instance.isMinimized) {
        if (!instance.isMaximized) { instance.prevRect = { top: el.style.top, left: el.style.left, width: el.style.width, height: el.style.height, transform: el.style.transform }; }
        el.classList.add('minimized'); instance.isMinimized = true;
    } else {
        el.classList.remove('minimized'); instance.isMinimized = false;
        el.querySelector('.mon-modal-header-title').classList.remove('blinking');
        if (!instance.isMaximized && instance.prevRect) { el.style.top = instance.prevRect.top; el.style.left = instance.prevRect.left; el.style.width = instance.prevRect.width; el.style.height = instance.prevRect.height; el.style.transform = instance.prevRect.transform; }
        bringToFront(el);
    }
    rearrangeMinimizedWindows();
}

function rearrangeMinimizedWindows() {
    const minimizedWindows = Object.values(openModals).filter(inst => inst.isMinimized).map(inst => inst.element);
    minimizedWindows.forEach((el, index) => { el.style.top = 'auto'; el.style.left = 'auto'; el.style.bottom = '0px'; el.style.right = (20 + (index * 210)) + 'px'; });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('settings-overlay').style.display === 'block') { closeSettingsModal(); return; }
        const windows = Array.from(document.querySelectorAll('.mon-modal-window'));
        if (windows.length > 0) {
            windows.sort((a, b) => {
                const zA = parseInt(window.getComputedStyle(a).zIndex) || 0;
                const zB = parseInt(window.getComputedStyle(b).zIndex) || 0;
                return zB - zA;
            });
            const topWindow = windows[0];
            const id = topWindow.id.replace('modal-', '');
            closeModal(id);
        }
    }
});
