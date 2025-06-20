// ----------- Supabase 连接配置 ------------
const SUPABASE_URL = 'https://ospkcvwiytlzbqbwojke.supabase.co'; // 替换
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcGtjdndpeXRsemJxYndvamtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMzQwNzEsImV4cCI6MjA2NTcxMDA3MX0.q2DBcXsceIpRQ0qAtSxNXMPEjm0Pi2etN356GvpJGX8';                  // 替换
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------- 地图初始化 ------------
let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

let posts = [];
let postGroups = {};
let markers = {};
let editingPostId = null;
let tempLatLng = null;
let currentDetailGroup = null, currentDetailIdx = 0;

// ----------- 工具函数 ------------
function formatTime(dtstr) {
    if (!dtstr) return "";
    let d = new Date(dtstr);
    let m = d.getMonth() + 1, day = d.getDate();
    let hour = d.getHours().toString().padStart(2,'0');
    let min = d.getMinutes().toString().padStart(2,'0');
    return `${m}月${day}日 ${hour}:${min}`;
}
function notify(msg, timeout = 2000) {
    const n = document.getElementById("notify");
    n.innerText = msg;
    n.classList.remove("hidden");
    setTimeout(() => { n.classList.add("hidden"); }, timeout);
}
function isImageURL(url) {
    return /\.(png|jpg|jpeg|gif|bmp|svg|webp)(\?.*)?$/i.test(url);
}
function parseImagesFromInput(val) {
    return val.split(/[\s,\n]/).filter(isImageURL);
}
function groupPostsByLocation(posts) {
    const groups = {};
    posts.forEach(post => {
        const key = `${post.lat.toFixed(6)},${post.lng.toFixed(6)}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(post);
    });
    return groups;
}

// ----------- 时间钟表 ------------
function updateClock() {
    const now = new Date();
    document.getElementById("clock").innerText = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

// ----------- 发起活动弹窗UI控制 ------------
function togglePostForm() {
    const form = document.getElementById("post-form");
    if (form.classList.contains("hidden")) form.classList.remove("hidden");
    else { form.classList.add("hidden"); clearPostForm(); }
}
function clearPostForm() {
    ["titleInput","addressInput","startTime","endTime","descInput","posterInput","mediaInput"].forEach(id=>document.getElementById(id).value="");
    tempLatLng = null;
    document.getElementById("postMediaPreview").innerHTML = "";
}
function cancelPostForm() { clearPostForm(); document.getElementById("post-form").classList.add("hidden"); }

// ----------- 地址定位 ------------
function geocodeAddress(focus) {
    const address = document.getElementById("addressInput").value.trim();
    if (!address) return notify("请输入活动地址");
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
        .then(res=>res.json()).then(data=>{
            if (data.length===0) return notify("未找到该地址，请检查拼写！");
            const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
            tempLatLng = [lat, lon];
            if (focus) map.setView([lat, lon], 16);
        }).catch(()=>notify("地理编码服务异常，请稍后再试。"));
}

// ----------- 图片预览 ------------
function refreshPostMediaPreview() {
    let input = document.getElementById("mediaInput");
    let preview = document.getElementById("postMediaPreview");
    if (!input || !preview) return;
    preview.innerHTML = "";
    let urls = input.value.split(/[\s,\n]/).filter(Boolean);
    urls.forEach(url=>{
        if (isImageURL(url)) {
            let img = document.createElement("img");
            img.src = url;
            img.alt = "预览";
            img.onclick = ()=>showImgViewer(url);
            preview.appendChild(img);
        }
    });
}
document.getElementById("uploadImageInput").addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const statusDiv = document.getElementById("uploadStatus");
    statusDiv.innerText = "正在上传图片...";
    let uploadedURLs = [];
    for (let file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random()*1e6)}.${ext}`;
        const { error } = await supabase.storage.from('activity-images').upload(fileName, file, { upsert: false });
        if (error) { statusDiv.innerText = "上传失败: " + error.message; return; }
        const { data: { publicUrl } } = supabase.storage.from('activity-images').getPublicUrl(fileName);
        uploadedURLs.push(publicUrl);
    }
    let mediaInput = document.getElementById("mediaInput");
    if (mediaInput.value) mediaInput.value += "\n";
    mediaInput.value += uploadedURLs.join("\n");
    refreshPostMediaPreview();
    statusDiv.innerText = "图片上传完成！";
    this.value = "";
    setTimeout(()=>{ statusDiv.innerText = ""; }, 1000);
});

