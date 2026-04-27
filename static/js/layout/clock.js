const SharedClock = {
    alarms: [],
    audio: null,
    ringModal: null,
    managerModal: null,
    isRinging: false,
    syncInterval: null,

    init: function() {
        this.audio = document.getElementById('alarmAudio');
        
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        this.syncAlarms();
        this.syncInterval = setInterval(() => this.syncAlarms(), 60000); 

        const ringEl = document.getElementById('modalAlarmRing');
        if(ringEl) this.ringModal = new bootstrap.Modal(ringEl);
        
        const managerEl = document.getElementById('modalAlarmManager');
        if(managerEl) {
            this.managerModal = new bootstrap.Modal(managerEl);
            managerEl.addEventListener('show.bs.modal', () => this.renderManagerList());
        }
    },

    updateClock: function() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
        const clockEl = document.getElementById('digitalClock');
        if(clockEl) clockEl.innerText = timeStr;

        const yearEl = document.getElementById('led-year');
        const monthEl = document.getElementById('led-month');
        const dayEl = document.getElementById('led-day');

        if(yearEl) yearEl.innerText = now.getFullYear();
        if(monthEl) monthEl.innerText = String(now.getMonth() + 1).padStart(2, '0');
        if(dayEl) dayEl.innerText = String(now.getDate()).padStart(2, '0');

        const dayIndex = now.getDay();
        for(let i=0; i<7; i++) {
            const el = document.getElementById(`day-${i}`);
            if(el) {
                if(i === dayIndex) el.classList.add('led-active');
                else el.classList.remove('led-active');
            }
        }

        if (now.getSeconds() === 0) {
            const currentHM = timeStr.substring(0, 5);
            this.checkAlarm(currentHM, String(dayIndex));
        }
    },

    syncAlarms: async function() {
        try {
            const res = await fetch('/api/alarms/');
            if(res.ok) {
                this.alarms = await res.json();
                if(document.getElementById('modalAlarmManager') && document.getElementById('modalAlarmManager').classList.contains('show')) {
                    this.renderManagerList();
                }
            }
        } catch(e) { console.error("알람 동기화 실패", e); }
    },

    checkAlarm: function(currentTime, currentDayIndex) {
        if (this.isRinging) return; 

        const target = this.alarms.find(a => {
            if (!a.is_active || a.time !== currentTime) return false;

            if (a.repeat_type === 'WEEKLY') {
                if (!a.repeat_days || !a.repeat_days.split(',').includes(currentDayIndex)) return false;
            }
            return true;
        });

        if (target) {
            this.trigger(target);
        }
    },

    trigger: function(alarm) {
        this.isRinging = true;
        document.getElementById('ringMessage').innerText = alarm.name;
        
        this.audio.currentTime = 0;
        this.audio.volume = 1.0;
        this.audio.play().catch(e => console.warn("자동 재생 차단됨 (클릭 필요)", e));
        
        this.ringModal.show();
    },

    stop: function() {
        this.isRinging = false;
        this.audio.pause();
        this.audio.currentTime = 0;
        this.ringModal.hide();
    },

    add: async function() {
        const time = document.getElementById('newAlarmTime').value;
        const name = document.getElementById('newAlarmName').value;
        const repeatType = document.querySelector('input[name="repeatType"]:checked').value;
        let repeatDays = "";

        if (repeatType === 'WEEKLY') {
            const checked = Array.from(document.querySelectorAll('.repeat-day-chk:checked')).map(cb => cb.value);
            if (checked.length === 0) return alert("반복할 요일을 하나 이상 선택하세요.");
            repeatDays = checked.join(',');
        }

        if(!time || !name) return alert("시간과 내용을 입력하세요.");
        
        try {
            const res = await fetch('/api/alarms/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ time, name, repeat_type: repeatType, repeat_days: repeatDays })
            });
            if(res.ok) {
                document.getElementById('newAlarmName').value = '';
                document.querySelectorAll('.repeat-day-chk').forEach(cb => cb.checked = false);
                await this.syncAlarms();
            }
        } catch(e) { alert("저장 실패"); }
    },

    delete: async function(id) {
        if(!confirm("이 알람을 삭제하시겠습니까? (모든 근무자에게 삭제됨)")) return;
        await fetch(`/api/alarms/${id}`, { method: 'DELETE' });
        await this.syncAlarms();
    },

    toggle: async function(id, isActive) {
        await fetch(`/api/alarms/${id}/toggle`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ is_active: isActive })
        });
        await this.syncAlarms();
    },

    renderManagerList: function() {
        const list = document.getElementById('alarmListGroup');
        list.innerHTML = '';
        
        if(this.alarms.length === 0) {
            list.innerHTML = '<li class="list-group-item text-center text-muted small border-secondary bg-dark">등록된 알람이 없습니다.</li>';
            return;
        }

        const dayMap = {'0':'일', '1':'월', '2':'화', '3':'수', '4':'목', '5':'금', '6':'토'};

        this.alarms.forEach(alarm => {
            let repeatBadge = '<span class="badge bg-secondary me-2">매일</span>';
            if(alarm.repeat_type === 'WEEKLY' && alarm.repeat_days) {
                const daysStr = alarm.repeat_days.split(',').map(d => dayMap[d]).join(',');
                repeatBadge = `<span class="badge bg-info text-dark me-2">${daysStr}</span>`;
            }

            const li = document.createElement('li');
            li.className = `list-group-item d-flex justify-content-between align-items-center bg-dark border-secondary ${alarm.is_active ? 'text-white' : 'text-secondary'}`;
            li.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="form-check form-switch m-0 me-3">
                        <input class="form-check-input" type="checkbox" role="switch" 
                               onchange="toggleAlarm(${alarm.id}, this.checked)" ${alarm.is_active ? 'checked' : ''}>
                    </div>
                    <div class="d-flex align-items-center">
                        ${repeatBadge}
                        <span class="${alarm.is_active ? 'fw-bold' : 'text-decoration-line-through opacity-50'} fs-5 me-3" style="font-family:'D2Coding';">${alarm.time}</span>
                        <span class="${alarm.is_active ? '' : 'opacity-50'}">${alarm.name}</span>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteAlarm(${alarm.id})"><i class="bi bi-trash"></i></button>
            `;
            list.appendChild(li);
        });
    }
};

window.toggleRepeatDays = function() {
    const isWeekly = document.getElementById('repeatWeekly').checked;
    const wrapper = document.getElementById('repeatDaysWrapper');
    if(isWeekly) {
        wrapper.style.setProperty('display', 'flex', 'important');
    } else {
        wrapper.style.setProperty('display', 'none', 'important');
    }
}

document.addEventListener('DOMContentLoaded', () => SharedClock.init());
window.openAlarmManager = () => SharedClock.managerModal.show();
window.stopAlarm = () => SharedClock.stop();
window.addAlarm = () => SharedClock.add();
window.deleteAlarm = (id) => SharedClock.delete(id);
window.toggleAlarm = (id, checked) => SharedClock.toggle(id, checked);