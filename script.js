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

// 展开/收起功能菜单
function togglePostMenu() {
    const list = document.getElementById("post-func-list");
    list.classList.toggle("hidden");
    // 点击别处自动收起
    if (!list.classList.contains("hidden")) {
        document.addEventListener("mousedown", outsideMenuHandler);
    }
    function outsideMenuHandler(e) {
        if (!document.getElementById("post-menu").contains(e.target)) {
            list.classList.add("hidden");
            document.removeEventListener("mousedown", outsideMenuHandler);
        }
    }
}

// 显示发帖表单
function showPostForm() {
    document.getElementById("post-form").classList.remove("hidden");
    document.getElementById("post-func-list").classList.add("hidden");
}
// 隐藏发帖表单（清除临时状态）
function hidePostForm() {
    document.getElementById("post-form").classList.add("hidden");
    ["titleInput","addressInput","dateInput","descInput","posterInput","mediaInput"].forEach(id=>{
        document.getElementById(id).value = "";
    });
    tempLatLng = null;
    if (marker) { map.removeLayer(marker); marker = null; }
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

// 极简图片URL检测（判断是不是图片）
function isImageURL(url) {
    return /\.(png|jpg|jpeg|gif|bmp|svg|webp)(\?.*)?$/i.test(url);
}

// 发帖提交
function submitPost() {
    const title = document.getElementById("titleInput").value.trim();
    const address = document.getElementById("addressInput").value.trim();
    const date = document.getElementById("dateInput").value;
    const desc = document.getElementById("descInput").value.trim();
    const poster = document.getElementById("posterInput").value.trim();
    const media = document.getElementById("mediaInput").value.trim();

    if (!title || !address || !date) {
        notify("请填写完整标题、地址和活动日期！");
        return;
    }
    if (!tempLatLng) {
        notify("请先定位活动地址！");
        return;
    }

    const post = {
        title, address, date, desc, poster, media,
        lat: tempLatLng[0], lng: tempLatLng[1],
        postedAt: new Date().toISOString()
    };
    posts.push(post);

    // 判断media内容如何展示
    let mediaContent = "";
    if (media) {
        if (isImageURL(media)) {
            // 图片模式，onerror降级为文本
            mediaContent = `<img src="${media}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onerror="this.outerHTML='<pre>${media.replace(/</g,'&lt;')}</pre>'">`;
        } else {
            // 符号画/普通文本
            mediaContent = `<pre>${media.replace(/</g,'&lt;')}</pre>`;
        }
    }

    let popup = `
        <b>${post.title}</b><br>
        <span style="color:#357">${post.date}</span><br>
        <span style="color:#888">${post.address}</span><br>
        ${post.desc ? `<div style="margin:5px 0">${post.desc}</div>` : ""}
        ${post.poster ? `<div style="color:#247;font-size:14px;">发帖人：${post.poster}</div>` : ""}
        ${mediaContent}
    `;

    L.marker([post.lat, post.lng]).addTo(map).bindPopup(popup).openPopup();

    notify("活动发布成功！", 1600);
    hidePostForm();
}
