document.addEventListener('DOMContentLoaded', function() {
    const recAllDay = document.getElementById('recAllDay');
    const recStartTime = document.getElementById('recStartTime');
    const recEndTime = document.getElementById('recEndTime');
    const recurringModalEl = document.getElementById('recurringModal');
    let recurringModalInstance = null;

    if (recurringModalEl) {
        recurringModalInstance = new bootstrap.Modal(recurringModalEl);
    }

    if(recAllDay) {
        recAllDay.addEventListener('change', function() {
            if(this.checked) {
                recStartTime.disabled = true;
                recEndTime.disabled = true;
            } else {
                recStartTime.disabled = false;
                recEndTime.disabled = false;
            }
        });
    }

    document.querySelectorAll('input[name="recType"]').forEach(el => {
        el.addEventListener('change', function() {
            const val = this.value;
            ['areaWeekly', 'areaMonthlyDate', 'areaMonthlyWeekday', 'areaYearly'].forEach(id => {
                document.getElementById(id).classList.add('d-none');
            });
            
            if(val === 'weekly') document.getElementById('areaWeekly').classList.remove('d-none');
            else if(val === 'monthly_date') document.getElementById('areaMonthlyDate').classList.remove('d-none');
            else if(val === 'monthly_weekday') document.getElementById('areaMonthlyWeekday').classList.remove('d-none');
            else if(val === 'yearly') document.getElementById('areaYearly').classList.remove('d-none');
        });
    });

    const btnRecSave = document.getElementById('btnRecSave');
    if(btnRecSave) {
        btnRecSave.addEventListener('click', function() {
            const title = document.getElementById('recTitle').value;
            const password = document.getElementById('recPass').value;
            
            if(!title || !password) { alert("제목과 비밀번호는 필수입니다."); return; }

            const type = document.querySelector('input[name="recType"]:checked').value;
            let val = 0;
            let week = null;
            let isLunar = false;

            if(type === 'weekly') {
                val = parseInt(document.getElementById('recWeeklyVal').value);
            } else if(type === 'monthly_date') {
                val = parseInt(document.getElementById('recMonthlyDateVal').value);
            } else if(type === 'monthly_weekday') {
                val = parseInt(document.getElementById('recMonthlyWeekdayVal').value);
                week = parseInt(document.getElementById('recMonthlyWeekOrder').value);
            } else if(type === 'yearly') {
                val = parseInt(document.getElementById('recYearlyMonth').value);
                week = parseInt(document.getElementById('recYearlyDate').value);
                const calType = document.querySelector('input[name="recCalendarType"]:checked').value;
                if(calType === 'lunar') isLunar = true;
            }

            const data = {
                title: title,
                password: password,
                color: document.getElementById('recColor').value,
                description: document.getElementById('recDesc').value,
                all_day: recAllDay.checked,
                start_time: document.getElementById('recStartTime').value,
                end_time: document.getElementById('recEndTime').value,
                recurrence_type: type,
                recurrence_value: val,
                recurrence_week: week,
                start_date: document.getElementById('recStartDate').value,
                end_date: document.getElementById('recEndDate').value,
                is_lunar: isLunar
            };

            if(!confirm(`[${data.start_date} ~ ${data.end_date}] 기간 동안 일정을 생성하시겠습니까?`)) return;

            fetch('/api/events/recurring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => {
                if(res.ok) return res.json();
                else return res.json().then(err => { throw new Error(err.detail || "실패"); });
            }).then(json => {
                alert(json.message);
                if(window.calendarInstance) window.calendarInstance.refetchEvents();
                DashboardSummary.load();
                if(recurringModalInstance) recurringModalInstance.hide();
            }).catch(err => {
                alert("오류 발생: " + err.message);
            });
        });
    }

    window.openRecurringModal = function() {
        document.getElementById('recTitle').value = '';
        document.getElementById('recDesc').value = '';
        document.getElementById('recPass').value = '';
        
        recAllDay.checked = false;
        document.getElementById('recStartTime').disabled = false;
        document.getElementById('recEndTime').disabled = false;
        
        const today = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(today.getFullYear() + 1);
        
        const startPicker = document.getElementById('recStartDate')._flatpickr;
        const endPicker = document.getElementById('recEndDate')._flatpickr;
        
        if (startPicker) startPicker.setDate(DashboardUtils.toISODate(today));
        if (endPicker) endPicker.setDate(DashboardUtils.toISODate(nextYear));
        
        if(recurringModalInstance) recurringModalInstance.show();
    };
});
