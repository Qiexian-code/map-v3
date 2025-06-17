let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

let tempLatLng = null;
let currentDetailIdx = null;

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

// 发帖表单开关
function togglePostForm() {
    const form = document.getElementById("post-form");
    if (form.classList.contains("hidden")) {
        form.classList.remove("hidden");
    } else {
        form.classList.add("hidden");
        clearPostForm();
    }
}

// 只清空输入内容
function clearPostForm() {
    ["titleInput", "addressInput", "startTime", "endTime", "descInput", "posterInput", "mediaInput"].forEach(id => {
        document.getElementById(id).value = "";
    });
    tempLatLng = null;
}

// “取消”按钮：清空内容并收起表单
function cancelPostForm() {
    clearPostForm();
    document.getElementById("post-form").classList.add("hidden");
}

// 地址地理编码 + 标点（只移动视角，不加marker和popup）
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

// 时间格式化
function formatTime(dtstr) {
    if (!dtstr) return "";
    let d = new Date(dtstr);
    let m = d.getMonth() + 1;
    let day = d.getDate();
    let hour = d.getHours().toString().padStart(2, '0');
    let min = d.getMinutes().toString().padStart(2, '0');
    return `${m}月${day}日 ${hour}:${min}`;
}

// 发帖提交
function submitPost() {
    const title = document.getElementById("titleInput").value.trim();
    const address = document.getElementById("addressInput").value.trim();
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const desc = document.getElementById("descInput").value.trim();
    const poster = document.getElementById("posterInput").value.trim();
    const media = document.getElementById("mediaInput").value.trim();

    if (!title || !address || !startTime || !endTime) {
        notify("请填写完整标题、地址和活动时间！");
        return;
    }
    if (startTime > endTime) {
        notify("开始时间不能晚于结束时间！");
        return;
    }
    if (!tempLatLng) {
        notify("请先定位活动地址！");
        return;
    }

    const post = {
        title, address, startTime, endTime, desc, poster, media,
        lat: tempLatLng[0], lng: tempLatLng[1],
        postedAt: new Date().toISOString()
    };
    posts.push(post);

    // 判断media内容如何展示
    let mediaContent = "";
    if (media) {
        if (isImageURL(media)) {
            mediaContent = `<img src="${media}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onerror="this.outerHTML='<pre>${media.replace(/</g,'&lt;')}</pre>'">`;
        } else {
            mediaContent = `<pre>${media.replace(/</g,'&lt;')}</pre>`;
        }
    }

    let idx = posts.length - 1;
    let popup = `
      <div class="popup-inner" data-idx="${idx}" style="cursor:pointer;">
        <b>${post.title}</b><br>
        <span style="color:#357">
            开始：${formatTime(post.startTime)}<br>
            结束：${formatTime(post.endTime)}
        </span><br>
        <span style="color:#888">${post.address}</span><br>
        ${post.desc ? `<div style="margin:5px 0">${post.desc}</div>` : ""}
        ${post.poster ? `<div style="color:#247;font-size:14px;">发帖人：${post.poster}</div>` : ""}
        ${mediaContent}
      </div>
    `;

    let marker = L.marker([post.lat, post.lng]).addTo(map).bindPopup(popup).openPopup();
    post._marker = marker;

    marker.on('popupopen', function() {
        setTimeout(() => { // 等待popup渲染
            let popupEl = document.querySelector('.popup-inner[data-idx="'+idx+'"]');
            if (popupEl) {
                popupEl.onclick = function(e) {
                    showDetailForm(posts[idx]);
                };
            }
        }, 0);
    });

    notify("活动发布成功！", 1600);
    document.getElementById("post-form").classList.add("hidden");
    clearPostForm();
}

