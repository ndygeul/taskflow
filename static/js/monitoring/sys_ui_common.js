function getAudioElements() {
    return {
        audioEl: document.getElementById('alarm-sound'),
        btnMute: document.getElementById('btn-mute'),
        volSlider: document.querySelector('.mon-range') || document.getElementById('vol-slider'),
        volTooltip: document.getElementById('vol-tooltip')
    };
}

function loadAudioSettings() {
    const { audioEl, volSlider } = getAudioElements();
    if (!audioEl) return;
    const savedVol = localStorage.getItem('sys_monitor_volume');
    const savedMute = localStorage.getItem('sys_monitor_muted');
    
    if (savedVol !== null) { audioEl.volume = parseFloat(savedVol); if(volSlider) volSlider.value = savedVol; } 
    else { audioEl.volume = 0.5; if(volSlider) volSlider.value = 0.5; }
    if (savedMute !== null) { audioEl.muted = (savedMute === 'true'); }
    updateMuteUI();
}

function updateMuteUI() { 
    const { audioEl, btnMute } = getAudioElements();
    if(btnMute && audioEl) {
        btnMute.className = (audioEl.muted || audioEl.volume === 0) ? 'fas fa-volume-mute muted' : 'fas fa-volume-up'; 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const { audioEl, btnMute, volSlider, volTooltip } = getAudioElements();
    if(btnMute) {
        btnMute.onclick = () => { if(audioEl) { audioEl.muted = !audioEl.muted; updateMuteUI(); localStorage.setItem('sys_monitor_muted', audioEl.muted); } };
    }
    if(volSlider && audioEl) {
        volSlider.oninput = (e) => {
            const val = e.target.value; audioEl.volume = val;
            if (val > 0 && audioEl.muted) { audioEl.muted = false; updateMuteUI(); localStorage.setItem('sys_monitor_muted', false); }
            localStorage.setItem('sys_monitor_volume', val); showVolTooltip(e, val);
        };
        if(volTooltip) {
            volSlider.addEventListener('mousemove', (e) => showVolTooltip(e, volSlider.value));
            volSlider.addEventListener('mouseleave', () => volTooltip.style.display = 'none');
            volSlider.addEventListener('touchend', () => volTooltip.style.display = 'none');
        }
    }
});

const unlockAudio = () => {
    const { audioEl } = getAudioElements();
    if (audioEl) {
        audioEl.play().then(() => {
            audioEl.pause();
            audioEl.currentTime = 0;
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        }).catch(e => { /* 무시 */ });
    }
};
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

function showVolTooltip(e, val) {
    const volTooltip = document.getElementById('vol-tooltip');
    if(!volTooltip) return;
    const label = '볼륨: ' + Math.round(val * 100);
    volTooltip.innerText = label; volTooltip.style.display = 'block';
    volTooltip.style.left = (e.clientX + 10) + 'px'; volTooltip.style.top = (e.clientY - 30) + 'px';
}

