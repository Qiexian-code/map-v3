// ==== Supabase 配置 ====
const SUPABASE_URL = 'https://ospkcvwiytlzbqbwojke.supabase.co';  // ←替换为你的Supabase项目URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcGtjdndpeXRsemJxYndvamtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMzQwNzEsImV4cCI6MjA2NTcxMDA3MX0.q2DBcXsceIpRQ0qAtSxNXMPEjm0Pi2etN356GvpJGX8eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcGtjdndpeXRsemJxYndvamtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMzQwNzEsImV4cCI6MjA2NTcxMDA3MX0.q2DBcXsceIpRQ0qAtSxNXMPEjm0Pi2etN356GvpJGX8KEY';                  // ←替换为你的Supabase ANON KEY

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==== 地图与基础UI ====
let map = L.map('map').setView([37.7749, -122.4194], 13);
let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
tileLayer.addTo(map);

let tempLatLng = null;
let postMarkers = []; // 存所有marker，后续清除/刷新

function updateClock() {
    const now = new Date();
    document.getElementById("clock").innerText = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

function notify(msg, timeout = 2000) {
    const n = document.getElementById("notify");
    n.innerText = msg;
    n.classList.remove("hidden");
    setTimeout(() => {
        n.classList.add("hidden");
    }, timeout);
}

// ==== 发帖表单UI ====
function togglePostForm() {
    const form = document.getElementById("post-form");
    if (form.classList.contains("hidden")) {
        form.classList.remove("hidden");
    } else {
        form.classList.add("hidden");
        clearPostForm();
    }
}
function clearPostForm() {
    ["titleInput", "addressInput", "startTime", "endTime", "descInput", "posterInput", "mediaInput"].forEach(id => {
        document.getElementById(id).value = "";
    });
    tempLatLng = null;
    document.getElementById("postMediaPreview").innerHTML = "";
}

function cancelPostForm() {
    clearPostForm();
    document.getElementById("post-form").classList.add("hidden");
}

// ==== 地址定位 ====
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

// ==== 图片实时预览 ====
function previewMediaInput() {
    const mediaInput = document.getElementById("mediaInput").value.trim();
    const preview = document.getElementById("postMediaPreview");
    preview.innerHTML = "";
    if (!mediaInput) return;
    // 多图片支持，分行/逗号/分号分割
    let urls = mediaInput.split(/\s*[,;\n]\s*/).filter(Boolean);
    urls.forEach(url => {
        if (isImageURL(url)) {
            let img = document.createElement("img");
            img.src = url;
            img.style.maxWidth = "60px";
            img.style.maxHeight = "60px";
            img.style.borderRadius = "4px";
            img.style.margin = "2px";
            preview.appendChild(img);
        }
    });
}
document.getElementById("mediaInput").addEventListener("input", previewMediaInput);

// ==== 工具函数 ====
function isImageURL(url) {
    return /\.(png|jpg|jpeg|gif|bmp|svg|webp)(\?.*)?$/i.test(url);
}
function formatTime(dtstr) {
    if (!dtstr) return "";
    let d = new Date(dtstr);
    let m = d.getMonth() + 1;
    let day = d.getDate();
    let hour = d.getHours().toString().padStart(2, '0');
    let min = d.getMinutes().toString().padStart(2, '0');
    return `${m}月${day}日 ${hour}:${min}`;
}

// ==== 加载活动数据 ====
async function loadActivities() {
    // 清除老的marker
    postMarkers.forEach(marker => map.removeLayer(marker));
    postMarkers = [];
    // 拉取
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('start_time', { ascending: true });
    if (error) {
        notify("活动加载失败: " + error.message);
        return;
    }
    data.forEach((post, idx) => {
        // 多图片
        let mediaContent = "";
        if (post.images && post.images.length > 0 && isImageURL(post.images[0])) {
            mediaContent = `<img src="${post.images[0]}" style="max-width:210px;max-height:120px;border-radius:6px;margin-top:6px;">`;
        }
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
            ${mediaContent}
          </div>
        `;
        let marker = L.marker([post.lat, post.lng]).addTo(map).bindPopup(popup);
        postMarkers.push(marker);
        marker.on('popupopen', function() {
            setTimeout(() => {
                let popupEl = document.querySelector('.popup-inner[data-idx="'+idx+'"]');
                if (popupEl) {
                    popupEl.onclick = function(e) {
                        showDetailForm(post);
                    };
                }
            }, 0);
        });
    });
}

// ==== 发帖同步到 Supabase ====
async function submitPost() {
    const title = document.getElementById("titleInput").value.trim();
    const address = document.getElementById("addressInput").value.trim();
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const desc = document.getElementById("descInput").value.trim();
    const poster = document.getElementById("posterInput").value.trim();
    const mediaInput = document.getElementById("mediaInput").value.trim();

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

    // 多图片，分割
    let images = mediaInput
        ? mediaInput.split(/\s*[,;\n]\s*/).filter(url => isImageURL(url))
        : [];

    const post = {
        title,
        address,
        start_time: startTime,
        end_time: endTime,
        desc,
        poster,
        images,
        lat: tempLatLng[0],
        lng: tempLatLng[1],
        created_at: new Date().toISOString()
    };
    // 上传到supabase
    const { error } = await supabase.from('activities').insert([post]);
    if (error) {
        notify("活动发布失败: " + error.message);
        return;
    }
    notify("活动发布成功！", 1600);
    document.getElementById("post-form").classList.add("hidden");
    clearPostForm();
    await loadActivities(); // 发布后刷新
}

// ==== 活动详情表单 ====
function showDetailForm(post) {
    document.getElementById("detailTitle").value = post.title || "";
    document.getElementById("detailAddress").value = post.address || "";
    document.getElementById("detailStartTime").value = post.start_time || "";
    document.getElementById("detailEndTime").value = post.end_time || "";
    document.getElementById("detailDesc").value = post.desc || "";
    document.getElementById("detailPoster").value = post.poster || "";
    // 图片大图展示
    let detailMediaWrap = document.getElementById("detailMediaWrap");
    detailMediaWrap.innerHTML = "";
    if (post.images && post.images.length > 0) {
        post.images.forEach(url => {
            if (isImageURL(url)) {
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
                detailMediaWrap.appendChild(img);
            }
        });
    }
    document.getElementById("detail-form").classList.remove("hidden");
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

// ==== 初始化 ====
window.onload = function() {
    updateClock();
    loadActivities();
    previewMediaInput(); // 初始时预览
};
