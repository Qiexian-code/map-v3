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
    document.getElementById("uploadPreview").innerHTML = "";
    document.getElementById("uploadStatus").innerText = "";
    document.getElementById("uploadImageInput").value = "";
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

// ----------- 图片上传与预览 ------------
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
            img.onclick = function(e) { e.stopPropagation(); showImgViewer(url); };
            preview.appendChild(img);
        }
    });
}
document.getElementById("uploadImageInput").addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const statusDiv = document.getElementById("uploadStatus");
    const previewDiv = document.getElementById("uploadPreview");
    statusDiv.innerText = "正在上传图片...";
    previewDiv.innerHTML = "";
    let uploadedURLs = [];
    for (let file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random()*1e6)}.${ext}`;
        // 上传到 Supabase Storage
        const { error } = await supabase.storage
            .from('activity-images')
            .upload(fileName, file, { upsert: false });
        if (error) {
            statusDiv.innerText = "上传失败: " + error.message;
            return;
        }
        // 取直链
        const { data } = supabase.storage.from('activity-images').getPublicUrl(fileName);
        const url = data.publicUrl;
        uploadedURLs.push(url);

        let img = document.createElement("img");
        img.src = url;
        img.alt = "上传图片预览";
        img.style.maxWidth = "110px";
        img.style.maxHeight = "64px";
        img.style.margin = "4px 6px 4px 0";
        img.style.borderRadius = "7px";
        img.onclick = function(e){ e.stopPropagation(); showImgViewer(url); };
        previewDiv.appendChild(img);
    }
    let mediaInput = document.getElementById("mediaInput");
    if (mediaInput.value) mediaInput.value += "\n";
    mediaInput.value += uploadedURLs.join("\n");
    refreshPostMediaPreview();
    statusDiv.innerText = "图片上传完成！";
    this.value = "";
    setTimeout(()=>{ statusDiv.innerText = ""; }, 1200);
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

// ----------- Popup 轮播展示（全内容可点进详情，按钮/图片阻止冒泡） ------------
function showGroupPopup(marker, groupArr, idx) {
    const post = groupArr[idx];
    let images = post.images || [];
    let imgTag = images.length > 0 ? `<img src="${images[0]}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;cursor:pointer;" onclick="showImgViewer('${images[0]}');event.stopPropagation();">` : "";
    let nav = '';
    if (groupArr.length > 1) {
        nav = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px;">
            <button class="popup-arrow" onclick="prevCard(event,${marker._leaflet_id});event.stopPropagation();">&#8592;</button>
            <span style="font-size:14px;">${idx+1}/${groupArr.length}</span>
            <button class="popup-arrow" onclick="nextCard(event,${marker._leaflet_id});event.stopPropagation();">&#8594;</button>
        </div>`;
    }
    let popupHtml = `
      <div id="group-popup-${marker._leaflet_id}"
           class="popup-inner"
           data-idx="${idx}" data-ids="${groupArr.map(p=>p.id).join(',')}"
           style="cursor:pointer;"
           onclick="popupContentClick(event, ${marker._leaflet_id}, ${idx})"
      >
        <b>${post.title}</b><br>
        <span style="color:#357">开始：${formatTime(post.start_time)}<br>结束：${formatTime(post.end_time)}</span><br>
        <span style="color:#888">${post.address}</span><br>
        ${post.desc ? `<div style="margin:5px 0">${post.desc}</div>` : ""}
        ${post.poster ? `<div style="color:#247;font-size:14px;">发帖人：${post.poster}</div>` : ""}
        ${imgTag}
        ${nav}
      </div>
    `;
    marker.closePopup();
    marker.unbindPopup();
    marker.bindPopup(popupHtml);
    setTimeout(() => { marker.openPopup(); }, 0);
    marker._groupArr = groupArr;
}

// 轮播按钮阻止冒泡
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
// 内容区点击进入详情，排除按钮和图片
window.popupContentClick = function(event, markerId, idx) {
    let t = event.target;
    if (t.classList.contains("popup-arrow") || t.tagName === 'IMG') return;
    let marker = Object.values(map._layers).find(l => l._leaflet_id === markerId);
    if (!marker || !marker._groupArr) return;
    showDetailForm(marker._groupArr[idx], marker._groupArr, idx);
    marker.closePopup();
};

window.onload = loadPosts;

