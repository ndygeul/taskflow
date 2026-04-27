window.monitorConfig = [];
const gridContainer = document.getElementById('grid-container');

let cardCache = {}; 
let isUpdateRunning = false; 
let isFirstLoad = true; 

const timerWorkerCode = `
    self.onmessage = function(e) {
        if (e.data === 'start') {
            setInterval(() => {
                self.postMessage('tick');
            }, 10000); 
        }
    };
`;
const timerBlob = new Blob([timerWorkerCode], { type: "application/javascript" });
const timerWorker = new Worker(URL.createObjectURL(timerBlob));

function parseBashLog(text) {
    if (!text || !text.trim()) return [];
    
    const lines = text.trim().split('\n');
    let checkTime = 'Unknown';
    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        const timeMatch = firstLine.match(/\[\s*(.*?)\s*\]/);
        checkTime = timeMatch ? timeMatch[1] : firstLine; 
    }

    let status = 'OK';
    let title = 'Normal Status';
    let msg = 'System Normal';

    if (lines.length > 1) {
        status = 'FAIL';
        title = lines[1].trim(); 
        msg = lines.slice(1).join('<br>'); 
    }

    return [{
        check_time: checkTime,
        status: status,
        msg: msg,
        title: title,
        time: checkTime,
        ip: '-', 
        name: 'BashScript'
    }];
}

function initGrid() {
    loadAudioSettings(); 
    gridContainer.innerHTML = '';
    
    window.monitorConfig.forEach(item => {
        cardCache[item.id] = { lastCheckTime: null, lastStatus: null, lastModifiedHeader: null };

        const card = document.createElement('div');
        card.className = 'mon-card status-none';
        card.id = `card-${item.id}`;
        card.onclick = () => openModal(item);
        card.onmouseenter = (e) => showTooltip(e, item.id);
        card.onmousemove = (e) => moveTooltip(e);
        card.onmouseleave = () => hideTooltip();
        
        card.innerHTML = `
            <div class="mon-card-header">${item.title}<i class="fas fa-minus-circle icon-status" style="font-size:1rem; opacity:0.5;"></i></div>
            <div class="mon-card-status">
                <div class="visual-container" style="display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2em; color: #555;"></i>
                </div>
                <div class="message" style="margin-top: 10px; color:#aaa;">Initializing...</div>
            </div>
            <div class="mon-card-footer">Waiting...</div>`;
        gridContainer.appendChild(card);
    });
    applyInitialVisibility(); 
}

