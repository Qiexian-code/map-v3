let map = L.map('map').setView([37.7749, -122.4194], 13);

// 只保留白天瓦片
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);
