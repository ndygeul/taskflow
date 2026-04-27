document.querySelectorAll('.search-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.search-filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const target = this.getAttribute('data-target');
        const sections = document.querySelectorAll('.search-section');

        if (target === 'all') {
            sections.forEach(s => s.style.display = 'block');
        } else {
            sections.forEach(s => {
                if (s.id === 'section-' + target.split('-')[1]) {
                    s.style.display = 'block';
                } else {
                    s.style.display = 'none';
                }
            });
        }
    });
});

async function changePage(boardCode, direction) {
    const listContainer = document.getElementById(`list-${boardCode}`);
    const controls = document.getElementById(`controls-${boardCode}`);
    const currPageEl = controls.querySelector('.curr-page');
    const totalPageEl = controls.querySelector('.total-page');
    const btnPrev = controls.querySelector('.btn-prev');
    const btnNext = controls.querySelector('.btn-next');

    let currentPage = parseInt(currPageEl.innerText);
    const totalPage = parseInt(totalPageEl.innerText);
    const newPage = currentPage + direction;

    if (newPage < 1 || newPage > totalPage) return;

    listContainer.style.opacity = '0.5';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const keyword = urlParams.get('q') || '';
        const res = await fetch(`/api/search/paging?board_code=${boardCode}&q=${keyword}&page=${newPage}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const html = await res.text();

        listContainer.innerHTML = html;
        currPageEl.innerText = newPage;

        btnPrev.disabled = (newPage === 1);
        btnNext.disabled = (newPage === totalPage);

    } catch (error) {
        console.error('Error fetching page:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
        listContainer.style.opacity = '1';
    }
}