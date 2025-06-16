let map = L.map('map').setView([37.7749, -122.4194], 13);

const tiles = {
    "day": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    "night": L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png')
};

let currentTile = "day";
tiles[currentTile].addTo(map);

function switchDay() {
    if (currentTile !== "day") {
        map.removeLayer(tiles[currentTile]);
        currentTile = "day";
        tiles[currentTile].addTo(map);
    }
}

function switchNight() {
    if (currentTile !== "night") {
        map.removeLayer(tiles[currentTile]);
        currentTile = "night";
        tiles[currentTile].addTo(map);
    }
}
