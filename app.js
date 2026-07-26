/**
 * IoT ESP32 Google Sheet Realtime Production Monitoring Engine
 * Features:
 * 1. Native Interactive Calendar & Date Picker Control:
 *    - Allows picking ANY date from native calendar popup (input type="date").
 *    - Allows typing any date directly from keyboard.
 *    - Leaving blank / clearing date defaults to 'ALL' (Tất cả các ngày).
 * 2. All 4 dashboard components, calculation formulas, status rules, and card aesthetics remain 100% intact!
 */

const DEFAULT_URLS = [
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBR0oZmoxg2spJo7e8k_xNQVXamfWX99yOoEqYTAjHVbhwjy06UBM7RbJQNFMhHeFSLwUm0qjggqCn/pub?gid=0&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBR0oZmoxg2spJo7e8k_xNQVXamfWX99yOoEqYTAjHVbhwjy06UBM7RbJQNFMhHeFSLwUm0qjggqCn/pub?gid=1926885863&single=true&output=csv'
];

// Global State
const state = {
    dataSource: 'multi_url',
    apiUrls: [...DEFAULT_URLS],
    pollIntervalMs: 5000,
    timerId: null,
    selectedDate: 'ALL', // 'ALL' or specific date e.g. '25/07/2026'
    allRawRowsHistory: [],
    failedAttemptsCount: 0,
    lastSuccessfulFetchTime: null,
    charts: {
        downtime: null,
        quality: null
    },
    catalogMaster: [
        { machineId: 'M-TPGEL001', prodCode: '616946', name: 'TP-GEL001', ratePcs: 0.80, stdRate: 1440, defaultTarget: 7920 },
        { machineId: 'M-TPGEL002', prodCode: '616947', name: 'TP-GEL002', ratePcs: 1.60, stdRate: 2880, defaultTarget: 15840 },
        { machineId: 'M-TPGEL003', prodCode: '616948', name: 'TP-GEL003', ratePcs: 1.60, stdRate: 5760, defaultTarget: 31680 },
        { machineId: 'M-TPGEL042', prodCode: '616945', name: 'TP-GEL042', ratePcs: 0.40, stdRate: 5760, defaultTarget: 31680 }
    ],
    currentData: []
};

// Demo Data Fallback
function getDemoData() {
    return [
        {
            machineId: 'M-TPGEL042',
            name: 'TP-GEL042',
            stdRate: 5760,
            target: 31680,
            actual: 26092,
            completionPct: 82,
            status: 'Chậm tiến độ',
            statusClass: 'cham-tien-do',
            rowStyle: 'row-orange',
            downtimePct: 4.8,
            qualityPct: 93.0,
            errors: [123, 80, null, null, null, null, null, null]
        },
        {
            machineId: 'M-TPGEL001',
            name: 'TP-GEL001',
            stdRate: 1440,
            target: 7920,
            actual: 7000,
            completionPct: 88,
            status: 'Kiểm soát',
            statusClass: 'kiem-soat',
            rowStyle: 'row-yellow',
            downtimePct: 5.0,
            qualityPct: 95.0,
            errors: [171, 256, null, null, null, null, null, null]
        },
        {
            machineId: 'M-TPGEL003',
            name: 'TP-GEL003',
            stdRate: 5760,
            target: 31680,
            actual: 29594,
            completionPct: 93,
            status: 'Đang sx',
            statusClass: 'dang-sx',
            rowStyle: 'row-lightgreen',
            downtimePct: 5.5,
            qualityPct: 99.0,
            errors: [245, 370, null, null, null, null, null, null]
        },
        {
            machineId: 'M-TPGEL002',
            name: 'TP-GEL002',
            stdRate: 2880,
            target: 15840,
            actual: 14850,
            completionPct: 94,
            status: 'Đang sx',
            statusClass: 'dang-sx',
            rowStyle: 'row-lightgreen',
            downtimePct: 4.5,
            qualityPct: 92.0,
            errors: [440, 292, null, null, null, null, null, null]
        }
    ];
}

// Dom Ready
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initEventListeners();
    loadSavedSettings();
    startPolling();
});