// ----------- 提交新活动 ------------
async function submitPost() {
    const title = document.getElementById("titleInput").value.trim();
    const address = document.getElementById("addressInput").value.trim();
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const desc = document.getElementById("descInput").value.trim();
    const poster = document.getElementById("posterInput").value.trim();
    const mediaInput = document.getElementById("mediaInput").value.trim();
    if (!title || !address || !startTime || !endTime) return notify("请填写完整标题、地址和活动时间！");
    if (startTime > endTime) return notify("开始时间不能晚于结束时间！");
    if (!tempLatLng) return notify("请先定位活动地址！");
    let images = parseImagesFromInput(mediaInput);
    let post = {
        title, address, start_time: startTime, end_time: endTime,
        desc, poster, images, lat: tempLatLng[0], lng: tempLatLng[1]
    };
    let { data, error } = await supabase.from('activities').insert([post]);
    if (error) return notify("活动保存失败: " + error.message);
    notify("活动发布成功！", 1500);
    document.getElementById("post-form").classList.add("hidden");
    clearPostForm();
    loadPosts();
}

// ----------- 加载所有活动并地图分组渲染 ------------
async function loadPosts() {
    let { data, error } = await supabase.from('activities').select('*').order('start_time', {ascending: true});
    if (error) { notify("数据加载失败"); return; }
    posts = data || [];
    map.eachLayer(layer => { if(layer instanceof L.Marker) map.removeLayer(layer); });
    tileLayer.addTo(map);
    postGroups = groupPostsByLocation(posts);
    markers = {};

    Object.entries(postGroups).forEach(([key, groupArr]) => {
        const [lat, lng] = key.split(',').map(Number);
        let marker = L.marker([lat, lng]).addTo(map);
        marker.on('click', function() {
            showGroupPopup(marker, groupArr, 0);
        });
        markers[key] = marker;
        marker._groupArr = groupArr;
    });
}

