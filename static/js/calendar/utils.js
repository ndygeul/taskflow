const DashboardUtils = {
    toISODate: (dateObj) => {
        if (!dateObj) return null;
        const offset = dateObj.getTimezoneOffset() * 60000;
        const local = new Date(dateObj.getTime() - offset);
        return local.toISOString().split('T')[0];
    },

    toISODateTime: (dateObj) => {
        if (!dateObj) return null;
        const offset = dateObj.getTimezoneOffset() * 60000;
        const local = new Date(dateObj.getTime() - offset);
        return local.toISOString().slice(0, 16).replace('T', ' ');
    },

    parseDate: (dateObj) => {
        const offset = dateObj.getTimezoneOffset() * 60000;
        const local = new Date(dateObj.getTime() - offset);
        const iso = local.toISOString(); 
        return {
            date: iso.substring(0, 10),
            time: iso.substring(11, 16)
        };
    },

    formatDateTime: (date) => {
        const p = DashboardUtils.parseDate(date); 
        return p.date + ' ' + p.time;
    },

    formatDate: (date) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
    },

    getColorName: (hex) => {
        switch(hex) {
            case '#3788d8': return '기본';
            case '#dc3545': return '중요';
            case '#198754': return '작업';
            case '#fd7e14': return '팀작업';
            case '#6f42c1': return '정기배포';
            case '#0dcaf0': return '정기점검';
            case '#6c757d': return '연차/휴가';
            case '#ffc107': return '기타';
            default: return '기타';
        }
    },

    initFlatpickr: () => {
        if (typeof flatpickr !== 'undefined') {
            flatpickr(".flatpickr-time", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, locale: "ko" });
            flatpickr(".flatpickr-date", { dateFormat: "Y-m-d", locale: "ko" });
        }
    }
};
