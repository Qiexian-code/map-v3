let map = L.map('map').setView([37.7749, -122.4194], 13);

let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

// 系统时间模块（美化版）
function updateClock() {
    const now = new Date();
    document.getElementById("clock").innerText = now.toLocaleString();
}

setInterval(updateClock, 1000);
updateClock();
