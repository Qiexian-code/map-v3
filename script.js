let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

let tempLatLng = null;
let currentDetailIdx = null;
let tempEditLatLng = null;

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
    document.getElementById("postMediaPreview").innerHTML = "";
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

// 详情表单内定位
function geocodeDetailAddress(focus) {
    const address = document.getElementById("detailAddress").value.trim();
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
            tempEditLatLng = [lat, lon];
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

// 判断是不是图片url
function isImageURL(url) {
    return /\.(png|jpg|jpeg|gif|bmp|svg|webp)(\?.*)?$/i.test(url);
}

// 拆分出所有有效图片url
function extractImageUrls(str) {
    return (str||"").split(/\s+|,|;|\n/).filter(url=>isImageURL(url));
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

    // popup只显示首张图片
    let mediaUrls = extractImageUrls(media);
    let mediaContent = "";
    if (mediaUrls.length > 0) {
        let url = mediaUrls[0];
        mediaContent = `<img src="${url}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onerror="this.outerHTML='<pre>${url.replace(/</g,'&lt;')}</pre>'">`;
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

// 发帖表单实时图片预览
function refreshPostMediaPreview() {
    let str = document.getElementById("mediaInput").value;
    let urls = extractImageUrls(str);
    let preview = document.getElementById("postMediaPreview");
    preview.innerHTML = "";
    urls.forEach(url=>{
        let img = document.createElement("img");
        img.src = url;
        img.alt = "预览";
        img.onclick = function(e){
            showImgViewer(url);
            e.stopPropagation();
        };
        preview.appendChild(img);
    });
}

// 详情表单图片大图查看和编辑
function showDetailForm(post) {
    document.getElementById("detailTitle").value = post.title || "";
    document.getElementById("detailAddress").value = post.address || "";
    document.getElementById("detailStartTime").value = post.startTime || "";
    document.getElementById("detailEndTime").value = post.endTime || "";
    document.getElementById("detailDesc").value = post.desc || "";
    document.getElementById("detailPoster").value = post.poster || "";
    currentDetailIdx = posts.indexOf(post);

    // 只读时显示
    document.getElementById("detailMediaWrap").innerHTML = "";
    document.getElementById("detailMediaWrap").style.display = "";
    document.getElementById("detailMediaEditWrap").classList.add("hidden");
    let mediaUrls = extractImageUrls(post.media);
    mediaUrls.forEach(url => {
        let img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "210px";
        img.style.maxHeight = "120px";
        img.style.borderRadius = "7px";
        img.style.cursor = "pointer";
        img.alt = "活动图片";
        img.onclick = function(e) {
            showImgViewer(url);
            e.stopPropagation();
        };
        document.getElementById("detailMediaWrap").appendChild(img);
    });

    // 输入只读
    ["detailTitle","detailAddress","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = true;
    });
    document.getElementById("detailStartTime").disabled = true;
    document.getElementById("detailEndTime").disabled = true;
    document.getElementById("detailLocateBtn").disabled = true;
    tempEditLatLng = null;
    document.getElementById("detailActions").classList.remove("hidden");
    document.getElementById("saveActions").classList.add("hidden");
    document.getElementById("detail-form").classList.remove("hidden");
}

// 编辑详情表单
function editDetailPost() {
    ["detailTitle","detailAddress","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = false;
    });
    document.getElementById("detailStartTime").disabled = false;
    document.getElementById("detailEndTime").disabled = false;
    document.getElementById("detailLocateBtn").disabled = false;
    tempEditLatLng = null;
    document.getElementById("detailActions").classList.add("hidden");
    document.getElementById("saveActions").classList.remove("hidden");
    // 图片编辑区
    document.getElementById("detailMediaEditWrap").classList.remove("hidden");
    document.getElementById("detailMediaWrap").style.display = "none";
    let media = posts[currentDetailIdx].media || "";
    document.getElementById("detailMediaInput").value = media;
    refreshDetailMediaPreview();
}

// 编辑时图片预览
function refreshDetailMediaPreview() {
    let str = document.getElementById("detailMediaInput").value;
    let urls = extractImageUrls(str);
    let preview = document.getElementById("detailMediaEditPreview");
    preview.innerHTML = "";
    urls.forEach(url=>{
        let img = document.createElement("img");
        img.src = url;
        img.alt = "预览";
        img.onclick = function(e){
            showImgViewer(url);
            e.stopPropagation();
        };
        preview.appendChild(img);
    });
}

function saveDetailEdit() {
    let idx = currentDetailIdx;
    if (idx == null) return;
    let post = posts[idx];

    let newTitle = document.getElementById("detailTitle").value.trim();
    let newAddress = document.getElementById("detailAddress").value.trim();
    let newStartTime = document.getElementById("detailStartTime").value;
    let newEndTime = document.getElementById("detailEndTime").value;
    let newDesc = document.getElementById("detailDesc").value.trim();
    let newPoster = document.getElementById("detailPoster").value.trim();
    let newMedia = document.getElementById("detailMediaInput").value.trim();

    if (!newTitle || !newAddress || !newStartTime || !newEndTime) {
        notify("请填写完整标题、地址和活动时间！");
        return;
    }
    if (newStartTime > newEndTime) {
        notify("开始时间不能晚于结束时间！");
        return;
    }

    // 判断是否更改了坐标（优先用 geocodeDetailAddress 定到的 tempEditLatLng）
    let newLat = post.lat, newLng = post.lng;
    if (tempEditLatLng) {
        newLat = tempEditLatLng[0];
        newLng = tempEditLatLng[1];
        map.removeLayer(post._marker);
        post._marker = L.marker([newLat, newLng])
            .addTo(map);
        post.lat = newLat;
        post.lng = newLng;
    }

    // 更新数据
    post.title = newTitle;
    post.address = newAddress;
    post.startTime = newStartTime;
    post.endTime = newEndTime;
    post.desc = newDesc;
    post.poster = newPoster;
    post.media = newMedia;
    post.lat = newLat;
    post.lng = newLng;

    // popup内容只显示首张图片
    let mediaUrls = extractImageUrls(post.media);
    let mediaContent = "";
    if (mediaUrls.length > 0) {
        let url = mediaUrls[0];
        mediaContent = `<img src="${url}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onerror="this.outerHTML='<pre>${url.replace(/</g,'&lt;')}</pre>'">`;
    }
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
    post._marker.bindPopup(popup).openPopup();
    post._marker.on('popupopen', function() {
        setTimeout(() => {
            let popupEl = document.querySelector('.popup-inner[data-idx="'+idx+'"]');
            if (popupEl) {
                popupEl.onclick = function(e) {
                    showDetailForm(posts[idx]);
                };
            }
        }, 0);
    });

    showDetailForm(post);
    notify("活动已修改", 1500);
    tempEditLatLng = null;
}

function cancelDetailEdit() {
    if (currentDetailIdx != null) {
        showDetailForm(posts[currentDetailIdx]);
    }
}

function deleteDetailPost() {
    if (currentDetailIdx == null) return;
    if (!confirm("确定要删除该活动吗？")) return;
    map.removeLayer(posts[currentDetailIdx]._marker);
    posts.splice(currentDetailIdx, 1);
    currentDetailIdx = null;
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