// Load Saved Settings from LocalStorage & Ensure Default URLs exist
function loadSavedSettings() {
    let savedType = localStorage.getItem('iot_data_source') || 'multi_url';
    let savedUrls = [];
    try {
        savedUrls = JSON.parse(localStorage.getItem('iot_api_urls') || '[]');
    } catch(e) {
        savedUrls = [];
    }

    savedUrls = savedUrls.filter(u => u && u.trim().length > 0);

    const hasDefaultSheet = savedUrls.some(u => u.includes('2PACX-1vQBR0oZmoxg2spJo7e8k_xNQVXamfWX99yOoEqYTAjHVbhwjy06UBM7RbJQNFMhHeFSLwUm0qjggqCn'));
    if (savedUrls.length === 0 || !hasDefaultSheet) {
        savedUrls = [...DEFAULT_URLS];
        localStorage.setItem('iot_api_urls', JSON.stringify(DEFAULT_URLS));
    }

    state.dataSource = savedType;
    state.apiUrls = savedUrls;

    document.getElementById('dataSourceType').value = savedType;
    renderUrlInputFields();
    toggleUrlInputVisibility();
}

function renderUrlInputFields() {
    const container = document.getElementById('urlInputsContainer');
    if (!container) return;
    container.innerHTML = '';

    state.apiUrls.forEach((url, idx) => {
        const row = document.createElement('div');
        row.className = 'url-row-item';
        row.innerHTML = `
            <span class="url-badge">Link ${idx + 1}</span>
            <input type="text" class="form-control url-input-field" data-index="${idx}" value="${url}" placeholder="Dán URL Google Sheet CSV hoặc Apps Script tại đây...">
            ${state.apiUrls.length > 1 ? `<button type="button" class="btn btn-danger btn-sm btn-remove-url" data-index="${idx}"><i class="fa-solid fa-trash"></i> Xóa</button>` : ''}
        `;
        container.appendChild(row);
    });

    document.querySelectorAll('.btn-remove-url').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            state.apiUrls.splice(index, 1);
            renderUrlInputFields();
        });
    });
}

function toggleUrlInputVisibility() {
    const type = document.getElementById('dataSourceType').value;
    const urlGroup = document.getElementById('urlInputGroup');
    if (!urlGroup) return;
    if (type === 'demo') {
        urlGroup.style.display = 'none';
    } else {
        urlGroup.style.display = 'flex';
    }
}

// -------------------------------------------------------------
// 1. DATA FETCHING WITH PROXY FALLBACK
// -------------------------------------------------------------
function startPolling() {
    if (state.timerId) clearInterval(state.timerId);
    
    fetchData();
    
    const interval = parseInt(document.getElementById('pollInterval').value, 10);
    state.pollIntervalMs = interval;
    
    if (interval > 0) {
        state.timerId = setInterval(fetchData, interval);
    }
}

