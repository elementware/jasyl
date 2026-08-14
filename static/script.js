// ============================================
//  КОНФИГУРАЦИЯ
// ============================================
const API_BASE = 'https://jasyl-3.onrender.com';

const TREE_STATUSES = {
    healthy: { label: 'Здоровое', color: '#34c759', bgColor: 'rgba(52, 199, 89, 0.12)' },
    dead: { label: 'Сухое', color: '#ff9500', bgColor: 'rgba(255, 149, 0, 0.12)' },
    trunk_damaged: { label: 'Повр. ствол', color: '#8e8e93', bgColor: 'rgba(142, 142, 147, 0.12)' },
    branch_damaged: { label: 'Опасные ветви', color: '#ff3b30', bgColor: 'rgba(255, 59, 48, 0.12)' },
    leaning: { label: 'Наклонённое', color: '#aeaeb2', bgColor: 'rgba(174, 174, 178, 0.12)' },
    diseased: { label: 'Болезнь', color: '#1c1c1e', bgColor: 'rgba(28, 28, 30, 0.08)' },
    needs_check: { label: 'Проверка', color: '#007aff', bgColor: 'rgba(0, 122, 255, 0.12)' }
};

// ============================================
//  КАРТА
// ============================================
var map = L.map('map', {
    fullscreenControl: false,
    attributionControl: false,
    zoomControl: true
}).setView([53.1706, 63.5845], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

var markers = {};
var allTrees = [];
var selectedTreeId = null;
var currentFilter = null;
var requestPhotoBase64 = null;
var lastSyncTime = localStorage.getItem('lastSyncTime') || '—';
var isUploading = false;

// ============================================
//  LIGHTBOX
// ============================================
function openFullscreenImage(src) {
    var old = document.querySelector('.lightbox-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        cursor: pointer;
        animation: fadeIn 0.2s ease;
    `;

    var img = document.createElement('img');
    img.src = src;
    img.style.cssText = `
        max-width: 95%;
        max-height: 95%;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        object-fit: contain;
    `;

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: none;
        border: none;
        color: white;
        font-size: 32px;
        font-weight: 300;
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 8px;
        background: rgba(0,0,0,0.3);
        transition: background 0.2s;
        font-family: var(--font, sans-serif);
    `;
    closeBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.2)'; };
    closeBtn.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.3)'; };

    overlay.appendChild(img);
    overlay.appendChild(closeBtn);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target === closeBtn) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

// ============================================
//  МАРКЕРЫ
// ============================================
function createMaterialMarker(status, count) {
    var info = TREE_STATUSES[status] || TREE_STATUSES.needs_check;
    var color = info.color;
    var label = count !== undefined ? count : '';

    var div = document.createElement('div');
    div.className = 'material-marker';
    div.style.width = '32px';
    div.style.height = '32px';
    div.style.background = color;
    div.style.color = 'white';
    div.style.fontSize = label.length > 2 ? '8px' : '10px';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.borderRadius = '50%';
    div.style.border = '2px solid white';
    div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    div.style.fontWeight = '600';
    div.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
    div.textContent = label;

    return L.divIcon({
        html: div.outerHTML,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

function renderLegend(trees) {
    var container = document.getElementById('legendContainer');
    if (!container) return;

    var counts = {};
    trees.forEach(function(t) {
        var s = t.status || 'needs_check';
        counts[s] = (counts[s] || 0) + 1;
    });

    var html = '';
    var isAll = currentFilter === null;
    html += '<button class="legend-btn ' + (isAll ? 'active' : '') + '" data-status="all">' +
        '<span class="dot" style="background:#8e8e93;"></span>Все' +
        '<span class="count-badge">' + trees.length + '</span></button>';

    for (var status in TREE_STATUSES) {
        var info = TREE_STATUSES[status];
        var count = counts[status] || 0;
        var isActive = currentFilter === status;
        html += '<button class="legend-btn ' + (isActive ? 'active' : '') + '" data-status="' + status + '">' +
            '<span class="dot" style="background:' + info.color + ';"></span>' +
            info.label +
            '<span class="count-badge">' + count + '</span></button>';
    }
    container.innerHTML = html;

    document.querySelectorAll('.legend-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var status = this.dataset.status;
            currentFilter = status === 'all' ? null : status;
            renderMarkers(allTrees);
            renderLegend(allTrees);
        });
    });
}

