let allTargets = [];
let terminalCache = {};
let isUpdateRunning = false;

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

    return [{ check_time: checkTime, status: status, msg: msg, title: title }];
}

async function initTerminal() {
    const sysScreen = document.getElementById('sys-log-output');
    const tmScreen = document.getElementById('tm-log-output');
    
    try {
        const [sysRes, tmRes] = await Promise.all([
            fetch('/api/config/sys'), 
            fetch('/api/config/tm')
        ]);
        
        const sysTargets = await sysRes.json();
        const tmTargets = await tmRes.json();

        sysTargets.forEach(item => item.type = 'sys');
        tmTargets.forEach(item => item.type = 'tm');
        
        allTargets = [...sysTargets, ...tmTargets];

        if (allTargets.length === 0) {
            sysScreen.innerHTML = `<span class="term-error">[ERROR] SYS 설정(JSON)을 불러오지 못했습니다.</span>`;
            tmScreen.innerHTML = `<span class="term-error">[ERROR] TM 설정(JSON)을 불러오지 못했습니다.</span>`;
            return;
        }

        allTargets.forEach(item => {
            terminalCache[item.logPath] = {
                status: 'OK',
                msg: '',
                check_time: ''
            };
        });

        await updateTerminal(); 
        setInterval(updateTerminal, 10000); 

    } catch (e) {
        console.error("Init Error:", e);
    }
}

async function updateTerminal() {
    if (isUpdateRunning) return; 
    isUpdateRunning = true;

    const sysScreen = document.getElementById('sys-log-output');
    const tmScreen = document.getElementById('tm-log-output');
    const sysSummary = document.getElementById('sys-term-summary');
    const tmSummary = document.getElementById('tm-term-summary');

    let sysFail = 0, sysChecked = 0, sysHtmlToAppend = '';
    let tmFail = 0, tmChecked = 0, tmHtmlToAppend = '';

    const BATCH_SIZE = 5;
    for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
        const chunk = allTargets.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(chunk.map(async (item) => {
            if(!item.logPath) return;
            try {
                const res = await fetch(`/api/log?path=${encodeURIComponent(item.logPath)}&t=${Date.now()}`);
                if(!res.ok) return;
                
                const textData = await res.text();

                const isSys = (item.type === 'sys');
                if (isSys) sysChecked++; else tmChecked++;
                
                const data = parseBashLog(textData);
                const currentLog = data.length > 0 ? data[0] : { status: 'OK', msg: '', check_time: new Date().toLocaleTimeString(), title: item.title };

                const cache = terminalCache[item.logPath];
                const prevStatus = cache.status;
                const prevMsg = cache.msg;
                const prevCheckTime = cache.check_time;

                const currentStatus = currentLog.status;
                const currentMsg = currentLog.msg;
                const currentCheckTime = currentLog.check_time;

                if (currentStatus === 'FAIL') {
                    if (isSys) sysFail++; else tmFail++;
                }

                let shouldAppend = false;
                let appendType = '';

                if (currentStatus === 'FAIL') {
                    if (prevStatus !== 'FAIL') {
                        shouldAppend = true; 
                        appendType = 'NEW_FAIL';
                    } else if (prevMsg !== currentMsg || prevCheckTime !== currentCheckTime) {
                        shouldAppend = true; 
                        appendType = 'UPDATE_FAIL';
                    }
                } else if (currentStatus === 'OK' && prevStatus === 'FAIL') {
                    shouldAppend = true; 
                    appendType = 'RECOVERY';
                }

                cache.status = currentStatus;
                cache.msg = currentMsg;
                cache.check_time = currentCheckTime;

                if (shouldAppend) {
                    const cleanMsg = currentLog.msg.replace(/<br>/g, '\n');
                    let logHtml = '';
                    
                    if (appendType === 'NEW_FAIL' || appendType === 'UPDATE_FAIL') {
                        const label = appendType === 'NEW_FAIL' ? '[CRITICAL_FAULT]' : '[FAULT_UPDATED]';
                        logHtml = `
<div class="log-entry" style="margin-bottom: 20px;">
    <div style="color: #555;">--------------------------------------------------</div>
    <div class="term-error">>> ${label} ${item.title}</div>
    <div class="term-warn">>> OCCURRED_TIME  : ${currentLog.check_time}</div>
    <div style="color:#ddd; margin-top:5px; white-space:pre-wrap; font-size:0.95em;">${cleanMsg}</div>
    <div style="color: #555;">--------------------------------------------------</div>
</div>`;
                    } else if (appendType === 'RECOVERY') {
                        logHtml = `
<div class="log-entry" style="margin-bottom: 20px;">
    <div style="color: #555;">--------------------------------------------------</div>
    <div style="color: #00ff00; font-weight: bold;">>> [RECOVERY_OK] ${item.title} 정상 복구됨</div>
    <div style="color: #00c853;">>> RECOVERY_TIME  : ${currentLog.check_time}</div>
    <div style="color: #555;">--------------------------------------------------</div>
</div>`;
                    }

                    if (isSys) sysHtmlToAppend += logHtml;
                    else tmHtmlToAppend += logHtml;
                }
            } catch(e) {
                console.error(`Fetch error for ${item.title}:`, e);
            }
        }));
    }

    const now = new Date().toLocaleTimeString('ko-KR', { hour12: false });

    const updateWindow = (typeStr, screenEl, summaryEl, wrapperId, failCnt, checkCnt, htmlStr) => {
        const summaryColor = failCnt > 0 ? 'term-error' : 'term-info';
        summaryEl.innerHTML = `[${now}] SYSTEM CHECK: <span class="term-info">${checkCnt}</span> TARGETS SCANNED. <span class="${summaryColor}">[ ${failCnt} FAULTS ]</span><span class="blink-cursor">_</span>`;

        if (htmlStr !== '') {
            if (screenEl.innerHTML.includes('Initializing')) screenEl.innerHTML = '';
            screenEl.insertAdjacentHTML('beforeend', htmlStr);

            const logEntries = screenEl.querySelectorAll('.log-entry');
            if (logEntries.length > 100) {
                const excess = logEntries.length - 100;
                for (let i = 0; i < excess; i++) logEntries[i].remove();
            }

            const wrapper = document.getElementById(wrapperId);
            if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
        } 
        else if (screenEl.innerHTML.trim() === '' || screenEl.innerHTML.includes('Initializing')) {
            if (failCnt === 0 && checkCnt > 0) {
                screenEl.innerHTML = `<div class="log-entry" style="color:#00ff00; margin-top:10px;">[INFO] All ${typeStr} systems operational. Monitoring active...</div>`;
            }
        }
    };

    updateWindow('SYS', sysScreen, sysSummary, 'sys-terminal-wrapper', sysFail, sysChecked, sysHtmlToAppend);
    updateWindow('TM', tmScreen, tmSummary, 'tm-terminal-wrapper', tmFail, tmChecked, tmHtmlToAppend);

    isUpdateRunning = false;
}

document.addEventListener("DOMContentLoaded", () => {
    initTerminal();
});