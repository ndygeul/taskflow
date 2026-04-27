function searchJournal() {
    const keyword = document.getElementById('searchKeyword').value;
    if (keyword.trim()) {
        location.href = `/journal?page=1&q=${encodeURIComponent(keyword)}`;
    } else {
        location.href = `/journal?page=1`;
    }
}