function renderMarkers(trees) {
    Object.values(markers).forEach(function(m) { map.removeLayer(m); });
    markers = {};

    var filtered = currentFilter ? trees.filter(function(t) { return t.status === currentFilter; }) : trees;

    var statusCounts = {};
    filtered.forEach(function(t) {
        var s = t.status || 'needs_check';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    filtered.forEach(function(t) {
        if (!t.lat || !t.lon) return;
        var status = t.status || 'needs_check';
        var count = statusCounts[status];
        var icon = createMaterialMarker(status, count);
        var info = TREE_STATUSES[status] || TREE_STATUSES.needs_check;

        var marker = L.marker([t.lat, t.lon], {
            icon: icon,
            title: info.label
        }).addTo(map);

        marker.bindPopup('<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:4px 0;">' +
            '<strong style="font-size:15px;">' + (t.common_name || t.species) + '</strong><br>' +
            '<span style="color:#8e8e93;font-size:13px;">' + info.label + '</span><br>' +
            '<button onclick="selectTree(\'' + t.id + '\')" style="' +
                'background: #007aff;color: white;border: none;border-radius: 6px;' +
                'padding: 4px 14px;font-size: 12px;font-weight: 500;margin-top: 6px;' +
                'cursor: pointer;font-family: inherit;">Подробнее</button></div>');

        marker.on('click', function() { selectTree(t.id); });
        markers[t.id] = marker;
    });
}

// ============================================
//  ОФЛАЙН-ХРАНИЛИЩЕ
// ============================================
const DB_NAME = 'JasylOfflineDB';
const STORE_NAME = 'trees';
var db = null;

function openDB() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = function(e) { resolve(e.target.result); };
        request.onerror = function(e) { reject(e.target.error); };
    });
}

async function saveTreeOffline(tree) {
    try {
        if (!db) db = await openDB();
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(tree);
        await new Promise(function(resolve, reject) {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    } catch (e) {
        console.warn('Не удалось сохранить офлайн:', e);
    }
}

async function loadTreesOffline() {
    try {
        if (!db) db = await openDB();
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(STORE_NAME, 'readonly');
            var store = tx.objectStore(STORE_NAME);
            var request = store.getAll();
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
        });
    } catch (e) {
        console.warn('Не удалось загрузить офлайн:', e);
        return [];
    }
}