async function fetchWithFallback(baseUrl) {
    const cbUrl = baseUrl.includes('?') 
        ? `${baseUrl}&_cb=${Date.now()}` 
        : `${baseUrl}?_cb=${Date.now()}`;

    // Mirror 1: Direct fetch
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(cbUrl, { method: 'GET', redirect: 'follow', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const text = await res.text();
            if (text != null) return text;
        }
    } catch (e) {}

    // Mirror 2: Allorigins
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cbUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resProxy = await fetch(proxyUrl, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (resProxy.ok) {
            const text = await resProxy.text();
            if (text != null) return text;
        }
    } catch (e) {}

    // Mirror 3: Corsproxy.io
    try {
        const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(cbUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resProxy2 = await fetch(proxyUrl2, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (resProxy2.ok) {
            const text = await resProxy2.text();
            if (text != null) return text;
        }
    } catch (e) {}

    // Mirror 4: Codetabs
    try {
        const proxyUrl3 = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cbUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resProxy3 = await fetch(proxyUrl3, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (resProxy3.ok) {
            const text = await resProxy3.text();
            if (text != null) return text;
        }
    } catch (e) {}

    // Mirror 5: Thingproxy
    try {
        const proxyUrl4 = `https://thingproxy.freeboard.io/fetch/${cbUrl}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resProxy4 = await fetch(proxyUrl4, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (resProxy4.ok) {
            const text = await resProxy4.text();
            if (text != null) return text;
        }
    } catch (e) {}

    // Mirror 6: Cors.sh
    const proxyUrl5 = `https://proxy.cors.sh/${cbUrl}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resProxy5 = await fetch(proxyUrl5, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resProxy5.ok) throw new Error(`HTTP ${resProxy5.status}`);
    return await resProxy5.text();
}

// -------------------------------------------------------------
// DEEP CELL SCANNER DATE EXTRACTOR:
// Scans every cell value in a row for DD/MM/YYYY or YYYY-MM-DD
// -------------------------------------------------------------
function extractDateFromRow(r) {
    if (!r) return '';
    const values = Object.values(r);
    for (let raw of values) {
        if (!raw) continue;
        const str = String(raw).trim();
        const dmyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            const year = dmyMatch[3];
            return `${day}/${month}/${year}`;
        }
        const ymdMatch = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (ymdMatch) {
            const year = ymdMatch[1];
            const month = ymdMatch[2].padStart(2, '0');
            const day = ymdMatch[3].padStart(2, '0');
            return `${day}/${month}/${year}`;
        }
    }
    return '';
}

// Convert "YYYY-MM-DD" to "DD/MM/YYYY"
function ymdToDmy(ymdStr) {
    if (!ymdStr || !ymdStr.includes('-')) return '';
    const parts = ymdStr.split('-');
    if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return '';
}

async function fetchData() {
    try {
        if (state.dataSource === 'demo') {
            let data = getDemoData();
            data.sort((a, b) => a.completionPct - b.completionPct);
            state.currentData = data;
            renderDashboard(data);
            state.failedAttemptsCount = 0;
            updateStatusBadge('online', 'Mô phỏng IoT Real-Time');
            updateLastUpdateTimestamp();
        } else {
            const activeUrls = state.apiUrls.map(u => u.trim()).filter(u => u.length > 0);
            if (activeUrls.length === 0) {
                throw new Error('Chưa nhập URL kết nối!');
            }

            const fetchPromises = activeUrls.map(async (url) => {
                const responseText = await fetchWithFallback(url);
                const isCsvUrl = url.includes('/pub') || url.includes('output=csv') || responseText.includes(',') || responseText.includes('\n');
                
                if (isCsvUrl) {
                    return parseCsvToRawRows(responseText);
                } else {
                    try {
                        const json = JSON.parse(responseText);
                        return Array.isArray(json) ? json : [];
                    } catch (e) {
                        return parseCsvToRawRows(responseText);
                    }
                }
            });

            const results = await Promise.allSettled(fetchPromises);
            
            let allRawRows = [];
            let catalogRows = [];
            let successCount = 0;
            
            results.forEach(res => {
                if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                    res.value.forEach(row => {
                        if (row['Năng suất (pcs/1s)'] != null || row['Năng suất chuẩn (pc/h)'] != null) {
                            catalogRows.push(row);
                        } else if (extractDateFromRow(row) || row['Mã máy'] || row['Mã sản phẩm']) {
                            allRawRows.push(row);
                        }
                    });
                    successCount++;
                }
            });

            if (successCount > 0) {
                if (catalogRows.length > 0) {
                    catalogRows.forEach(cat => {
                        const prod = state.catalogMaster.find(p => p.machineId === cat['Mã máy'] || p.prodCode == cat['Mã sản phẩm']);
                        if (prod) {
                            const rate = parseVietnameseFloat(cat['Năng suất (pcs/1s)']);
                            const stdRate = parseVietnameseFloat(cat['Năng suất chuẩn (pc/h)']);
                            if (stdRate > 0) {
                                prod.stdRate = stdRate;
                            } else if (rate > 0) {
                                prod.stdRate = Math.round(rate * 3600);
                            }
                            const target = parseVietnameseFloat(cat['Mục tiêu']);
                            if (target > 0) prod.defaultTarget = target;
                        }
                    });
                }

                state.allRawRowsHistory = allRawRows;

                // Filter rows by Selected Date
                let filteredRows = allRawRows;
                if (state.selectedDate && state.selectedDate !== 'ALL') {
                    filteredRows = allRawRows.filter(r => extractDateFromRow(r) === state.selectedDate);
                }

                const processed = parseRawSheetJson(filteredRows);
                state.currentData = processed;
                renderDashboard(processed);

                state.failedAttemptsCount = 0;
                state.lastSuccessfulFetchTime = new Date();
                updateStatusBadge('online', `Google Sheet Connected (${successCount}/${activeUrls.length} Links)`);
                updateLastUpdateTimestamp();
            } else {
                throw new Error('Không thể kết nối đến các URL Google Sheet!');
            }
        }
    } catch (err) {
        state.failedAttemptsCount++;
        console.warn(`Fetch Attempt ${state.failedAttemptsCount} failed:`, err);
        
        if (state.failedAttemptsCount >= 5) {
            updateStatusBadge('offline', `Lỗi: ${err.message}`);
        } else {
            updateStatusBadge('online', `Đang tự đồng bộ lại (${state.failedAttemptsCount})...`);
        }
    }
}

function updateLastUpdateTimestamp() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN');
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const fullTimestampStr = `${dateStr} ${timeStr}`;
    document.getElementById('lastUpdateText').innerText = `Cập nhật: ${fullTimestampStr}`;
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return values;
}

function parseCsvToRawRows(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];
    
    const headers = parseCsvLine(lines[0]);
    
    return lines.slice(1).map(line => {
        const vals = parseCsvLine(line);
        let obj = {};
        headers.forEach((h, idx) => {
            obj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        return obj;
    });
}

function parseVietnameseFloat(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
}

// -------------------------------------------------------------
// BULLETPROOF SESSION DETECTOR & REAL-TIME ACCUMULATOR:
// Preserves 100% existing calculation formulas!
// -------------------------------------------------------------
function parseRawSheetJson(jsonRows) {
    if (!Array.isArray(jsonRows) || jsonRows.length === 0) return [];

    const presentKeys = new Set();
    jsonRows.forEach(r => {
        const mId = (r['Mã máy'] || '').trim();
        const pCode = (r['Mã sản phẩm'] || '').trim();
        if (mId && mId.length > 0) presentKeys.add(mId);
        if (pCode && pCode.length > 0) presentKeys.add(pCode);
    });

    if (presentKeys.size === 0) return [];

    const activeProducts = [];

    state.catalogMaster.forEach(prod => {
        const matches = Array.from(presentKeys).some(key => 
            key === prod.machineId || key == prod.prodCode || key === prod.name || key.includes(prod.machineId)
        );
        if (matches) {
            activeProducts.push(prod);
        }
    });

    if (activeProducts.length === 0) {
        presentKeys.forEach(key => {
            if (key.startsWith('M-') || key.startsWith('TP-') || key.length >= 4) {
                activeProducts.push({
                    machineId: key,
                    prodCode: key,
                    name: key,
                    ratePcs: 1.0,
                    stdRate: 3600,
                    defaultTarget: 10000
                });
            }
        });
    }

    const results = activeProducts.map(prod => {
        const prodRows = jsonRows.filter(r => {
            const mId = (r['Mã máy'] || '').trim();
            const pCode = (r['Mã sản phẩm'] || '').trim();
            return mId === prod.machineId || pCode == prod.prodCode || pCode === prod.name || (mId && mId.includes(prod.machineId));
        });

        if (prodRows.length === 0) {
            return null;
        }

        const sessions = [];
        let currentSession = [];
        let prevUptime = -1;
        let prevOk = -1;

        prodRows.forEach(r => {
            const up = parseVietnameseFloat(r['Thời Gian Hoạt Động (s)']);
            const ok = parseVietnameseFloat(r['Tổng Ok']);

            const isUptimeReset = (up <= 10 && prevUptime > 20);
            const isOkReset = (ok === 0 && prevOk > 0);

            if (currentSession.length > 0 && (isUptimeReset || isOkReset)) {
                sessions.push(currentSession);
                currentSession = [];
            }

            currentSession.push(r);
            prevUptime = up;
            prevOk = ok;
        });

        if (currentSession.length > 0) {
            sessions.push(currentSession);
        }

        let totalOk = 0;
        let totalNg = 0;
        let totalUptime = 0;
        let totalDowntime = 0;
        let totalErr1 = 0;
        let totalErr2 = 0;

        sessions.forEach(sess => {
            const maxOkSess = Math.max(...sess.map(r => parseVietnameseFloat(r['Tổng Ok'])), 0);
            const maxNgSess = Math.max(...sess.map(r => parseVietnameseFloat(r['Tổng Lỗi'])), 0);
            const maxUpSess = Math.max(...sess.map(r => parseVietnameseFloat(r['Thời Gian Hoạt Động (s)'])), 0);
            const maxDownSess = Math.max(...sess.map(r => parseVietnameseFloat(r['Thời Gian Dừng (s)'])), 0);
            const maxE1Sess = Math.max(...sess.map(r => parseVietnameseFloat(r['Lỗi cụm 1'])), 0);
            const maxE2Sess = Math.max(...sess.map(r => parseVietnameseFloat(r['Lỗi cụm 2'])), 0);

            totalOk += maxOkSess;
            totalNg += maxNgSess;
            totalUptime += maxUpSess;
            totalDowntime += maxDownSess;
            totalErr1 += maxE1Sess;
            totalErr2 += maxE2Sess;
        });

        const actual = Math.round(totalOk);
        const elapsedTimeSec = totalUptime + totalDowntime;
        const elapsedHours = elapsedTimeSec / 3600;

        let target = prod.defaultTarget;
        if (elapsedHours > 0) {
            const dynamicTarget = Math.round(prod.stdRate * elapsedHours);
            if (dynamicTarget > 0) {
                target = dynamicTarget;
            }
        }

        const completionPct = target > 0 ? Math.round((actual / target) * 100) : 0;

        let status = 'Đang sx';
        let statusClass = 'dang-sx';
        let rowStyle = 'row-lightgreen';

        if (actual === 0 && elapsedTimeSec === 0) {
            status = 'Chờ sx';
            statusClass = 'kiem-soat';
            rowStyle = 'row-yellow';
        } else if (completionPct < 85) {
            status = 'Chậm tiến độ';
            statusClass = 'cham-tien-do';
            rowStyle = 'row-orange';
        } else if (completionPct <= 90) {
            status = 'Kiểm soát';
            statusClass = 'kiem-soat';
            rowStyle = 'row-yellow';
        }

        const totalQty = actual + totalNg;
        const downtimePct = elapsedTimeSec > 0 ? +((totalDowntime / elapsedTimeSec) * 100).toFixed(1) : 0;
        const qualityPct = totalQty > 0 ? +((actual / totalQty) * 100).toFixed(1) : 100;

        const errors = [
            Math.round(totalErr1),
            Math.round(totalErr2),
            null,
            null,
            null,
            null,
            null,
            null
        ];

        return {
            machineId: prod.machineId,
            name: prod.name,
            stdRate: prod.stdRate,
            target: target,
            actual: actual,
            completionPct: completionPct,
            status: status,
            statusClass: statusClass,
            rowStyle: rowStyle,
            downtimePct: downtimePct,
            qualityPct: qualityPct,
            errors: errors
        };
    }).filter(item => item !== null);

    results.sort((a, b) => a.completionPct - b.completionPct);

    return results;
}

// -------------------------------------------------------------
// 2. RENDER DASHBOARD COMPONENTS
// -------------------------------------------------------------
function renderDashboard(data) {
    renderProductionTable(data);
    renderHeatmap(data);
    updateCharts(data);
}

function renderProductionTable(data) {
    const tbody = document.getElementById('productionTableBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #94a3b8; font-weight: 500;">
            <i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i> Không có dữ liệu sản xuất cho ngày đã chọn!
        </td></tr>`;
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = item.rowStyle || '';

        tr.innerHTML = `
            <td><b>${item.machineId}</b></td>
            <td><b>${item.name}</b></td>
            <td>${item.stdRate.toLocaleString('vi-VN')}</td>
            <td>${item.target.toLocaleString('vi-VN')}</td>
            <td>${item.actual.toLocaleString('vi-VN')}</td>
            <td><b>${item.completionPct}%</b></td>
            <td><span class="status-tag ${item.statusClass}">${item.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderHeatmap(data) {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 24px; color: #94a3b8;">Không có dữ liệu ma trận lỗi cho ngày đã chọn!</div>`;
        return;
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row';
    headerRow.innerHTML = '<div class="heatmap-header-cell">Tên máy</div>';
    for (let i = 1; i <= 8; i++) {
        headerRow.innerHTML += `<div class="heatmap-header-cell">Cụm ${i}</div>`;
    }
    container.appendChild(headerRow);

    data.forEach(item => {
        const row = document.createElement('div');
        row.className = 'heatmap-row';
        
        let rowHtml = `<div class="heatmap-label">${item.machineId}</div>`;

        item.errors.forEach((errCount, idx) => {
            if (errCount === null || errCount === undefined) {
                rowHtml += `<div class="heatmap-cell na">N/A</div>`;
            } else {
                const lvlClass = getHeatmapLevelClass(errCount);
                rowHtml += `<div class="heatmap-cell ${lvlClass}" title="Cụm ${idx+1}: ${errCount} lỗi">${errCount} lỗi</div>`;
            }
        });

        row.innerHTML = rowHtml;
        container.appendChild(row);
    });
}

function getHeatmapLevelClass(val) {
    if (val === 0) return 'lvl-1';
    if (val < 150) return 'lvl-1';
    if (val < 250) return 'lvl-2';
    if (val < 350) return 'lvl-3';
    if (val < 450) return 'lvl-4';
    if (val < 550) return 'lvl-5';
    return 'lvl-6';
}

// -------------------------------------------------------------
// 3. CHART.JS INITIALIZATION & DYNAMIC SCALE UPDATE
// -------------------------------------------------------------
function initCharts() {
    const ctxDowntime = document.getElementById('downtimeChart').getContext('2d');
    state.charts.downtime = new Chart(ctxDowntime, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Thời gian dừng (%)',
                data: [],
                backgroundColor: [],
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 4,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Dừng máy: ${ctx.raw}%`
                    }
                },
                annotation: {
                    annotations: {
                        targetLine: {
                            type: 'line',
                            yMin: 5.0,
                            yMax: 5.0,
                            borderColor: '#ef4444',
                            borderWidth: 3,
                            label: {
                                display: true,
                                content: '(5%) Target',
                                position: 'end',
                                color: '#ef4444',
                                font: { weight: 'bold', size: 12 },
                                backgroundColor: 'transparent'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#94a3b8',
                        callback: (v) => v + '%'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff', font: { weight: 'bold' } },
                    grid: { display: false }
                }
            }
        }
    });

    const ctxQuality = document.getElementById('qualityChart').getContext('2d');
    state.charts.quality = new Chart(ctxQuality, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Chất lượng (%)',
                data: [],
                backgroundColor: [],
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 4,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Chất lượng OK: ${ctx.raw}%`
                    }
                },
                annotation: {
                    annotations: {
                        targetLine: {
                            type: 'line',
                            yMin: 95.0,
                            yMax: 95.0,
                            borderColor: '#ef4444',
                            borderWidth: 3,
                            label: {
                                display: true,
                                content: '(95%) Target',
                                position: 'end',
                                color: '#ef4444',
                                font: { weight: 'bold', size: 12 },
                                backgroundColor: 'transparent'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#94a3b8',
                        callback: (v) => v + '%'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff', font: { weight: 'bold' } },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateCharts(data) {
    if (!data || data.length === 0) {
        state.charts.downtime.data.labels = [];
        state.charts.downtime.data.datasets[0].data = [];
        state.charts.downtime.update();

        state.charts.quality.data.labels = [];
        state.charts.quality.data.datasets[0].data = [];
        state.charts.quality.update();
        return;
    }

    const labels = data.map(d => d.name);
    const downtimeValues = data.map(d => d.downtimePct);
    const qualityValues = data.map(d => d.qualityPct);

    const downtimeColors = downtimeValues.map(v => v <= 5.0 ? '#34d399' : '#f87171');
    const qualityColors = qualityValues.map(v => v >= 95.0 ? '#34d399' : '#f87171');

    const maxDowntime = Math.max(...downtimeValues, 10);
    const yDowntimeMax = maxDowntime > 80 ? 100 : Math.ceil((maxDowntime + 10) / 10) * 10;
    state.charts.downtime.options.scales.y.max = yDowntimeMax;

    state.charts.downtime.data.labels = labels;
    state.charts.downtime.data.datasets[0].data = downtimeValues;
    state.charts.downtime.data.datasets[0].backgroundColor = downtimeColors;
    state.charts.downtime.update();

    state.charts.quality.data.labels = labels;
    state.charts.quality.data.datasets[0].data = qualityValues;
    state.charts.quality.data.datasets[0].backgroundColor = qualityColors;
    state.charts.quality.update();
}

// -------------------------------------------------------------
// 4. EVENT LISTENERS & NATIVE DATE PICKER HANDLER
// -------------------------------------------------------------
function initEventListeners() {
    const dateInput = document.getElementById('datePickerInput');

    if (dateInput) {
        dateInput.addEventListener('change', (e) => {
            const ymdVal = e.target.value;
            if (ymdVal) {
                const dmyVal = ymdToDmy(ymdVal);
                state.selectedDate = dmyVal;
            } else {
                state.selectedDate = 'ALL';
            }

            // Re-filter and re-render dashboard immediately
            let filteredRows = state.allRawRowsHistory;
            if (state.selectedDate && state.selectedDate !== 'ALL') {
                filteredRows = state.allRawRowsHistory.filter(r => extractDateFromRow(r) === state.selectedDate);
            }

            const processed = parseRawSheetJson(filteredRows);
            state.currentData = processed;
            renderDashboard(processed);
        });
    }

    document.getElementById('btnOpenConfig').addEventListener('click', () => {
        document.getElementById('configModal').classList.add('active');
    });
    document.getElementById('btnCloseConfig').addEventListener('click', () => {
        document.getElementById('configModal').classList.remove('active');
    });

    document.getElementById('dataSourceType').addEventListener('change', toggleUrlInputVisibility);

    document.getElementById('btnAddUrlRow').addEventListener('click', () => {
        state.apiUrls.push('');
        renderUrlInputFields();
    });

    const btnReset = document.getElementById('btnResetUrls');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            state.apiUrls = [...DEFAULT_URLS];
            state.dataSource = 'multi_url';
            localStorage.setItem('iot_data_source', 'multi_url');
            localStorage.setItem('iot_api_urls', JSON.stringify(DEFAULT_URLS));
            renderUrlInputFields();
            alert('Đã khôi phục 2 đường link Google Sheet mặc định thành công!');
        });
    }

    document.getElementById('btnSaveConfig').addEventListener('click', () => {
        const type = document.getElementById('dataSourceType').value;
        const inputs = document.querySelectorAll('.url-input-field');
        const urls = Array.from(inputs).map(inp => inp.value.trim()).filter(u => u.length > 0);

        state.dataSource = type;
        state.apiUrls = urls.length > 0 ? urls : [...DEFAULT_URLS];

        localStorage.setItem('iot_data_source', type);
        localStorage.setItem('iot_api_urls', JSON.stringify(state.apiUrls));

        document.getElementById('configModal').classList.remove('active');
        startPolling();
    });

    document.getElementById('btnRefreshManual').addEventListener('click', fetchData);
    document.getElementById('pollInterval').addEventListener('change', startPolling);
}

function updateStatusBadge(status, text) {
    const badge = document.getElementById('connectionStatus');
    const dot = badge.querySelector('.status-dot');
    const label = badge.querySelector('.status-text');

    label.innerText = text;
    if (status === 'online') {
        dot.className = 'status-dot online';
        badge.style.background = 'rgba(16, 185, 129, 0.1)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.style.color = '#34d399';
    } else if (status === 'offline') {
        dot.className = 'status-dot offline';
        badge.style.background = 'rgba(239, 68, 68, 0.1)';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        badge.style.color = '#f87171';
    } else {
        dot.className = 'status-dot';
        badge.style.color = '#f59e0b';
    }
}
