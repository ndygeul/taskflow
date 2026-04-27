let currentEventData = null;
let eventModalInstance = null;
let viewModalInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    eventModalInstance = new bootstrap.Modal(document.getElementById('eventModal'));
    viewModalInstance = new bootstrap.Modal(document.getElementById('viewModal'));

    document.getElementById('eventAllDay').addEventListener('change', function() {
        const disabled = this.checked;
        document.getElementById('eventStartTime').disabled = disabled;
        document.getElementById('eventEndTime').disabled = disabled;
    });

    document.getElementById('btnSave').addEventListener('click', saveEvent);

    document.getElementById('btnViewEdit').addEventListener('click', function() {
        viewModalInstance.hide();
        DashboardEvents.openEditModal(currentEventData);
    });

    document.getElementById('btnViewDeleteToggle').addEventListener('click', function() {
        const section = document.getElementById('viewDeleteSection');
        if (section.classList.contains('d-none')) {
            section.classList.remove('d-none');
            document.getElementById('viewDeletePass').focus();
        } else {
            section.classList.add('d-none');
        }
    });

    document.getElementById('btnRealDelete').addEventListener('click', () => deleteEventAction(false));
    document.getElementById('btnRealDeleteAll').addEventListener('click', () => deleteEventAction(true));
});

const DashboardEvents = {
    openCreateModal: (info) => {
        resetEditModal();
        document.getElementById('modalTitle').innerText = '일정 등록';
        
        let sDate, sTime, eDate, eTime;
        const chkAllDay = document.getElementById('eventAllDay');

        if (info.allDay) {
            chkAllDay.checked = false; 
            
            sDate = info.startStr;
            const endDateObj = new Date(info.end);
            endDateObj.setDate(endDateObj.getDate() - 1);
            eDate = DashboardUtils.toISODate(endDateObj);
            
            sTime = "09:00";
            eTime = "10:00";
        } else {
            chkAllDay.checked = false;
            const startObj = DashboardUtils.parseDate(info.start);
            const endObj = DashboardUtils.parseDate(info.end);
            sDate = startObj.date; sTime = startObj.time;
            eDate = endObj.date; eTime = endObj.time;
        }
        
        document.getElementById('eventStartTime').disabled = false;
        document.getElementById('eventEndTime').disabled = false;

        setFormValues(sDate, sTime, eDate, eTime);
        eventModalInstance.show();
    },

    openEditModal: (event) => {
        resetEditModal();
        document.getElementById('modalTitle').innerText = '일정 수정';
        document.getElementById('eventId').value = event.id;
        
        const groupId = event.extendedProps.group_id || '';
        document.getElementById('eventGroupId').value = groupId;
        document.getElementById('eventTitle').value = event.title;
        
        if(groupId) document.getElementById('editRecurringOption').classList.remove('d-none');
        else document.getElementById('editRecurringOption').classList.add('d-none');
        
        const isAllDay = event.allDay;
        document.getElementById('eventAllDay').checked = isAllDay;
        
        document.getElementById('eventStartTime').disabled = isAllDay;
        document.getElementById('eventEndTime').disabled = isAllDay;

        let sDate, sTime, eDate, eTime;
        if (event.start) {
            const startObj = DashboardUtils.parseDate(event.start);
            sDate = startObj.date; sTime = startObj.time;
        }
        
        if (event.end) {
            if (isAllDay) {
                let origEnd = event.extendedProps.originalEnd;
                if (!origEnd) {
                    let d = new Date(event.end);
                    d.setDate(d.getDate() - 1);
                    
                    let y = d.getFullYear();
                    let m = String(d.getMonth() + 1).padStart(2, '0');
                    let day = String(d.getDate()).padStart(2, '0');
                    origEnd = `${y}-${m}-${day}`;
                }
                eDate = origEnd.split('T')[0].split(' ')[0];
                eTime = "00:00"; 
            } else {
                const endObj = DashboardUtils.parseDate(event.end);
                eDate = endObj.date; eTime = endObj.time;
            }
        } else {
             eDate = sDate; eTime = sTime;
        }

        setFormValues(sDate, sTime, eDate, eTime);
        document.getElementById('eventColor').value = event.backgroundColor;
        document.getElementById('eventDesc').value = event.extendedProps.description || '';
        eventModalInstance.show();
    },

    openViewModal: (event) => {
        currentEventData = event;
        document.getElementById('viewEventTitle').innerText = event.title;
        
        let timeStr = '';
        if (event.allDay) {
            timeStr = '시간미정 (종일)';
        } else {
            const s = event.start;
            const e = event.end || s;
            timeStr = DashboardUtils.formatDateTime(s) + ' ~ ' + DashboardUtils.formatDateTime(e);
        }
        document.getElementById('viewEventTime').innerText = timeStr;

        const color = event.backgroundColor;
        const badgeEl = document.getElementById('viewEventBadge');
        badgeEl.style.backgroundColor = color;
        badgeEl.innerText = DashboardUtils.getColorName(color);

        const desc = event.extendedProps.description;
        document.getElementById('viewEventDesc').innerText = desc ? desc : '(내용 없음)';
        
        const groupId = event.extendedProps.group_id;
        const recBadge = document.getElementById('viewEventRecBadge');
        const btnDeleteAll = document.getElementById('btnRealDeleteAll');
        
        if(groupId) {
            recBadge.classList.remove('d-none');
            btnDeleteAll.classList.remove('d-none');
        } else {
            recBadge.classList.add('d-none');
            btnDeleteAll.classList.add('d-none');
        }
        
        document.getElementById('viewDeleteSection').classList.add('d-none');
        document.getElementById('viewDeletePass').value = '';
        viewModalInstance.show();
    },

        handleEventDrop: (info) => {
        if (info.event.extendedProps.is_holiday) { info.revert(); return; }
        const password = prompt("일정을 변경하려면 비밀번호를 입력하세요:");
        if (!password) { info.revert(); return; }

        let endStr = DashboardUtils.toISODateTime(info.event.end || info.event.start);

        if (info.event.allDay && info.event.end) {
            let d = new Date(info.event.end);
            d.setDate(d.getDate() - 1);
            
            let y = d.getFullYear();
            let m = String(d.getMonth() + 1).padStart(2, '0');
            let day = String(d.getDate()).padStart(2, '0');
            endStr = `${y}-${m}-${day} 00:00`;
        }

        const eventData = {
            title: info.event.title,
            description: info.event.extendedProps.description,
            color: info.event.backgroundColor,
            all_day: info.event.allDay,
            start: DashboardUtils.toISODateTime(info.event.start), 
            end: endStr,
            password: password
        };

        updateEventAPI(info.event.id, eventData)
            .then(() => console.log("Drag updated"))
            .catch(err => { alert("오류: " + err.message); info.revert(); });
    }
};