async function deleteTreeOffline(id) {
    try {
        if (!db) db = await openDB();
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        await new Promise(function(resolve, reject) {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    } catch (e) {
        console.warn('Не удалось удалить офлайн:', e);
    }
}

async function syncOfflineTrees() {
    if (!navigator.onLine) return;
    var offlineTrees = await loadTreesOffline();
    for (var i = 0; i < offlineTrees.length; i++) {
        var tree = offlineTrees[i];
        try {
            var res = await fetch(API_BASE + '/api/trees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tree)
            });
            if (res.ok) {
                await deleteTreeOffline(tree.id);
            }
        } catch (e) {
            console.warn('Не удалось синхронизировать:', tree.id, e);
        }
    }
    await loadTrees();
}

// ============================================
//  ДАННЫЕ (БЕЗ МОК-ДАННЫХ)
// ============================================
async function loadTrees() {
    console.log('🌳 Загрузка деревьев с сервера...');
    try {
        var res = await fetch(API_BASE + '/api/trees');
        if (!res.ok) throw new Error('Ошибка');
        allTrees = await res.json();
        console.log('✅ Получено деревьев:', allTrees.length);
        renderMarkers(allTrees);
        renderLegend(allTrees);
        if (allTrees.length > 0) selectTree(allTrees[0].id);
        updateStatusBar();
        updateDashboard();
    } catch (e) {
        console.warn('⚠️ Бэкенд не отвечает, карта пуста');
        allTrees = [];
        renderMarkers(allTrees);
        renderLegend(allTrees);
        updateStatusBar();
        updateDashboard();
    }
}

// ============================================
//  DASHBOARD
// ============================================
function updateDashboard() {
    console.log('📊 Обновление Dashboard');
    var total = allTrees.length;
    var healthy = allTrees.filter(function(t) { return t.status === 'healthy'; }).length;
    var damaged = allTrees.filter(function(t) {
        return t.status === 'trunk_damaged' || t.status === 'branch_damaged';
    }).length;
    var dead = allTrees.filter(function(t) { return t.status === 'dead'; }).length;

    document.getElementById('dashTotal').textContent = total;
    document.getElementById('dashHealthy').textContent = healthy;
    document.getElementById('dashDamaged').textContent = damaged;
    document.getElementById('dashDead').textContent = dead;
    document.getElementById('dashStatus').textContent = navigator.onLine ? '🟢 Онлайн' : '🔴 Офлайн';
    document.getElementById('dashSyncTime').textContent = document.getElementById('lastSyncTime').textContent || '—';

    fetch(API_BASE + '/api/requests')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var pending = data.filter(function(r) {
                return r.status === 'pending' || r.status === 'in_progress';
            }).length;
            document.getElementById('dashRequests').textContent = pending;
        })
        .catch(function() {
            document.getElementById('dashRequests').textContent = '—';
        });
}

// ============================================
//  СТАТУС-БАР
// ============================================
function updateStatusBar() {
    document.getElementById('totalTreesCount').textContent = allTrees.length;
    document.getElementById('lastSyncTime').textContent = lastSyncTime;
    updateOnlineStatus(navigator.onLine);
}

function updateOnlineStatus(online) {
    var dot = document.getElementById('statusDot');
    var text = document.getElementById('statusText');
    if (online) {
        dot.className = 'w-3 h-3 rounded-full bg-green-500 inline-block';
        text.textContent = 'Онлайн';
    } else {
        dot.className = 'w-3 h-3 rounded-full bg-red-500 inline-block';
        text.textContent = 'Офлайн';
    }
}

