// ----------- Supabase 连接配置 ------------
const SUPABASE_URL = 'https://ospkcvwiytlzbqbwojke.supabase.co'; // 替换
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcGtjdndpeXRsemJxYndvamtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMzQwNzEsImV4cCI6MjA2NTcxMDA3MX0.q2DBcXsceIpRQ0qAtSxNXMPEjm0Pi2etN356GvpJGX8';                  // 替换
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --------- 地图&全局数据 ---------
let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

// 活动数据
let posts = [];
let postGroups = {}; // { "lat,lng": [活动, ...] }
let markers = {};    // { "lat,lng": marker }
let editingPostId = null;

// --------- 分组方法 ---------
function groupPostsByLocation(posts) {
    const groups = {};
    posts.forEach(post => {
        const key = `${post.lat.toFixed(6)},${post.lng.toFixed(6)}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(post);
    });
    return groups;
}

// --------- 加载并渲染所有活动 ---------
async function loadPosts() {
    let { data, error } = await supabase.from('activities').select('*').order('start_time', {ascending: true});
    if (error) { notify("数据加载失败"); return; }
    posts = data || [];

    // 清理旧
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

        // 你可以自定义icon提示有多个活动
        markers[key] = marker;
        marker._groupArr = groupArr;
    });
}

// --------- Popup 轮播（核心） ---------
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
    marker.bindPopup(popupHtml).openPopup();
    marker._groupArr = groupArr; // 存储用于切换
}

// 轮播切换按钮（必须全局）
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

// 查看详情按钮
window.openDetailFromPopup = function(e, markerId, idx) {
    e.stopPropagation();
    let marker = Object.values(map._layers).find(l => l._leaflet_id === markerId);
    if (!marker || !marker._groupArr) return;
    showDetailForm(marker._groupArr[idx], marker._groupArr, idx);
    marker.closePopup();
};

window.onload = loadPosts;

/////////////////////////////////////////
// 下面是详情表单多贴切换的部分
/////////////////////////////////////////

let currentDetailGroup = null, currentDetailIdx = 0;

// showDetailForm 支持切组和index
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