// ----------- Popup 轮播展示（已修复多次点击失效） ------------
function showGroupPopup(marker, groupArr, idx) {
    const post = groupArr[idx];
    let images = post.images || [];
    let imgTag = images.length > 0 ? `<img src="${images[0]}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onclick="showImgViewer('${images[0]}')">` : "";
    let nav = '';
    if (groupArr.length > 1) {
        nav = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px;">
            <button class="popup-arrow" onclick="prevCard(event,${marker._leaflet_id})">&#8592;</button>
            <span style="font-size:14px;">${idx+1}/${groupArr.length}</span>
            <button class="popup-arrow" onclick="nextCard(event,${marker._leaflet_id})">&#8594;</button>
        </div>`;
    }
    let popupHtml = `
      <div id="group-popup-${marker._leaflet_id}" class="popup-inner" data-idx="${idx}" data-ids="${groupArr.map(p=>p.id).join(',')}">
        <b>${post.title}</b><br>
        <span style="color:#357">开始：${formatTime(post.start_time)}<br>结束：${formatTime(post.end_time)}</span><br>
        <span style="color:#888">${post.address}</span><br>
        ${post.desc ? `<div style="margin:5px 0">${post.desc}</div>` : ""}
        ${post.poster ? `<div style="color:#247;font-size:14px;">发帖人：${post.poster}</div>` : ""}
        ${imgTag}
        <div style="margin-top:8px;">
          <button class="popup-detail-btn" onclick="openDetailFromPopup(event, ${marker._leaflet_id}, ${idx})">查看详情</button>
        </div>
        ${nav}
      </div>
    `;

    // 关键：每次切换卡片或marker前强制关闭并解绑popup，再绑定新内容，setTimeout打开
    marker.closePopup();
    marker.unbindPopup();
    marker.bindPopup(popupHtml);
    setTimeout(() => { marker.openPopup(); }, 0);

    marker._groupArr = groupArr;
}

// 轮播切换按钮
window.prevCard = function(e, markerId) {
    e.stopPropagation();
    let marker = Object.values(map._layers).find(l => l._leaflet_id === markerId);
    if (!marker || !marker._groupArr) return;
    let popupDiv = document.getElementById(`group-popup-${markerId}`);
    let idx = parseInt(popupDiv.dataset.idx);
    let newIdx = (idx - 1 + marker._groupArr.length) % marker._groupArr.length;
    showGroupPopup(marker, marker._groupArr, newIdx);
};
window.nextCard = function(e, markerId) {
    e.stopPropagation();
    let marker = Object.values(map._layers).find(l => l._leaflet_id === markerId);
    if (!marker || !marker._groupArr) return;
    let popupDiv = document.getElementById(`group-popup-${markerId}`);
    let idx = parseInt(popupDiv.dataset.idx);
    let newIdx = (idx + 1) % marker._groupArr.length;
    showGroupPopup(marker, marker._groupArr, newIdx);
};
// 查看详情
window.openDetailFromPopup = function(e, markerId, idx) {
    e.stopPropagation();
    let marker = Object.values(map._layers).find(l => l._leaflet_id === markerId);
    if (!marker || !marker._groupArr) return;
    showDetailForm(marker._groupArr[idx], marker._groupArr, idx);
    marker.closePopup();
};

window.onload = loadPosts;

// ----------- 详情表单 ------------
function showDetailForm(post, groupArr = [post], idx = 0) {
    editingPostId = post.id;
    currentDetailGroup = groupArr;
    currentDetailIdx = idx;
    document.getElementById("detailTitle").value = post.title || "";
    document.getElementById("detailAddress").value = post.address || "";
    document.getElementById("detailStartTime").value = post.start_time || "";
    document.getElementById("detailEndTime").value = post.end_time || "";
    document.getElementById("detailDesc").value = post.desc || "";
    document.getElementById("detailPoster").value = post.poster || "";

    // 图片
    let detailMediaWrap = document.getElementById("detailMediaWrap");
    detailMediaWrap.innerHTML = "";
    (post.images||[]).forEach(url=>{
        let img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "120px";
        img.style.margin = "4px 7px 4px 0";
        img.style.borderRadius = "7px";
        img.alt = "图片";
        img.onclick = e=>{ showImgViewer(url); e.stopPropagation(); };
        detailMediaWrap.appendChild(img);
    });

    // 禁用编辑
    ["detailTitle","detailAddress","detailStartTime","detailEndTime","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = true;
    });
    document.getElementById("detailLocateBtn").disabled = true;
    document.getElementById("detailTimeView").classList.remove("hidden");
    document.getElementById("detailTimeEdit").classList.add("hidden");
    document.getElementById("detailMediaEditWrap").classList.add("hidden");
    document.getElementById("detailActions").classList.remove("hidden");
    document.getElementById("saveActions").classList.add("hidden");
    document.getElementById("detail-form").classList.remove("hidden");

    // 左右切换导航
    let navDiv = document.getElementById("detailNav");
    if (!navDiv) {
        navDiv = document.createElement("div");
        navDiv.id = "detailNav";
        navDiv.style.cssText = "display:flex;justify-content:space-between;margin-bottom:6px;";
        document.getElementById("detail-form").insertBefore(navDiv, document.getElementById("detailTitle"));
    }
    if (groupArr.length > 1) {
        navDiv.innerHTML = `
            <button class="popup-arrow" onclick="showPrevDetail()">&#8592; 上一个</button>
            <span>${idx+1} / ${groupArr.length}</span>
            <button class="popup-arrow" onclick="showNextDetail()">下一个 &#8594;</button>
        `;
    } else {
        navDiv.innerHTML = '';
    }
}
// 详情切换
window.showPrevDetail = function() {
    if (!currentDetailGroup) return;
    let newIdx = (currentDetailIdx - 1 + currentDetailGroup.length) % currentDetailGroup.length;
    showDetailForm(currentDetailGroup[newIdx], currentDetailGroup, newIdx);
};
window.showNextDetail = function() {
    if (!currentDetailGroup) return;
    let newIdx = (currentDetailIdx + 1) % currentDetailGroup.length;
    showDetailForm(currentDetailGroup[newIdx], currentDetailGroup, newIdx);
};

// ----------- 详情关闭 ------------
function hideDetailForm() { document.getElementById("detail-form").classList.add("hidden"); editingPostId = null; }

// ----------- 图片大图查看 ------------
function showImgViewer(url) {
    document.getElementById("img-viewer-img").src = url;
    document.getElementById("img-viewer").classList.remove("hidden");
}
function hideImgViewer() {
    document.getElementById("img-viewer").classList.add("hidden");
}