// ============================================
//  ПАСПОРТ
// ============================================
function selectTree(id) {
    console.log('🌳 Выбрано дерево:', id);
    selectedTreeId = id;
    var tree = allTrees.find(function(t) { return t.id === id; });
    if (!tree) return;

    document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.add('hidden'); });
    var passport = document.getElementById('tab-passport');
    if (passport) passport.classList.remove('hidden');

    var info = TREE_STATUSES[tree.status] || TREE_STATUSES.needs_check;

    var preview = document.getElementById('photoPreview');
    if (preview) {
        var photoUrl = tree.photo_url;
        if (photoUrl && photoUrl.startsWith('/uploads/')) {
            photoUrl = API_BASE + photoUrl;
        }
        preview.src = photoUrl || 'https://picsum.photos/600/400?random=0';
        preview.style.cursor = 'pointer';
        preview.onclick = function() {
            if (preview.src && preview.src !== 'https://picsum.photos/600/400?random=0') {
                openFullscreenImage(preview.src);
            }
        };
    }

    var title = document.getElementById('speciesTitle');
    if (title) title.textContent = tree.common_name || tree.species || '—';

    var species = document.getElementById('species');
    if (species) species.textContent = tree.common_name || tree.species || '—';

    var condition = document.getElementById('condition');
    if (condition) condition.textContent = info.label;

    var confidence = document.getElementById('confidence');
    if (confidence) confidence.textContent = tree.confidence ? (tree.confidence * 100).toFixed(0) + '%' : '—';

    var lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) lastUpdate.textContent = tree.last_inspection ? new Date(tree.last_inspection).toLocaleString('ru-RU') : '—';

    var coords = document.getElementById('coordsDisplay');
    if (coords) coords.textContent = (tree.lat && tree.lon) ? tree.lat.toFixed(6) + ', ' + tree.lon.toFixed(6) : '—';

    var badge = document.getElementById('statusBadge');
    if (badge) {
        badge.textContent = info.label;
        badge.style.backgroundColor = info.color;
    }

    var recs = document.getElementById('recommendations');
    if (recs) {
        recs.innerHTML = (tree.recommendations && tree.recommendations.length) ?
            tree.recommendations.map(function(r) { return '<li>' + r + '</li>'; }).join('') :
            '<li class="text-gray-400">Нет рекомендаций</li>';
    }

    var historyList = document.getElementById('historyList');
    if (historyList) {
        historyList.innerHTML = (tree.history && tree.history.length) ?
            tree.history.map(function(h) {
                return '<li>' + new Date(h.date).toLocaleString('ru-RU') + ' — ' + (TREE_STATUSES[h.status]?.label || h.status) + '</li>';
            }).join('') :
            '<li class="text-gray-400">Нет истории</li>';
    }

    if (tree.lat && tree.lon) {
        map.setView([tree.lat, tree.lon], 16);
    }

    var noTree = document.getElementById('noTreeSelected');
    if (noTree) noTree.classList.add('hidden');

    var card = document.getElementById('card');
    if (card) card.classList.remove('hidden');
}

