async function loadNavMenu() {
    try {
        const res = await fetch('/api/boards/structure');
        const data = await res.json();
        const container = document.getElementById('dynamicMenu');
        const sidebarContainer = document.getElementById('dynamicSidebarMenu');
        let html = '';
        let sidebarHtml = '';
        const path = window.location.pathname;

        html += `<li class="nav-item"><a class="nav-link fw-bold ${path === '/' ? 'active text-primary' : ''}" href="/"><i class="bi bi-calendar-week me-2"></i>업무일정</a></li>`;
        html += `<li class="nav-item"><a class="nav-link fw-bold ${path.startsWith('/journal') ? 'active text-primary' : ''}" href="/journal"><i class="bi bi-journal-text me-2"></i>업무일지</a></li>`;

        data.menus.forEach(menu => {
            const visibleBoards = menu.boards.filter(b => b.is_visible);
            if (visibleBoards.length > 0) {
                const realBoards = visibleBoards.filter(b => !b.url);
                const hasDashboard = realBoards.length > 0;
                const menuHref = hasDashboard ? `/menu/${menu.code}` : '#';
                const toggleAttr = hasDashboard ? '' : 'data-bs-toggle="dropdown"';

                let activeClass = '';
                
                if (path === `/menu/${menu.code}` || visibleBoards.some(b => {
                    const link = b.url ? b.url : `/board/${b.code}`;
                    return link && link !== '/' && path.includes(link);
                })) {
                    activeClass = 'active text-primary';
                }

                html += `
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle fw-bold ${activeClass}" href="${menuHref}" ${toggleAttr} role="button">${menu.name}</a>
                    <ul class="dropdown-menu shadow-sm border-0">
                        ${hasDashboard ? `<li><a class="dropdown-item small py-2 fw-bold text-primary" href="/menu/${menu.code}"><i class="bi bi-grid me-2"></i>최근 게시글</a></li><li><hr class="dropdown-divider"></li>` : ''}
                        ${visibleBoards.map(b => {
                            const link = b.url ? b.url : `/board/${b.code}`;
                            const target = b.is_external ? '_blank' : '_self';
                            return `<li><a class="dropdown-item small py-2" href="${link}" target="${target}">${b.name}</a></li>`;
                        }).join('')}
                    </ul>
                </li>`;
            }
        });

        data.orphans.filter(b => b.is_visible).forEach(board => {
            const link = board.url ? board.url : `/board/${board.code}`;
            const target = board.is_external ? '_blank' : '_self';
            
            if (board.is_sidebar) {
                sidebarHtml += `<a href="${link}" target="${target}" class="btn btn-outline-info btn-sm text-start fw-bold"><i class="bi bi-link-45deg"></i> ${board.name}</a>`;
            } else {
                const active = (link && link !== '/' && path.includes(link)) ? 'active text-primary' : '';
                html += `<li class="nav-item"><a class="nav-link fw-bold ${active}" href="${link}" target="${target}">${board.name}</a></li>`;
            }
        });

        container.innerHTML = html;
        if (sidebarContainer) sidebarContainer.innerHTML = sidebarHtml;

        document.querySelectorAll('.nav-item.dropdown').forEach(el => {
            el.addEventListener('mouseenter', () => { el.querySelector('.dropdown-menu').classList.add('show'); });
            el.addEventListener('mouseleave', () => { el.querySelector('.dropdown-menu').classList.remove('show'); });
        });
    } catch (e) { console.error("메뉴 로드 실패:", e); }
}

document.addEventListener('DOMContentLoaded', loadNavMenu);