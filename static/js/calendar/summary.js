const DashboardSummary = {
    load: () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayStr = DashboardUtils.toISODate(today);
        const tomorrowStr = DashboardUtils.toISODate(tomorrow);

        document.getElementById('labelToday').innerText = DashboardSummary.formatDateHeader(today);
        document.getElementById('labelTomorrow').innerText = DashboardSummary.formatDateHeader(tomorrow);

        Promise.all([
            fetch('/api/events/').then(res => res.json()),
            fetch(`/api/events/holidays?start=${todayStr}&end=${todayStr}`).then(res => res.json())
        ]).then(([dbEvents, holidayEvents]) => {
            const todayDB = dbEvents.filter(e => e.start.startsWith(todayStr));
            const todayHoliday = holidayEvents.filter(e => e.start.startsWith(todayStr));
            DashboardSummary.render('listToday', [...todayDB, ...todayHoliday]);

            const tomorrowDB = dbEvents.filter(e => e.start.startsWith(tomorrowStr));
            DashboardSummary.render('listTomorrow', tomorrowDB);
        });
    },

    render: (elementId, events) => {
        const el = document.getElementById(elementId);
        if (!events || events.length === 0) {
            el.innerHTML = '<span class="text-secondary opacity-50">일정이 없습니다.</span>';
            return;
        }

        let html = '<ul class="list-unstyled mb-0">';
        events.forEach(e => {
            const color = e.color || e.backgroundColor || '#3788d8';
            const desc = e.extendedProps?.description || e.description || ''; 

            let catName = '';
            if (color && typeof DashboardUtils !== 'undefined' && DashboardUtils.getColorName) {
                catName = DashboardUtils.getColorName(color);
            }

            const displayTitle = catName 
                ? `<span class="text-muted fw-bold me-1">[${catName}]</span>${e.title}` 
                : e.title;

            let timeBadge = '';
            if (e.allDay || e.all_day) {
                timeBadge = `<span class="ms-2 badge bg-secondary text-white border">시간 미정</span>`;
            } else {
                const timeStr = e.start && e.start.length >= 16 ? e.start.substring(11, 16) : '';
                if (timeStr) {
                    timeBadge = `<span class="ms-2 badge bg-light text-dark border">${timeStr}</span>`;
                }
            }

            html += `
                <li class="mb-3">
                    <div class="d-flex align-items-center">
                        <span style="color:${color}; margin-right:8px; font-size: 1.2em;">●</span>
                        <strong style="color:var(--bs-body-color);">${displayTitle}</strong>
                        ${timeBadge}
                    </div>
                    <div class="ms-3 text-secondary mt-1" style="white-space: pre-wrap; font-size: 0.95em;">${desc}</div>
                </li>
            `;
        });
        html += '</ul>';
        el.innerHTML = html;
    },

    formatDateHeader: (date) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
    }
};