// ============================================
//  ЗАГРУЗКА ФОТО
// ============================================
async function handleFile(file) {
    if (!file) return;
    if (isUploading) {
        console.warn('Загрузка уже выполняется');
        return;
    }

    isUploading = true;
    var statusBadge = document.getElementById('statusBadge');
    var originalText = statusBadge ? statusBadge.textContent : '';

    try {
        if (statusBadge) {
            statusBadge.textContent = '⏳ Анализ...';
            statusBadge.style.backgroundColor = '#f59e0b';
        }

        var formData = new FormData();
        formData.append('file', file);

        if (navigator.onLine) {
            var response = await fetch(API_BASE + '/upload', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Ошибка загрузки: HTTP ' + response.status);
            var data = await response.json();

            if (data.photo_url && data.photo_url.startsWith('/uploads/')) {
                data.photo_url = API_BASE + data.photo_url;
            }

            allTrees.push(data);
            renderMarkers(allTrees);
            renderLegend(allTrees);
            selectTree(data.id);
            alert('✅ Фото загружено!');
        } else {
            var reader = new FileReader();
            var base64 = await new Promise(function(resolve, reject) {
                reader.onload = function(e) { resolve(e.target.result); };
                reader.onerror = function() { reject(new Error('Не удалось прочитать файл')); };
                reader.readAsDataURL(file);
            });

            var newTree = {
                id: 'offline-' + Date.now(),
                species: 'Новое дерево (офлайн)',
                common_name: 'Неизвестно',
                status: 'needs_check',
                confidence: 0.5,
                lat: map.getCenter().lat,
                lon: map.getCenter().lng,
                photo_url: base64,
                last_inspection: new Date().toISOString(),
                recommendations: ['Требуется проверка при синхронизации'],
                history: [{ date: new Date().toISOString(), status: 'needs_check' }]
            };

            await saveTreeOffline(newTree);
            allTrees.push(newTree);
            renderMarkers(allTrees);
            renderLegend(allTrees);
            selectTree(newTree.id);
            alert('📱 Фото сохранено локально.');
        }
    } catch (err) {
        console.error('Ошибка загрузки фото:', err);
        alert('❌ Ошибка: ' + err.message);
    } finally {
        isUploading = false;
        if (statusBadge) {
            statusBadge.textContent = originalText;
            var tree = allTrees.find(function(t) { return t.id === selectedTreeId; });
            statusBadge.style.backgroundColor = tree ? (TREE_STATUSES[tree.status]?.color || '#3b82f6') : '#3b82f6';
        }
    }
}

// ============================================
//  НАВИГАЦИЯ
// ============================================
function switchTab(tab) {
    console.log('🔄 Переключение на вкладку:', tab);
    document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.add('hidden'); });
    var target = document.getElementById('tab-' + tab);
    if (target) target.classList.remove('hidden');
    if (tab === 'map') {
        setTimeout(function() { map.invalidateSize(); }, 100);
    }

    document.querySelectorAll('.bottom-nav-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM загружен');

    // ---- НИЖНЯЯ НАВИГАЦИЯ ----
    document.querySelectorAll('#bottomNav .bottom-nav-btn[data-tab]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var tab = this.dataset.tab;
            if (!tab) return;
            switchTab(tab);
        });
    });

    // ---- ДРУГИЕ КНОПКИ С data-tab ----
    document.querySelectorAll('.btn-primary[data-tab], .btn-back[data-tab]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var tab = this.dataset.tab;
            if (!tab) return;
            switchTab(tab);
        });
    });

    // ---- КАМЕРА ----
    var cameraInput = document.getElementById('cameraInput');
    var cameraBtn = document.getElementById('cameraBtn');

    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (isUploading) {
                console.warn('Загрузка уже выполняется');
                return;
            }
            cameraInput.click();
        });

        cameraInput.addEventListener('change', async function() {
            var file = this.files && this.files[0];
            this.value = '';
            if (!file) return;
            await handleFile(file);
        });
    }

    // ---- ПРОЧИЕ КНОПКИ ----
    document.getElementById('syncNowBtn')?.addEventListener('click', function() {
        if (navigator.onLine) {
            syncOfflineTrees();
            loadTrees();
            alert('🔄 Синхронизация выполнена!');
        } else {
            alert('❌ Нет интернета.');
        }
    });

    document.getElementById('fullscreenBtn')?.addEventListener('click', function() {
        var el = document.documentElement;
        if (!document.fullscreenElement) {
            el.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    });

    document.getElementById('reportBtn')?.addEventListener('click', function() {
        var status = document.getElementById('reportStatusFilter').value;
        var from = document.getElementById('reportDateFrom').value;
        var to = document.getElementById('reportDateTo').value;
        alert('📄 Отчёт:\nСтатус: ' + status + '\nС: ' + (from || '—') + '\nПо: ' + (to || '—'));
    });

    document.getElementById('applyReportFilterBtn')?.addEventListener('click', function() {
        var status = document.getElementById('reportStatusFilter').value;
        var filtered = status === 'all' ? allTrees : allTrees.filter(function(t) { return t.status === status; });
        alert('📊 Отфильтровано: ' + filtered.length + ' деревьев');
    });

    // ---- ЗАЯВКИ ----
    document.getElementById('submitRequestBtn')?.addEventListener('click', function() {
        submitRequest();
    });

    document.getElementById('requestPhotoBtn')?.addEventListener('click', function() {
        document.getElementById('requestPhotoInput').click();
    });

    document.getElementById('requestPhotoInput')?.addEventListener('change', function(e) {
        if (this.files && this.files.length > 0) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                requestPhotoBase64 = ev.target.result;
                document.getElementById('requestPhotoImg').src = requestPhotoBase64;
                document.getElementById('requestPhotoPreview').classList.remove('hidden');
                document.getElementById('requestPhotoStatus').textContent = '✅ фото добавлено';
                document.getElementById('requestPhotoStatus').style.color = '#34c759';
            };
            reader.readAsDataURL(this.files[0]);
            this.value = '';
        }
    });

    document.getElementById('requestTreeSelect')?.addEventListener('change', function() {
        var treeId = this.value;
        if (!treeId) {
            document.getElementById('selectedTreeInfo').classList.add('hidden');
            return;
        }
        var tree = allTrees.find(function(t) { return t.id === treeId; });
        if (tree) {
            document.getElementById('selectedTreeInfo').classList.remove('hidden');
            document.getElementById('reqCoords').textContent = tree.lat && tree.lon ?
                tree.lat.toFixed(6) + ', ' + tree.lon.toFixed(6) : '—';
            document.getElementById('reqStatus').textContent = TREE_STATUSES[tree.status]?.label || tree.status || '—';
            document.getElementById('reqLastInspection').textContent = tree.last_inspection ?
                new Date(tree.last_inspection).toLocaleString('ru-RU') : '—';
        }
    });

    // ---- ЗАГРУЗКА ДАННЫХ ----
    loadTrees();
    loadRequests();
    console.log('🌳 JASYL загружен!');
});

