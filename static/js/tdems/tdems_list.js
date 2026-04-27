let scrollInterval;

function startScroll(direction) {
    const container = document.getElementById('tableContainer');
    stopScroll();
    scrollInterval = setInterval(() => {
        container.scrollLeft += (direction * 15);
    }, 10);
}

function stopScroll() {
    clearInterval(scrollInterval);
}

function toggleDirectInput(selectElem, inputId, hiddenId) {
    const inputElem = document.getElementById(inputId);
    const hiddenElem = document.getElementById(hiddenId);
    
    if (selectElem.value === 'DIRECT') {
        inputElem.classList.remove('d-none');
        inputElem.focus();
        hiddenElem.value = inputElem.value; 
        
        inputElem.oninput = function() {
            hiddenElem.value = this.value;
        };
    } else {
        inputElem.classList.add('d-none');
        hiddenElem.value = selectElem.value;
    }
}

function prepareSearch() {
    const mappings = [
        {sel: 's_type', dir: 's_type_direct'},
        {sel: 's_f_status', dir: 's_f_status_direct'},
        {sel: 's_purpose', dir: 's_purpose_direct'},
        {sel: 's_team', dir: 's_team_direct'},
        {sel: 's_svc_std', dir: 's_svc_std_direct'},
        {sel: 's_svc_unit', dir: 's_svc_unit_direct'},
        {sel: 's_manuf', dir: 's_manuf_direct'}
    ];

    mappings.forEach(m => {
        const hidden = document.getElementById(m.sel);
        const direct = document.getElementById(m.dir);
        const select = direct.previousElementSibling; 

        if (select.value !== 'DIRECT') {
            hidden.value = select.value;
        } else {
            hidden.value = direct.value;
        }
    });
}