// ----------- 详情表单（只读/编辑/保存/取消切换 全修正版） ------------
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
    // 只读
    ["detailTitle","detailAddress","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = true;
    });
    document.getElementById("detailStartTime").readOnly = true;
    document.getElementById("detailEndTime").readOnly = true;
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

// ----------- 编辑详情表单 ------------
function editDetailPost() {
    let post = posts.find(x=>x.id===editingPostId);
    if (!post) return;
    // 开启输入
    ["detailTitle","detailAddress","detailDesc","detailPoster"].forEach(id=>{
        document.getElementById(id).readOnly = false;
    });
    document.getElementById("detailLocateBtn").disabled = false;
    // 时间可编辑
    document.getElementById("detailTimeView").classList.add("hidden");
    document.getElementById("detailTimeEdit").classList.remove("hidden");
    document.getElementById("detailStartTimeEdit").value = post.start_time || "";
    document.getElementById("detailEndTimeEdit").value = post.end_time || "";
    // 图片编辑
    document.getElementById("detailMediaEditWrap").classList.remove("hidden");
    document.getElementById("detailMediaInput").value = (post.images||[]).join("\n");
    refreshDetailMediaPreview();
    document.getElementById("detailMediaWrap").innerHTML = "";
    document.getElementById("detailActions").classList.add("hidden");
    document.getElementById("saveActions").classList.remove("hidden");
}

// 图片编辑区预览
function refreshDetailMediaPreview() {
    let input = document.getElementById("detailMediaInput");
    let preview = document.getElementById("detailMediaEditPreview");
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

// 详情定位（可编辑状态下生效）
function geocodeDetailAddress(focus) {
    const address = document.getElementById("detailAddress").value.trim();
    if (!address) return notify("请输入活动地址");
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
        .then(res=>res.json()).then(data=>{
            if (data.length===0) return notify("未找到该地址，请检查拼写！");
            const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
            let post = posts.find(x=>x.id===editingPostId);
            if (post) post._newLatLng = [lat,lon];
            if (focus) map.setView([lat, lon], 16);
        }).catch(()=>notify("地理编码服务异常，请稍后再试。"));
}

// 保存详情编辑
async function saveDetailEdit() {
    let post = posts.find(x=>x.id===editingPostId);
    if (!post) return;
    let title = document.getElementById("detailTitle").value.trim();
    let address = document.getElementById("detailAddress").value.trim();
    let start_time = document.getElementById("detailStartTimeEdit").value;
    let end_time = document.getElementById("detailEndTimeEdit").value;
    let desc = document.getElementById("detailDesc").value.trim();
    let poster = document.getElementById("detailPoster").value.trim();
    let mediaInput = document.getElementById("detailMediaInput").value.trim();
    let images = parseImagesFromInput(mediaInput);
    let lat = post._newLatLng ? post._newLatLng[0] : post.lat;
    let lng = post._newLatLng ? post._newLatLng[1] : post.lng;
    if (!title || !address || !start_time || !end_time) return notify("请填写完整标题、地址和活动时间！");
    if (start_time > end_time) return notify("开始时间不能晚于结束时间！");
    let { error } = await supabase.from('activities').update({
        title, address, start_time, end_time, desc, poster, images, lat, lng
    }).eq('id', editingPostId);
    if (error) return notify("修改失败: "+error.message);
    notify("修改成功！");
    document.getElementById("detail-form").classList.add("hidden");
    editingPostId = null;
    loadPosts();
}

// 取消编辑，还原为只读
function cancelDetailEdit() {
    let post = posts.find(x=>x.id===editingPostId);
    if (!post) return;
    showDetailForm(post, currentDetailGroup, currentDetailIdx);
}

// 删除活动
async function deleteDetailPost() {
    if (!confirm("确定要删除此活动吗？")) return;
    let { error } = await supabase.from('activities').delete().eq('id', editingPostId);
    if (error) return notify("删除失败: "+error.message);
    notify("已删除！");
    document.getElementById("detail-form").classList.add("hidden");
    editingPostId = null;
    loadPosts();
}

// 关闭详情表单
function hideDetailForm() {
    document.getElementById("detail-form").classList.add("hidden");
    editingPostId = null;
}

// ----------- 图片大图查看 ------------
function showImgViewer(url) {
    document.getElementById("img-viewer-img").src = url;
    document.getElementById("img-viewer").classList.remove("hidden");
}
function hideImgViewer() {
    document.getElementById("img-viewer").classList.add("hidden");
}