// ============================================
//  ЗАЯВКИ
// ============================================
function populateTreeSelect() {
    var select = document.getElementById('requestTreeSelect');
    if (!select) return;
    select.innerHTML = '<option value="">— Выберите дерево —</option>' +
        allTrees.map(function(t) {
            return '<option value="' + t.id + '">' + (t.common_name || t.species) + '</option>';
        }).join('');
}

function submitRequest() {
    var treeSelect = document.getElementById('requestTreeSelect');
    var treeId = treeSelect ? treeSelect.value : '';

    if (!treeId) {
        alert('🌳 Выберите дерево!');
        return;
    }

    var data = {
        tree_id: treeId,
        type: document.getElementById('requestType')?.value || 'pruning',
        priority: document.getElementById('requestPriority')?.value || 'medium',
        status: document.getElementById('requestStatusSelect')?.value || 'pending',
        comment: document.getElementById('requestComment')?.value || '',
        due_date: document.getElementById('requestDueDate')?.value || '',
        photo_base64: requestPhotoBase64 || null
    };

    var tree = allTrees.find(function(t) { return t.id === treeId; });
    if (tree) {
        data.lat = tree.lat;
        data.lon = tree.lon;
        data.tree_status = tree.status;
        data.tree_name = tree.common_name || tree.species;
    }

    if (navigator.onLine) {
        fetch(API_BASE + '/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Ошибка сервера');
            return res.json();
        })
        .then(function() {
            alert('✅ Заявка создана!');
            clearRequestForm();
            loadRequests();
            updateDashboard();
        })
        .catch(function(err) {
            alert('❌ Ошибка: ' + err.message);
        });
    } else {
        data.id = 'offline-' + Date.now();
        data.created_at = new Date().toISOString();
        var offlineRequests = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
        offlineRequests.push(data);
        localStorage.setItem('offlineRequests', JSON.stringify(offlineRequests));
        alert('📱 Заявка сохранена локально');
        clearRequestForm();
        loadRequests();
        updateDashboard();
    }
}

function clearRequestForm() {
    document.getElementById('requestComment').value = '';
    document.getElementById('requestDueDate').value = '';
    document.getElementById('requestPhotoPreview').classList.add('hidden');
    document.getElementById('requestPhotoStatus').textContent = 'нет фото';
    document.getElementById('requestPhotoStatus').style.color = '#9ca3af';
    requestPhotoBase64 = null;
    document.getElementById('selectedTreeInfo').classList.add('hidden');
    var select = document.getElementById('requestTreeSelect');
    if (select) select.value = '';
}