function setFormValues(sDate, sTime, eDate, eTime) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el._flatpickr) el._flatpickr.setDate(val);
        else el.value = val;
    };
    setVal('eventStartDate', sDate);
    setVal('eventStartTime', sTime);
    setVal('eventEndDate', eDate);
    setVal('eventEndTime', eTime);
}

function resetEditModal() {
    document.getElementById('modalTitle').innerText = '일정 등록';
    document.getElementById('eventId').value = '';
    document.getElementById('eventGroupId').value = '';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDesc').value = '';
    document.getElementById('eventPass').value = '';
    
    document.getElementById('eventAllDay').checked = false;
    document.getElementById('eventStartTime').disabled = false;
    document.getElementById('eventEndTime').disabled = false;
    
    setFormValues('', '', '', '');
    
    document.getElementById('editRecurringOption').classList.add('d-none');
    document.getElementById('chkEditAll').checked = false;
}

function saveEvent() {
    const id = document.getElementById('eventId').value;
    const groupId = document.getElementById('eventGroupId').value;
    const password = document.getElementById('eventPass').value;
    const isAllDay = document.getElementById('eventAllDay').checked;
    const isEditAll = document.getElementById('chkEditAll').checked;
    
    if(!document.getElementById('eventTitle').value) { alert("제목을 입력하세요."); return; }
    if(!password) { alert("비밀번호를 입력하세요."); return; }
    
    const sDate = document.getElementById('eventStartDate').value;
    const sTime = document.getElementById('eventStartTime').value;
    const eDate = document.getElementById('eventEndDate').value;
    const eTime = document.getElementById('eventEndTime').value;

    if(!isAllDay && (!sDate || !sTime)) { alert("시작 날짜와 시간은 필수입니다."); return; }

    let startStr, endStr;
    if (isAllDay) {
         startStr = (sDate || DashboardUtils.toISODate(new Date())) + ' 00:00';
         endStr = (eDate || sDate) + ' 00:00'; 
    } else {
         startStr = sDate + ' ' + sTime;
         endStr = (eDate || sDate) + ' ' + (eTime || sTime);
    }

    const eventData = {
        title: document.getElementById('eventTitle').value,
        start: startStr,
        end: endStr,
        all_day: isAllDay,
        description: document.getElementById('eventDesc').value,
        color: document.getElementById('eventColor').value,
        password: password
    };

    let url = '/api/events/';
    let method = 'POST';

    if(id) {
        method = 'PUT';
        if(isEditAll && groupId) url = '/api/events/group/' + groupId;
        else url = '/api/events/' + id;
    }

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
    }).then(res => {
        if(res.ok) return res.json();
        else return res.json().then(err => { throw new Error(err.detail || "실패"); });
    }).then(json => {
        if(json.message) alert(json.message);
        if(window.calendarInstance) window.calendarInstance.refetchEvents();
        DashboardSummary.load();
        eventModalInstance.hide();
    }).catch(err => {
        alert("오류 발생: " + err.message);
    });
}

function deleteEventAction(isAll) {
    const password = document.getElementById('viewDeletePass').value;
    if (!password) { alert("비밀번호를 입력하세요."); return; }
    
    const id = currentEventData.id;
    const groupId = currentEventData.extendedProps.group_id;
    
    if(isAll && !groupId) { alert("반복 일정이 아닙니다."); return; }

    const url = isAll ? `/api/events/group/${groupId}` : `/api/events/${id}`;
    const msg = isAll ? "이 반복 일정을 모두 삭제하시겠습니까?" : "이 일정을 삭제하시겠습니까?";

    if(confirm(msg)) {
        fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        }).then(res => {
            if(res.ok) { return res.json(); }
            else { return res.json().then(err => { throw new Error(err.detail || "오류"); }); }
        }).then(json => {
            alert(json.message);
            if(window.calendarInstance) window.calendarInstance.refetchEvents();
            DashboardSummary.load();
            viewModalInstance.hide();
        }).catch(err => {
            alert("오류 발생: " + err.message);
        });
    }
}

function updateEventAPI(id, data) {
    return fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.detail || "수정 실패"); });
        return res.json();
    });
}