function showToast(title, message) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'mon-toast';
    toast.innerHTML = `<div class="toast-title"><i class="fas fa-exclamation-triangle"></i> ${title}</div><div class="toast-msg">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
}

function showTooltip(e, id) {
    const tooltip = document.getElementById('tooltip');
    const card = document.getElementById(`card-${id}`);
    if (!tooltip || !card) return;
    if (!card.classList.contains('status-fail') || !card.dataset.logs) return; 
    let data; try { data = JSON.parse(card.dataset.logs); } catch(err) { return; }
    const failItems = data.filter(d => d.status === 'FAIL');
    if (failItems.length === 0) return;
    
    let html = `<div style="border-bottom: 1px solid #555; padding-bottom:5px; margin-bottom:5px; font-weight:bold; color:#aaa; font-size: 1.1em;">FAILURE DETAILS (${failItems.length})</div>`;
    
    failItems.forEach((row, index) => {
        const rowTime = row.check_time || row.time; 
        const nextRow = failItems[index + 1];
        const isSameGroup = nextRow ? (nextRow.check_time || nextRow.time) === rowTime : false;
        const borderStyle = isSameGroup ? 'none' : '1px solid #333';
        const paddingStyle = isSameGroup ? '5px 5px 0px 5px' : '5px 5px 15px 5px';
        const titleHtml = row.title ? `<span style="font-size:0.8em; color:#aaa;">(${row.title})</span>` : '';
        
        const infoLine = (row.name === 'BashScript') 
            ? '' 
            : `<div style="color:#fff; font-size: 1.2em; margin-bottom: 3px;">${row.ip} <span style="color:#777;">:</span> ${row.name || ''} ${titleHtml}</div>`;

        html += `<div style="border-bottom: ${borderStyle}; padding: ${paddingStyle}; text-align: left;">
                    <div style="color:#ff1744; font-weight:bold; font-size: 1.3em; margin-bottom: 3px;">[${row.status}]</div>
                    <div style="color:#aaa; font-size: 1.0em; margin-bottom: 3px;">${rowTime || 'Unknown'}</div>
                    ${infoLine}
                    <div style="color:#ffab00; font-size: 1.1em;">${row.msg || ''}</div>
                 </div>`;
    });
    tooltip.innerHTML = html; tooltip.style.display = 'block'; moveTooltip(e); 
}

function moveTooltip(e) {
    const tooltip = document.getElementById('tooltip');
    if(!tooltip) return;
    const offset = 15; let top = e.clientY + offset; let left = e.clientX + offset;
    if (left + 560 > window.innerWidth) left = window.innerWidth - 570;
    if (top + 400 > window.innerHeight) top = window.innerHeight - 410;
    tooltip.style.top = top + 'px'; tooltip.style.left = left + 'px';
}
function hideTooltip() { 
    const tooltip = document.getElementById('tooltip'); if(tooltip) tooltip.style.display = 'none'; 
}

function getVisibilitySettings() { const s = localStorage.getItem('sys_monitor_visibility'); return s ? JSON.parse(s) : {}; }
function saveVisibilitySettings(s) { localStorage.setItem('sys_monitor_visibility', JSON.stringify(s)); }

function openSettingsModal() {
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsList = document.getElementById('settings-list');

    if (!settingsOverlay || !settingsList) {
        console.error("Settings modal elements not found in DOM."); return;
    }
    if(!window.monitorConfig) {
        alert("모니터링 설정 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요."); return;
    }
    
    const current = getVisibilitySettings(); settingsList.innerHTML = '';
    window.monitorConfig.forEach(item => {
        const isChecked = current[item.id] !== false;
        const div = document.createElement('div'); div.className = 'settings-item';
        div.innerHTML = `<span>${item.title}</span><label class="mon-switch"><input type="checkbox" ${isChecked?'checked':''} onchange="toggleCardVisibility('${item.id}', this.checked)"><span class="mon-slider"></span></label>`;
        settingsList.appendChild(div);
    });
    settingsOverlay.style.display = 'block';
}
function closeSettingsModal() { 
    const settingsOverlay = document.getElementById('settings-overlay'); if(settingsOverlay) settingsOverlay.style.display = 'none'; 
}

function toggleCardVisibility(id, isVisible) {
    const s = getVisibilitySettings(); s[id] = isVisible; saveVisibilitySettings(s);
    const card = document.getElementById(`card-${id}`); if(card) card.style.display = isVisible ? 'flex' : 'none';
}

function setAllVisibility(isVisible) {
    const s = {};
    if(window.monitorConfig) {
        window.monitorConfig.forEach(item => {
            s[item.id] = isVisible;
            const card = document.getElementById(`card-${item.id}`);
            if(card) card.style.display = isVisible ? 'flex' : 'none';
        });
    }
    saveVisibilitySettings(s);
    document.querySelectorAll('#settings-list input[type="checkbox"]').forEach(cb => cb.checked = isVisible);
}

function applyInitialVisibility() {
    const s = getVisibilitySettings();
    if(window.monitorConfig) {
        window.monitorConfig.forEach(item => { if(s[item.id]===false) { const c=document.getElementById(`card-${item.id}`); if(c) c.style.display='none'; } });
    }
}

function showAudioUnlockButton() {
    if (sessionStorage.getItem('audio_toast_shown')) return;

    showToast("오디오 권한 대기", "경보음을 활성화하려면 화면 아무 곳이나 한 번 클릭해주세요.");

    sessionStorage.setItem('audio_toast_shown', 'true');
}