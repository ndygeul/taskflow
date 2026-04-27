let calendarInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    DashboardUtils.initFlatpickr();
    let lunarCal = null;
    try { if (typeof KoreanLunarCalendar !== 'undefined') lunarCal = new KoreanLunarCalendar(); } catch(e) {}
    
    const calendarEl = document.getElementById('calendar');
    let holidayDates = new Set();

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ko',
        height: 'auto',
        dayMaxEvents: true,
        selectable: true,
        editable: true,
        allDayText: '시간미정\n(종일)',
        eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
        slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
        buttonText: { today: '오늘', month: '월간', week: '주간', list: '목록' },

        eventSources: [
            { url: '/api/events/' }, 
            { 
                url: '/api/events/holidays',
                success: function(content) {
                    holidayDates.clear();
                    let processedEvents = content.map(evt => {
                        evt.is_holiday = true;
                        evt.display = 'block'; 
                        if(evt.start) holidayDates.add(evt.start.substring(0, 10));
                        return evt;
                    });
                    setTimeout(updateHolidayColors, 0);
                    return processedEvents; 
                }
            }
        ],

        eventDataTransform: function(eventData) {
            if (eventData.all_day !== undefined) eventData.allDay = eventData.all_day;

            if (eventData.allDay && eventData.end) {
                eventData.originalEnd = eventData.end; 

                let parts = eventData.end.split(' ')[0].split('T')[0].split('-');
                let d = new Date(parts[0], parts[1] - 1, parts[2]);
                d.setDate(d.getDate() + 1);

                let y = d.getFullYear();
                let m = String(d.getMonth() + 1).padStart(2, '0');
                let day = String(d.getDate()).padStart(2, '0');
                
                eventData.end = `${y}-${m}-${day} 00:00`;
            }

            if (eventData.allDay && !eventData.is_holiday) {
                let startDay = eventData.start.split(' ')[0].split('T')[0];
                let origEndDay = eventData.originalEnd ? eventData.originalEnd.split(' ')[0].split('T')[0] : startDay;
                
                if (startDay !== origEndDay) {
                    eventData.display = 'block';     
                } else {
                    eventData.display = 'list-item'; 
                }
            }
            return eventData;
        },

        datesSet: () => setTimeout(updateHolidayColors, 0),
        eventsSet: () => setTimeout(updateHolidayColors, 0),

        dayCellContent: function(arg) {
            let lunarStr = '';
            if (lunarCal) {
                try {
                    const date = arg.date;
                    lunarCal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
                    const lunarData = lunarCal.getLunarCalendar();
                    lunarStr = `${lunarData.month}.${lunarData.day}`;
                } catch(e) {}
            }
            return { 
                html: `<div class="d-flex justify-content-between align-items-center">
                         ${lunarStr ? `<span class="lunar-date">(${lunarStr})</span>` : ''}
                         <span class="fc-daygrid-day-number custom-day-number fw-bolder">${arg.dayNumberText}</span>
                       </div>` 
            };
        },

        eventDidMount: function(info) {
            if (info.event.extendedProps.is_holiday || info.isMirror) return;

            let catName = '';
            const bgColor = info.event.backgroundColor;
            if (bgColor && typeof DashboardUtils !== 'undefined' && DashboardUtils.getColorName) {
                catName = DashboardUtils.getColorName(bgColor);
            }

            if (catName) {
                const titleEl = info.el.querySelector('.fc-event-title');
                if (titleEl) {
                    titleEl.innerHTML = `<span class="fw-bold" style="opacity:0.95;">[${catName}]</span> ` + titleEl.innerHTML;
                }
            }

            if (info.event.allDay) {
                const dotEl = info.el.querySelector('.fc-daygrid-event-dot');
                if (dotEl) {
                    const color = bgColor || '#3788d8';
                    const timeHtml = `<div class="fc-event-time" style="color: ${color}; font-weight: bold; margin-left: 4px; margin-right: 4px;">미정(종일)</div>`;
                    dotEl.insertAdjacentHTML('afterend', timeHtml);
                }
            }

            let desc = info.event.extendedProps.description || '';
            if (desc) desc = desc.replace(/\n/g, "<br>");
            
            const displayTitle = catName ? `[${catName}] ${info.event.title}` : info.event.title;
            
            new bootstrap.Tooltip(info.el, {
                title: `<div style="text-align: left;"><div style="font-weight: 700; margin-bottom: 5px;">제목: ${displayTitle}</div>${desc ? `<hr style="margin: 5px 0; border-color: rgba(255,255,255,0.3);">${desc}` : ''}</div>`,
                placement: 'top', trigger: 'hover', container: 'body', html: true
            });
        },

        customButtons: {
            prevYear: { text: '«', hint: '이전 연도', click: () => calendarInstance.prevYear() },
            nextYear: { text: '»', hint: '다음 연도', click: () => calendarInstance.nextYear() },
            btnAddRecurring: {
                text: '고정 일정 등록',
                click: () => window.openRecurringModal() 
            }
        },
        headerToolbar: {
            left: 'prevYear,prev,next,nextYear today btnAddRecurring',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth'
        },

        select: (info) => DashboardEvents.openCreateModal(info),
        eventClick: (info) => {
            if (!info.event.extendedProps.is_holiday) DashboardEvents.openViewModal(info.event);
        },
        eventDrop: (info) => DashboardEvents.handleEventDrop(info),
        eventResize: (info) => DashboardEvents.handleEventDrop(info),

        eventDragStart: () => document.querySelectorAll('.tooltip').forEach(el => el.remove()),
        eventResizeStart: () => document.querySelectorAll('.tooltip').forEach(el => el.remove())
    });

    calendarInstance.render();
    window.calendarInstance = calendarInstance; 

    DashboardSummary.load();

    function updateHolidayColors() {
        const days = document.querySelectorAll('.fc-day');
        days.forEach(dayEl => {
            const dateStr = dayEl.getAttribute('data-date');
            if (!dateStr) return;
            const numEl = dayEl.querySelector('.custom-day-number');
            if (!numEl) return;
            if (holidayDates.has(dateStr)) {
                numEl.classList.add('holiday-target');
                numEl.style.setProperty('color', '#dc3545', 'important');
            } else {
                numEl.classList.remove('holiday-target');
                numEl.style.removeProperty('color');
            }
        });
    }
});