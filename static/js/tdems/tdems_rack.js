let scrollInterval;

function startScroll(direction) {
    const container = document.getElementById('rackContainer');
    stopScroll();
    scrollInterval = setInterval(() => {
        container.scrollLeft += (direction * 15);
    }, 10);
}

function stopScroll() {
    clearInterval(scrollInterval);
}

const slider = document.getElementById('rackContainer');
let isDown = false;
let startX;
let scrollLeft;

slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.style.cursor = 'grabbing';
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
});
slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.style.cursor = 'grab';
});
slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.style.cursor = 'grab';
});
slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 2;
    slider.scrollLeft = scrollLeft - walk;
});

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