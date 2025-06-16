let map = L.map('map').setView([37.7749, -122.4194], 13);

const tileLayers = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    "Carto Light": L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'),
    "Stamen Toner Lite": L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png')
};

tileLayers["OpenStreetMap"].addTo(map);
let currentTile = "OpenStreetMap";

let adminMode = false;
function toggleAdminMode() {
    adminMode = !adminMode;
    map.removeLayer(tileLayers[currentTile]);
    if (adminMode) {
        currentTile = (currentTile === "OpenStreetMap") ? "Carto Light" : "OpenStreetMap";
    } else {
        currentTile = "OpenStreetMap";
    }
    tileLayers[currentTile].addTo(map);
}

function toggleTheme() {
    document.body.classList.toggle("dark-theme");
}

let posts = [];
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        posts = data;
        cleanExpiredPosts();
        renderPosts();
    });

function renderPosts() {
    posts.forEach(post => {
        const timeText = post.time ? `<b>活动时间：</b> ${formatDate(post.time)}<br>` : '';
        const marker = L.marker([post.lat, post.lng]).addTo(map);
        marker.bindPopup(`
            <b>${post.title}</b><br>
            ${post.desc}<br>
            ${timeText}
            <b>发帖人：</b>${post.poster || '匿名'}<br>
            <pre>${post.symbol || ''}</pre>
        `);
    });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

function cleanExpiredPosts() {
    const today = new Date().toISOString().split("T")[0];
    posts = posts.filter(post => post.time >= today);
    savePosts();
}

function savePosts() {
    console.log("数据已更新，请手动更新data.json:", JSON.stringify(posts, null, 2));
}

function showPostForm() {
    document.getElementById("post-form").classList.remove("hidden");
}

function hidePostForm() {
    document.getElementById("post-form").classList.add("hidden");
}

function submitNewPost() {
    const poster = document.getElementById("posterName").value;
    const address = document.getElementById("address").value;
    const title = document.getElementById("title").value;
    const desc = document.getElementById("desc").value;
    const time = document.getElementById("time").value;
    const lat = document.getElementById("lat").value;
    const lng = document.getElementById("lng").value;
    const symbol = document.getElementById("symbolArt").value;

    if (!address || !title || !time || !lat || !lng) {
        alert("请填写完整信息！");
        return;
    }

    const newPost = { poster, address, title, desc, time, lat, lng, symbol };
    posts.push(newPost);
    savePosts();
    location.reload();
}

document.getElementById("address").addEventListener("blur", () => {
    const address = document.getElementById("address").value;
    if (address.length > 5) {
        navigator.geolocation.getCurrentPosition(pos => {
            document.getElementById("lat").value = pos.coords.latitude.toFixed(5);
            document.getElementById("lng").value = pos.coords.longitude.toFixed(5);
        });
    }
});

window.onload = () => {
    const announcement = document.getElementById("announcement");
    announcement.innerText = "📢 新活动任务已开放报名！";
    announcement.classList.remove("hidden");
    setTimeout(() => {
        announcement.classList.add("hidden");
    }, 5000);
};
