let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

let marker = null;
let tempLatLng = null;

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

// 显示发帖表单
function showPostForm() {
    document.getElementById("post-form").classList.remove("hidden");
    document.getElementById("post-btn").classList.add("hidden");
}

// 隐藏发帖表单
function hidePostForm() {
    document.getElementById("post-form").classList.add("hidden");
    document.getElementById("post-btn").classList.remove("hidden");
    tempLatLng = null;
}

// 地址地理编码 + 标点
function geocodeAddress(focus) {
    const address = document.getElementById("addressInput").value.trim();
    if (!address) {
        notify("请输入活动地址");
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
            tempLatLng = [lat, lon];
            if (focus) {
                map.setView([lat, lon], 16);
            }
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lon]).addTo(map).bindPopup("活动地址定位成功！").openPopup();
        })
        .catch(err => {
            notify("地理编码服务异常，请稍后再试。");
        });
}

// 发帖内容临时存储
let posts = [];

// 发帖提交
function submitPost() {
    const title = document.getElementById("titleInput").value.trim();
    const address = document.getElementById("addressInput").value.trim();
    const date = document.getElementById("dateInput").value;
    const desc = document.getElementById("descInput").value.trim();
    const poster = document.getElementById("posterInput").value.trim();
    const asciiArt = document.getElementById("asciiArtInput").value.trim();

    if (!title || !address || !date) {
        notify("请填写完整标题、地址和活动日期！");
        return;
    }
    if (!tempLatLng) {
        notify("请先定位活动地址！");
        return;
    }

    const post = {
        title, address, date, desc, poster, asciiArt,
        lat: tempLatLng[0], lng: tempLatLng[1],
        postedAt: new Date().toISOString()
    };
    posts.push(post);

    // 地图上打点，并显示活动内容
    L.marker([post.lat, post.lng]).addTo(map).bindPopup(`
        <b>${post.title}</b><br>
        ${post.date}<br>
        ${post.address}<br>
        ${post.desc ? post.desc + "<br>" : ""}
        ${post.poster ? "发帖人：" + post.poster + "<br>" : ""}
        ${post.asciiArt ? "<pre>" + post.asciiArt + "</pre>" : ""}
    `);

    notify("活动发布成功！", 1600);
    hidePostForm();
    // 清空表单
    ["titleInput","addressInput","dateInput","descInput","posterInput","asciiArtInput"].forEach(id=>{
        document.getElementById(id).value = "";
    });
    tempLatLng = null;
}