function loadRequests() {
    console.log('📋 Загрузка списка заявок');
    var container = document.getElementById('requestsList');
    if (!container) return;

    if (navigator.onLine) {
        fetch(API_BASE + '/api/requests')
            .then(function(res) {
                if (!res.ok) throw new Error('Ошибка');
                return res.json();
            })
            .then(function(data) {
                var offline = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
                if (Array.isArray(offline) && offline.length > 0) {
                    syncOfflineRequests(offline);
                }
                renderRequests(data || []);
                updateStatusBar();
                updateDashboard();
            })
            .catch(function(err) {
                console.warn('Ошибка загрузки заявок:', err);
                var offline = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
                renderRequests(Array.isArray(offline) ? offline : []);
            });
    } else {
        var offline = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
        renderRequests(Array.isArray(offline) ? offline : []);
    }
}

function syncOfflineRequests(offlineRequests) {
    if (!offlineRequests || !Array.isArray(offlineRequests) || offlineRequests.length === 0) {
        return;
    }
    if (!navigator.onLine) return;

    var synced = 0;
    offlineRequests.forEach(function(req) {
        var sendData = Object.assign({}, req);
        delete sendData.id;

        fetch(API_BASE + '/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sendData)
        })
        .then(function(res) {
            if (res.ok) synced++;
            if (synced === offlineRequests.length) {
                localStorage.removeItem('offlineRequests');
                loadRequests();
                updateDashboard();
            }
        })
        .catch(function() {});
    });
}