async function fetchAndProcessItem(item) {
    if(!item.logPath) return;

    try {
        const url = `${item.logPath}?t=${Date.now()}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error('Log not found');

        const newLastModified = res.headers.get('Last-Modified');
        const cache = cardCache[item.id];

        if (newLastModified && cache.lastModifiedHeader === newLastModified) {
            return;
        }

        const textData = await res.text();
        const data = parseBashLog(textData);
        
        if (data.length === 0) throw new Error('Empty log');

        const currentData = data[0];

        renderCard(item.id, data);

        cache.lastCheckTime = currentData.check_time;
        cache.lastStatus = currentData.status;
        cache.lastModifiedHeader = newLastModified;

        if (!isFirstLoad && currentData.status === 'FAIL') {
            playAlarmSound();
            const cleanMsg = currentData.msg.replace(/<br>/g, ' ').substring(0, 60);
            showToast(`${item.title} 장애 감지`, cleanMsg + '...'); 
            
            if (!openModals[item.id]) { 
                openModal(item); 
                toggleMinimize(item.id); 
            }
            if (openModals[item.id]) {
                const titleEl = openModals[item.id].element.querySelector('.mon-modal-header-title');
                if(titleEl) titleEl.classList.add('blinking');
            }
        }

        if (openModals[item.id] && !openModals[item.id].isManualMode) {
             if(typeof loadLogData === 'function') {
                 loadLogData(openModals[item.id], true, null);
             }
        }

    } catch (e) {
        if (cardCache[item.id].lastStatus !== 'ERROR') {
            renderCardUnknown(item.id);
            cardCache[item.id].lastStatus = 'ERROR';
        }
    }
}

async function updateStatus() {
    if (isUpdateRunning) return; 
    isUpdateRunning = true;

    const BATCH_SIZE = 3; 
    const DELAY_MS = 100; 
    const items = window.monitorConfig;
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(chunk.map(item => fetchAndProcessItem(item)));
        if (i + BATCH_SIZE < items.length) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    if (isFirstLoad) {
        console.log("System Initialized (Low CPU Mode)");
        isFirstLoad = false;
    }
    isUpdateRunning = false;
}

function renderCard(id, data) {
    const card = document.getElementById(`card-${id}`);
    if(!card) return;
    
    const latestLog = data[0]; 
    const isFail = (latestLog.status === 'FAIL');
    const newStatusStr = isFail ? 'FAIL' : 'OK';
    const prevStatus = card.dataset.currentStatus;

    if (prevStatus !== newStatusStr) {
        card.className = `mon-card ${isFail ? 'status-fail' : 'status-ok'}`;
        card.dataset.currentStatus = newStatusStr;

        const iconHtml = isFail 
            ? `<i class="fas fa-exclamation-triangle" style="font-size: 2.5em; color: #ff1744;"></i>` 
            : `<i class="fas fa-check" style="font-size: 2.8em; color: #00c853;"></i>`;
        
        const msgHtml = isFail 
            ? `<div class="message" style="font-size:0.9em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#ff1744; margin-top: 10px;">${latestLog.title}</div>` 
            : `<div class="message" style="color:#00c853; margin-top: 10px;">System Normal</div>`;

        card.querySelector('.mon-card-status').innerHTML = `
            <div class="visual-container" style="display:flex; align-items:center; justify-content:center;">
                ${iconHtml}
            </div>
            ${msgHtml}`;
    } 
    
    const footer = card.querySelector('.mon-card-footer');
    if (footer.innerText !== `Checked: ${latestLog.check_time}`) {
        footer.innerText = `Checked: ${latestLog.check_time}`;
    }

    card.dataset.logs = JSON.stringify(data);
}

function renderCardUnknown(id) {
    const card = document.getElementById(`card-${id}`);
    if(!card) return;
    if(card.dataset.currentStatus === 'ERROR') return; 

    card.className = 'mon-card status-none';
    card.dataset.currentStatus = 'ERROR';
    card.querySelector('.mon-card-status').innerHTML = `
        <div class="visual-container" style="display:flex; align-items:center; justify-content:center;">
            <i class="fas fa-question-circle" style="font-size: 2.5em; color: #777;"></i>
        </div>
        <div class="message" style="color:var(--text-sub); margin-top:10px;">Log Not Found</div>`;
    card.querySelector('.mon-card-footer').innerText = 'Check Failed';
    delete card.dataset.logs;
}

function playAlarmSound() {
    const audio = document.getElementById('alarm-sound');
    if(audio) { 
        audio.pause(); audio.currentTime = 0; 
        const playPromise = audio.play();
        if (playPromise !== undefined) { playPromise.catch(e => { if(typeof showAudioUnlockButton === 'function') showAudioUnlockButton(); }); }
    }
}

async function startDashboard() {
    try {
        const res = await fetch('/api/config/sys');
        if (!res.ok) throw new Error('설정 로드 실패');
        window.monitorConfig = await res.json();
        if (window.monitorConfig.length === 0) {
            gridContainer.innerHTML = '<div style="color:#aaa; padding:20px;">설정 없음</div>';
            return;
        }
        initGrid(); 
        updateStatus(); 
        timerWorker.onmessage = function(e) { if (e.data === 'tick') updateStatus(); };
        timerWorker.postMessage('start'); 
    } catch (e) {
        console.error("Dashboard Init Error:", e);
        gridContainer.innerHTML = `<div style="color:#ff1744; padding:20px;">Init Error<br>${e.message}</div>`;
    }
}

startDashboard();
