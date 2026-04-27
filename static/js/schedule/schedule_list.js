document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();
    document.getElementById('monthSelector').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    loadScheduleData();
    document.getElementById('monthSelector').addEventListener('change', loadScheduleData);
});

async function uploadExcel() {
    const fileInput = document.getElementById('excelFile');
    if (!fileInput.files.length) return;
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch('/schedule/upload', { method: 'POST', body: formData });
        const result = await res.json();
        alert(result.message || result.detail);
        loadScheduleData();
    } catch (error) {
        alert("통신 오류가 발생했습니다.");
    } finally { fileInput.value = ''; }
}

async function loadScheduleData() {
    const val = document.getElementById('monthSelector').value;
    const [year, month] = val.split('-');
    try {
        const res = await fetch(`/schedule/api/data?year=${year}&month=${month}`);
        const json = await res.json();
        renderTable(parseInt(year), parseInt(month), json.data, json.holidays || []);
    } catch(e) { console.error(e); }
}

function renderTable(year, month, data, holidayList) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const table = document.getElementById('scheduleTable');
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

    const todayDate = new Date();
    const isThisMonth = (year === todayDate.getFullYear() && month === (todayDate.getMonth() + 1));
    const todayDay = todayDate.getDate();

    let html = `<colgroup><col class="col-name">`;
    for (let i = 1; i <= daysInMonth; i++) {
        html += `<col style="width:32px;">`; 
    }
    html += `</colgroup>`;

    let dateRow = `<tr><th rowspan="2" class="col-name align-middle">성명</th>`;
    let weekRow = `<tr>`;

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dateObj = new Date(year, month - 1, i);
        const dayIdx = dateObj.getDay();
        
        const isWeekend = (dayIdx === 0 || dayIdx === 6);
        const isHoliday = holidayList.includes(dateStr);
        
        const bgClass = (isWeekend || isHoliday) ? 'bg-holiday' : '';
        const textClass = (dayIdx === 0 || isHoliday) ? 'text-sunday' : (dayIdx === 6 ? 'text-saturday' : '');

        const isToday = isThisMonth && (i === todayDay);
        const topBorderClass = isToday ? 'today-col-top' : '';
        const midBorderClass = isToday ? 'today-col-mid' : '';

        dateRow += `<th class="${bgClass} ${textClass} border-bottom-0 ${topBorderClass}">${i}</th>`;
        weekRow += `<th class="${bgClass} ${textClass} ${midBorderClass}">${dayLabels[dayIdx]}</th>`;
    }
    dateRow += `</tr>`;
    weekRow += `</tr>`;
    html += `<thead>${dateRow}${weekRow}</thead><tbody id="scheduleBody">`;

    let bodyHtml = '';
    const entries = Object.entries(data);

    if (entries.length === 0) {
        bodyHtml = `<tr><td colspan="${daysInMonth + 1}" class="py-5 text-center text-muted">데이터가 없습니다.</td></tr>`;
    } else {
        let rowIndex = 0;
        const totalRows = entries.length;

        for (const [worker, shifts] of entries) {
            const isStatRow = worker.includes("주간") || worker.includes("야간") || worker.includes("인원");
            const rowClass = isStatRow ? 'class="row-stat"' : '';
            
            bodyHtml += `<tr ${rowClass}><td class="col-name">${worker}</td>`;
            
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const shift = (shifts[dateStr] || '').trim();
                const dayIdx = new Date(year, month - 1, i).getDay();
                const isHoliday = holidayList.includes(dateStr);
                const bgClass = (dayIdx === 0 || dayIdx === 6 || isHoliday) ? 'bg-holiday' : '';

                const isToday = isThisMonth && (i === todayDay);
                let borderClass = '';
                if (isToday) {
                    borderClass = (rowIndex === totalRows - 1) ? 'today-col-bottom' : 'today-col-mid';
                }

                let spanClass = '';
                if (!isStatRow) {
                    if (shift === '○') spanClass = 'shift-day';
                    else if (shift === '●') spanClass = 'shift-night';
                    else if (shift === '△') spanClass = 'shift-home';
                    else if (['x', '휴', '대'].includes(shift)) spanClass = 'shift-rest';
                }
                bodyHtml += `<td class="${bgClass} ${borderClass}"><span class="${spanClass}">${shift}</span></td>`;
            }
            bodyHtml += `</tr>`;
            rowIndex++;
        }
    }
    html += `${bodyHtml}</tbody>`;
    table.innerHTML = html;
}