function renderRequests(requests) {
    var container = document.getElementById('requestsList');
    if (!container) return;

    if (!requests || requests.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">📭 Нет заявок</div>';
        return;
    }

    container.innerHTML = requests.map(function(r) {
        var priorityClass = r.priority === 'emergency' ? 'priority-emergency' :
                           r.priority === 'high' ? 'priority-high' :
                           r.priority === 'medium' ? 'priority-medium' : 'priority-low';

        var statusText = r.status === 'done' ? '✅ Выполнено' :
                        r.status === 'in_progress' ? '🔄 В работе' :
                        r.status === 'rejected' ? '❌ Отклонено' : '⏳ Ожидает';

        var statusClass = r.status === 'done' ? 'bg-green-100 text-green-700' :
                         r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                         r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';

        var treeInfo = allTrees.find(function(t) { return t.id === r.tree_id; });
        var coordsText = r.lat && r.lon ? r.lat.toFixed(6) + ', ' + r.lon.toFixed(6) :
                        (treeInfo?.lat && treeInfo?.lon ? treeInfo.lat.toFixed(6) + ', ' + treeInfo.lon.toFixed(6) : '—');

        return '<div class="request-item ' + priorityClass + '">' +
            '<div class="flex flex-wrap justify-between items-start gap-2">' +
                '<div class="flex-1 min-w-0">' +
                    '<div class="flex items-center gap-2 flex-wrap">' +
                        '<span class="font-bold text-sm">🌳 ' + (r.tree_name || treeInfo?.common_name || treeInfo?.species || 'Дерево') + '</span>' +
                        '<span class="text-xs bg-gray-200 px-2 py-0.5 rounded-full">' + r.type + '</span>' +
                        '<span class="text-xs px-2 py-0.5 rounded-full bg-gray-200">' + r.priority + '</span>' +
                    '</div>' +
                    '<div class="text-xs text-gray-500 mt-0.5">📍 ' + coordsText +
                        (r.tree_status ? ' • 🌿 ' + (TREE_STATUSES[r.tree_status]?.label || r.tree_status) : '') +
                    '</div>' +
                    '<div class="text-sm text-gray-700 mt-1">' + (r.comment || '—') + '</div>' +
                    '<div class="text-xs text-gray-400 mt-0.5">' +
                        '📅 ' + (r.due_date || 'Срок не указан') + ' • ' + new Date(r.created_at || Date.now()).toLocaleString() +
                        (r.photo_base64 ? ' • 📸 есть фото' : '') +
                    '</div>' +
                '</div>' +
                '<div class="flex flex-col items-end gap-1 ml-2 shrink-0">' +
                    '<span class="text-xs px-2 py-0.5 rounded-full ' + statusClass + '">' + statusText + '</span>' +
                    '<div class="flex gap-1 flex-wrap justify-end mt-1">' +
                        (r.status === 'pending' ? '<button onclick="updateRequestStatus(\'' + r.id + '\', \'in_progress\')" class="text-xs text-blue-500 hover:underline">В работу</button>' : '') +
                        (r.status === 'in_progress' ? '<button onclick="updateRequestStatus(\'' + r.id + '\', \'done\')" class="text-xs text-green-500 hover:underline">Готово</button>' : '') +
                        (r.status === 'pending' || r.status === 'in_progress' ? '<button onclick="updateRequestStatus(\'' + r.id + '\', \'rejected\')" class="text-xs text-red-500 hover:underline">Отклонить</button>' : '') +
                        (r.photo_base64 ? '<button onclick="showRequestPhoto(\'' + r.photo_base64 + '\')" class="text-xs text-purple-500 hover:underline">📸 Фото</button>' : '') +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function updateRequestStatus(id, status) {
    if (!navigator.onLine) {
        alert('❌ Нет интернета. Статус обновится при синхронизации.');
        return;
    }

    fetch(API_BASE + '/api/requests/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
    })
    .then(function(res) {
        if (!res.ok) throw new Error('Ошибка');
        return res.json();
    })
    .then(function() {
        loadRequests();
        updateDashboard();
    })
    .catch(function(err) {
        alert('❌ Ошибка обновления статуса: ' + err.message);
    });
}

function showRequestPhoto(base64) {
    var win = window.open('', '_blank');
    if (win) {
        win.document.write(
            '<html><head><title>📸 Фото заявки</title>' +
            '<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f5f5f7;}' +
            'img{max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.1);}</style>' +
            '</head><body><img src="' + base64 + '" alt="Фото" /></body></html>'
        );
        win.document.close();
    }
}

function updateAnalytics() {
    var total = allTrees.length;
    var healthy = allTrees.filter(function(t) { return t.status === 'healthy'; }).length;
    var dead = allTrees.filter(function(t) { return t.status === 'dead'; }).length;
    var damaged = allTrees.filter(function(t) {
        return t.status === 'trunk_damaged' || t.status === 'branch_damaged';
    }).length;

    var container = document.getElementById('analyticsContainer');
    if (container) {
        container.innerHTML =
            '<div class="stat-card"><div class="stat-number">' + total + '</div><div class="stat-label">Всего</div></div>' +
            '<div class="stat-card"><div class="stat-number" style="color:#34c759;">' + healthy + '</div><div class="stat-label">Здоровые</div></div>' +
            '<div class="stat-card"><div class="stat-number" style="color:#ff9500;">' + damaged + '</div><div class="stat-label">Повреждённые</div></div>' +
            '<div class="stat-card"><div class="stat-number" style="color:#ff3b30;">' + dead + '</div><div class="stat-label">Сухие</div></div>';
    }

    var forecast = document.getElementById('forecast');
    if (forecast) {
        forecast.innerHTML =
            '<p>🌳 Обрезка: <b>' + Math.floor(total * 0.15) + '</b></p>' +
            '<p>⚠️ Высокий риск: <b>' + Math.floor(total * 0.05) + '</b></p>';
    }
}

window.addEventListener('online', function() {
    updateOnlineStatus(true);
    lastSyncTime = new Date().toLocaleString();
    localStorage.setItem('lastSyncTime', lastSyncTime);
    document.getElementById('lastSyncTime').textContent = lastSyncTime;
    var offline = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
    if (Array.isArray(offline) && offline.length > 0) {
        syncOfflineRequests(offline);
    }
    syncOfflineTrees();
    loadTrees();
    loadRequests();
    updateDashboard();
});

window.addEventListener('offline', function() {
    updateOnlineStatus(false);
});

switchTab('dashboard');