function toggleAll(source) {
    const checkboxes = document.querySelectorAll('.asset-chk');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

function deleteSelected() {
    const checkboxes = document.querySelectorAll('.asset-chk:checked');
    if (checkboxes.length === 0) {
        alert('삭제할 장비를 선택해주세요.');
        return;
    }
    const reason = prompt(checkboxes.length + "건의 장비를 삭제합니다.\n삭제 사유를 입력하세요:");
    if (reason !== null) {
        if (reason.trim() === "") {
            alert("삭제 사유를 반드시 입력해야 합니다.");
            return;
        }
        document.getElementById('deleteReason').value = reason;
        document.getElementById('deleteForm').submit();
    }
}

function openDetailModal(assetId) {
    const modalElement = document.getElementById('assetDetailModal');
    const modal = new bootstrap.Modal(modalElement);
    const contentDiv = document.getElementById('assetDetailContent');
    
    contentDiv.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    document.getElementById('btnModalEdit').href = "/tdems/write?id=" + assetId;
    
    document.getElementById('btnModalDelete').onclick = function() {
        deleteAssetSingle(assetId);
    };

    modal.show();

    fetch(`/tdems/view_content/${assetId}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(html => {
            contentDiv.innerHTML = html;
        })
        .catch(error => {
            contentDiv.innerHTML = '<div class="alert alert-danger">데이터를 불러오는 중 오류가 발생했습니다.</div>';
            console.error('Error:', error);
        });
}

function deleteAssetSingle(assetId) {
    const reason = prompt("이 장비를 삭제합니다.\n삭제 사유를 입력하세요:");
    if (reason !== null) {
        if (reason.trim() === "") {
            alert("삭제 사유를 반드시 입력해야 합니다.");
            return;
        }
        
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/tdems/delete';
        
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.name = 'asset_id';
        idInput.value = assetId;
        
        const reasonInput = document.createElement('input');
        reasonInput.type = 'hidden';
        reasonInput.name = 'reason';
        reasonInput.value = reason;
        
        form.appendChild(idInput);
        form.appendChild(reasonInput);
        document.body.appendChild(form);
        form.submit();
    }
}

function showBarcodeModal(barcodeValue) {
    document.getElementById('barcodeText').innerText = barcodeValue;

    const modalElement = document.getElementById('barcodeModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    try {
        let canvas = document.getElementById('pdf417Canvas');
        let ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        bwipjs.toCanvas('pdf417Canvas', {
            bcid:        'pdf417',
            text:        barcodeValue,
            scale:       3,
            height:      10,
            includetext: false,
            textxalign:  'center',
        });
    } catch (e) {
        console.error('Barcode rendering error:', e);
        document.getElementById('barcodeText').innerText = "바코드 생성 실패";
    }
}

function openManualBarcodeModal() {
    const input = document.getElementById('manualBarcodeInput');
    input.value = '';

    const modal = new bootstrap.Modal(document.getElementById('manualBarcodeModal'));
    modal.show();

    setTimeout(() => input.focus(), 500);
}

function generateManualBarcode() {
    const code = document.getElementById('manualBarcodeInput').value.trim();

    if (!code) {
        alert("코드를 입력해주세요.");
        return;
    }

    const manualModalEl = document.getElementById('manualBarcodeModal');
    const manualModal = bootstrap.Modal.getInstance(manualModalEl);
    manualModal.hide();

    setTimeout(() => {
        showBarcodeModal(code);
    }, 200);
}

let tdemsChartInstances = {};

const pieLabelLinePlugin = {
    id: 'pieLabelLine',
    afterDraw(chart) {
        if (chart.config.type !== 'pie' && chart.config.type !== 'doughnut') return;
        const ctx = chart.ctx;
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);

        let lastRightY = -1000;
        let lastLeftY = 10000;
        const minSpace = 18;

        meta.data.forEach((arc, index) => {
            const value = dataset.data[index];
            if (!value || value <= 0) return;

            const angle = (arc.startAngle + arc.endAngle) / 2;
            const outerRadius = arc.outerRadius;
            const x = arc.x;
            const y = arc.y;

            const startX = x + Math.cos(angle) * outerRadius;
            const startY = y + Math.sin(angle) * outerRadius;

            let midX = x + Math.cos(angle) * (outerRadius + 15);
            let midY = y + Math.sin(angle) * (outerRadius + 15);

            const isRight = Math.cos(angle) >= 0;
            let endX = midX + (isRight ? 15 : -15);
            let endY = midY;

            if (isRight) {
                if (endY < lastRightY + minSpace) endY = lastRightY + minSpace;
                lastRightY = endY;
            } else {
                if (endY > lastLeftY - minSpace) endY = lastLeftY - minSpace;
                lastLeftY = endY;
            }
            midY = endY;

            const textWidth = ctx.measureText(value).width;
            const chartWidth = chart.width;

            if (isRight && endX + textWidth + 10 > chartWidth) {
                endX = chartWidth - textWidth - 10;
                midX = endX - 10;
            }
            if (!isRight && endX - textWidth - 10 < 0) {
                endX = textWidth + 10;
                midX = endX + 10;
            }
            if (endY < 15) { endY = 15; midY = 15; }

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(midX, midY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = '#6c757d'; 
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.font = 'bold 12px Pretendard';
            ctx.fillStyle = '#f8f9fa';
            ctx.textAlign = isRight ? 'left' : 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(value, endX + (isRight ? 4 : -4), endY);
        });
    }
};

Chart.register(ChartDataLabels, pieLabelLinePlugin);

const distinctPalette = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
    '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#0dcaf0',
    '#858796', '#198754', '#dc3545', '#0d6efd', '#ffc107',
    '#6610f2', '#17a2b8', '#28a745', '#fda50f', '#00ced1',
    '#ff69b4', '#cd5c5c', '#4682b4', '#9acd32', '#ba55d3'
];

document.getElementById('btnShowStats')?.addEventListener('click', async () => {
    try {
        const res = await fetch('/tdems/api/stats');
        const stats = await res.json();
        
        new bootstrap.Modal(document.getElementById('statsModal')).show();

        Chart.defaults.color = '#adb5bd';
        Chart.defaults.font.family = 'Pretendard';

        if(tdemsChartInstances.type) tdemsChartInstances.type.destroy();
        if(tdemsChartInstances.manuf) tdemsChartInstances.manuf.destroy();
        if(tdemsChartInstances.status) tdemsChartInstances.status.destroy();

        const pieOptions = { 
            responsive: true, 
            maintainAspectRatio: false,
            layout: { 
                padding: { top: 30, bottom: 20, left: 10, right: 10 } 
            }, 
            plugins: {
                legend: { 
                    position: 'bottom',
                    align: 'center',
                    labels: { 
                        padding: 15,
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                },
                datalabels: { display: false } 
            }
        };

        tdemsChartInstances.type = new Chart(document.getElementById('chartType'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.type),
                datasets: [{
                    data: Object.values(stats.type),
                    backgroundColor: distinctPalette,
                    borderWidth: 0,
                    radius: '70%',
                    hoverOffset: 4
                }]
            },
            options: pieOptions
        });

        tdemsChartInstances.manuf = new Chart(document.getElementById('chartManuf'), {
            type: 'pie',
            data: {
                labels: Object.keys(stats.manufacturer),
                datasets: [{
                    data: Object.values(stats.manufacturer),
                    backgroundColor: distinctPalette,
                    borderWidth: 0,
                    radius: '70%',
                    hoverOffset: 4
                }]
            },
            options: pieOptions
        });

        tdemsChartInstances.status = new Chart(document.getElementById('chartStatus'), {
            type: 'bar',
            data: {
                labels: Object.keys(stats.status),
                datasets: [{
                    label: '장비 대수',
                    data: Object.values(stats.status),
                    backgroundColor: '#0dcaf0',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 30 } }, 
                plugins: { 
                    legend: { display: false },
                    datalabels: {
                        display: true,
                        color: '#dee2e6',
                        anchor: 'end',    
                        align: 'top',     
                        font: { weight: 'bold', size: 12 },
                        formatter: (value) => value > 0 ? value : ''
                    }
                },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        ticks: { stepSize: 1 },
                        grace: '10%' 
                    } 
                }
            }
        });

    } catch(e) { 
        console.error(e); 
        alert('통계 데이터를 불러오는 중 오류가 발생했습니다.'); 
    }
});