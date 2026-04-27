document.addEventListener("DOMContentLoaded", () => {
    updateSidebarWorkers();
});

async function updateSidebarWorkers() {
    const dayBadge = document.getElementById('sidebarDayWorkers');
    const nightBadge = document.getElementById('sidebarNightWorkers');

    try {
        const response = await fetch('/schedule/api/today-workers');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();

        if (data.day && data.day.length > 0) {
            dayBadge.innerText = data.day.join(', ');
        } else {
            dayBadge.innerText = '없음';
        }

        if (data.night && data.night.length > 0) {
            nightBadge.innerText = data.night.join(', ');
        } else {
            nightBadge.innerText = '없음';
        }

    } catch (error) {
        console.error("사이드바 근무자 정보 로딩 실패:", error);
        dayBadge.innerText = '에러';
        nightBadge.innerText = '에러';
    }
}
