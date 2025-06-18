// ----------- Supabase 连接配置 ------------
const SUPABASE_URL = 'https://ospkcvwiytlzbqbwojke.supabase.co://YOUR_PROJECT_ID.supabase.co'; // 替换
const SUPABASE_ANON_KEY = 'YOUR_AeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcGtjdndpeXRsemJxYndvamtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMzQwNzEsImV4cCI6MjA2NTcxMDA3MX0.q2DBcXsceIpRQ0qAtSxNXMPEjm0Pi2etN356GvpJGX8NON_KEY';                  // 替换
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------- 地图初始化 ------------
let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);
let tempLatLng = null;
let posts = []; // 活动本地缓存
let editingPostId = null; // 当前修改id

// ----------- 系统时间 ------------
function updateClock() {
    const now = new Date();
    document.getElementById("clock").innerText = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

// ----------- 通知浮条 ------------
function notify(msg, timeout = 2000) {
    const n = document.getElementById("notify");
    n.innerText = msg;
    n.classList.remove("hidden");
    setTimeout(() => { n.classList.add("hidden"); }, timeout);
}

// ----------- 表单UI控制 ------------
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
function isImageURL(url) {
    return /\.(png|jpg|jpeg|gif|bmp|svg|webp)(\?.*)?$/i.test(url);
}
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

// ----------- 活动提交 ------------
function parseImagesFromInput(val) {
    return val.split(/[\s,\n]/).filter(isImageURL);
}
function formatTime(dtstr) {
    if (!dtstr) return "";
    let d = new Date(dtstr);
    let m = d.getMonth() + 1, day = d.getDate();
    let hour = d.getHours().toString().padStart(2,'0');
    let min = d.getMinutes().toString().padStart(2,'0');
    return `${m}月${day}日 ${hour}:${min}`;
}
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

// ----------- 从 Supabase 加载所有活动并渲染 ------------
async function loadPosts() {
    let { data, error } = await supabase.from('activities').select('*').order('start_time', {ascending: true});
    if (error) { notify("数据加载失败"); return; }
    posts = data || [];
    // 清空旧 marker
    map.eachLayer(layer => { if(layer instanceof L.Marker) map.removeLayer(layer); });
    tileLayer.addTo(map);
    posts.forEach((post, idx) => {
        let images = post.images || [];
        let imgTag = images.length>0 ? `<img src="${images[0]}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;" onclick="showImgViewer('${images[0]}')">` : "";
        let popup = `
          <div class="popup-inner" data-idx="${idx}" style="cursor:pointer;">
            <b>${post.title}</b><br>
            <span style="color:#357">
                开始：${formatTime(post.start_time)}<br>
                结束：${formatTime(post.end_time)}
            </span><br>
            <span style="color:#888">${post.address}</span><br>
            ${post.desc ? `<div style="margin:5px 0">${post.desc}</div>` : ""}
            ${post.poster ? `<div style="color:#247;font-size:14px;">发帖人：${post.poster}</div>` : ""}
            ${imgTag}
          </div>
        `;
        let marker = L.marker([post.lat, post.lng]).addTo(map).bindPopup(popup);
        marker.on('popupopen', function() {
            setTimeout(() => {
                let popupEl = document.querySelector('.popup-inner[data-idx="'+idx+'"]');
                if (popupEl) popupEl.onclick = function(e) { showDetailForm(posts[idx]); };
            }, 0);
        });
        post._marker = marker;
    });
}
window.onload = loadPosts;

// ----------- 活动详情/编辑 ------------
function showDetailForm(post) {
    editingPostId = post.id;
    document.getElementById("detailTitle").value = post.title || "";
    document.getElementById("detailAddress").value = post.address || "";
    document.getElementById("detailStartTime").value = post.start_time || "";
    document.getElementById("detailEndTime").value = post.end_time || "";
    document.getElementById("detailDesc").value = post.desc || "";
    document.getElementById("detailPoster").value = post.poster || "";
    // 只读时图片
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
}

// 编辑
function editDetailPost() {
    let post = posts.find(x=>x.id===editingPostId);
    if (!post) return;
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

// 修改时定位
function geocodeDetailAddress(focus) {
    const address = document.getElementById("detailAddress").value.trim();
    if (!address) return notify("请输入活动地址");
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
        .then(res=>res.json()).then(data=>{
            if (data.length===0) return notify("未找到该地址，请检查拼写！");
            const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
            posts.find(x=>x.id===editingPostId)._newLatLng = [lat,lon];
            if (focus) map.setView([lat, lon], 16);
        }).catch(()=>notify("地理编码服务异常，请稍后再试。"));
}

// 保存修改
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
    loadPosts();
}
function cancelDetailEdit() { showDetailForm(posts.find(x=>x.id===editingPostId)); }
async function deleteDetailPost() {
    if (!confirm("确定要删除此活动吗？")) return;
    let { error } = await supabase.from('activities').delete().eq('id', editingPostId);
    if (error) return notify("删除失败: "+error.message);
    notify("已删除！");
    document.getElementById("detail-form").classList.add("hidden");
    loadPosts();
}
function hideDetailForm() { document.getElementById("detail-form").classList.add("hidden"); editingPostId = null; }

// ----------- 图片大图查看 ------------
function showImgViewer(url) {
    document.getElementById("img-viewer-img").src = url;
    document.getElementById("img-viewer").classList.remove("hidden");
}
function hideImgViewer() {
    document.getElementById("img-viewer").classList.add("hidden");
}
