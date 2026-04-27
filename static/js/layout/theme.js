function syncTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    const toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = savedTheme === 'light' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
    }
}

syncTheme();
window.addEventListener('pageshow', syncTheme);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncTheme() });
window.addEventListener('focus', syncTheme);

document.addEventListener('DOMContentLoaded', function() {
    const btnTheme = document.getElementById('darkModeToggle');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            syncTheme();
        });
    }
});