// 详情表单图片大图查看
function showDetailForm(post) {
    document.getElementById("detailTitle").value = post.title || "";
    document.getElementById("detailAddress").value = post.address || "";
    document.getElementById("detailStartTime").value = post.startTime || "";
    document.getElementById("detailEndTime").value = post.endTime || "";
    document.getElementById("detailDesc").value = post.desc || "";
    document.getElementById("detailPoster").value = post.poster || "";
    currentDetailIdx = posts.indexOf(post);

    // 详细图片展示
    let detailMediaWrap = document.getElementById("detailMediaWrap");
    detailMediaWrap.innerHTML = "";
    if (post.media && isImageURL(post.media)) {
        let img = document.createElement("img");
        img.src = post.media;
        img.style.maxWidth = "210px";
        img.style.maxHeight = "120px";
        img.style.borderRadius = "7px";
        img.style.cursor = "pointer";
        img.alt = "活动图片";
        img.onclick = function(e) {
            showImgViewer(post.media);
            e.stopPropagation();
        };
        detailMediaWrap.appendChild(img);
    } else if (post.media) {
        let pre = document.createElement("pre");
        pre.innerText = post.media;
        detailMediaWrap.appendChild(pre);
    }
    // 输入只读
    ["detailTitle","detailAddress","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = true;
    });
    document.getElementById("detailStartTime").disabled = true;
    document.getElementById("detailEndTime").disabled = true;
    // 按钮组切换
    document.getElementById("detailActions").classList.remove("hidden");
    document.getElementById("saveActions").classList.add("hidden");
    document.getElementById("detail-form").classList.remove("hidden");
}

function editDetailPost() {
    ["detailTitle","detailAddress","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = false;
    });
    document.getElementById("detailStartTime").disabled = false;
    document.getElementById("detailEndTime").disabled = false;
    document.getElementById("detailActions").classList.add("hidden");
    document.getElementById("saveActions").classList.remove("hidden");
}

function saveDetailEdit() {
    let idx = currentDetailIdx;
    if (idx == null) return;
    let post = posts[idx];
    post.title = document.getElementById("detailTitle").value.trim();
    post.address = document.getElementById("detailAddress").value.trim();
    post.startTime = document.getElementById("detailStartTime").value;
    post.endTime = document.getElementById("detailEndTime").value;
    post.desc = document.getElementById("detailDesc").value.trim();
    post.poster = document.getElementById("detailPoster").value.trim();

    // 重新生成popup内容
    let mediaContent = "";
    if (post.media && isImageURL(post.media)) {
        mediaContent = `<img src="${post.media}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onerror="this.outerHTML='<pre>${post.media.replace(/</g,'&lt;')}</pre>'">`;
    } else if (post.media) {
        mediaContent = `<pre>${post.media.replace(/</g,'&lt;')}</pre>`;
    }
    let idxStr = idx;
    let popup = `
      <div class="popup-inner" data-idx="${idxStr}" style="cursor:pointer;">
        <b>${post.title}</b><br>
        <span style="color:#357">
            开始：${formatTime(post.startTime)}<br>
            结束：${formatTime(post.endTime)}
        </span><br>
        <span style="color:#888">${post.address}</span><br>
        ${post.desc ? `<div style="margin:5px 0">${post.desc}</div>` : ""}
        ${post.poster ? `<div style="color:#247;font-size:14px;">发帖人：${post.poster}</div>` : ""}
        ${mediaContent}
      </div>
    `;
    post._marker.setPopupContent(popup);
    // 恢复只读和按钮状态
    showDetailForm(post);
    notify("活动已修改", 1500);
}

function cancelDetailEdit() {
    if (currentDetailIdx != null) {
        showDetailForm(posts[currentDetailIdx]);
    }
}

function deleteDetailPost() {
    if (currentDetailIdx == null) return;
    if (!confirm("确定要删除该活动吗？")) return;
    // 移除地图marker
    map.removeLayer(posts[currentDetailIdx]._marker);
    // 删除数组项
    posts.splice(currentDetailIdx, 1);
    currentDetailIdx = null;
    // 关闭表单
    hideDetailForm();
    notify("活动已删除", 1500);
}

function showImgViewer(url) {
    document.getElementById("img-viewer-img").src = url;
    document.getElementById("img-viewer").classList.remove("hidden");
}
function hideImgViewer() {
    document.getElementById("img-viewer").classList.add("hidden");
}
function hideDetailForm() {
    document.getElementById("detail-form").classList.add("hidden");
}
