let map = L.map('map').setView([37.7749, -122.4194], 13);

let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

let marker = null;

// 系统时间模块
function updateClock() {
    const now = new Date();
    document.getElementById("clock").innerText = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

// 顶部浮条提示
function notify(msg, timeout = 2000) {
    const n = document.getElementById("notify");
    n.innerText = msg;
    n.classList.remove("hidden");
    setTimeout(() => {
        n.classList.add("hidden");
    }, timeout);
}

// 地址输入 → 地理编码并地图打点
function geocodeAddress() {
    const address = document.getElementById("addressInput").value.trim();
    if (!address) {
        notify("请输入地址");
        return;
    }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                notify("未找到该地址，请检查拼写！");
                return;
            }
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            // 移动地图
            map.setView([lat, lon], 16);
            // 打点
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lon]).addTo(map).bindPopup("地址定位成功！").openPopup();
        })
        .catch(err => {
            notify("地理编码服务异常，请稍后再试。");
        });
}
