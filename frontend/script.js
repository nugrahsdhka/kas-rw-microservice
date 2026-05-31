const API_URL = 'http://100.52.250.214/transaksi';

let allData     = [];
const PAGE_SIZE = 20;
const SCROLL_TH = 10;
let currentPage = 1;

const KETERANGAN_MAX  = 50;   
const KETERANGAN_WARN = 40;  

const fmt = n => 'Rp ' + parseFloat(n).toLocaleString('id-ID');

function fmtThousand(raw) {
    const num = parseInt(raw.toString().replace(/\D/g, ''), 10);
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('id-ID');
}

function parseThousand(str) {
    return parseInt(str.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
}

function bindJumlahInput(displayId, hiddenId) {
    const display = document.getElementById(displayId);
    const hidden  = document.getElementById(hiddenId);

    display.addEventListener('input', () => {
        // strip non-digit
        const raw  = display.value.replace(/\D/g, '');
        const num  = parseInt(raw, 10) || 0;
        // format dengan titik ribuan
        display.value = num > 0 ? num.toLocaleString('id-ID') : '';
        hidden.value  = num;
    });

    display.addEventListener('keydown', e => {
        // allow: backspace, delete, arrow, tab, home, end
        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
        if (allowed.includes(e.key)) return;
        // block non-digit
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });

    display.addEventListener('blur', () => {
        // beautify on blur
        const num = parseInt(hidden.value, 10) || 0;
        display.value = num > 0 ? num.toLocaleString('id-ID') : '';
    });
}

function setJumlah(displayId, hiddenId, value) {
    const num = parseFloat(value) || 0;
    document.getElementById(hiddenId).value  = num;
    document.getElementById(displayId).value = num > 0 ? num.toLocaleString('id-ID') : '';
}

/* ── Keterangan char counter ── */
function bindCharCounter(inputId, counterId) {
    const input   = document.getElementById(inputId);
    const counter = document.getElementById(counterId);

    input.setAttribute('maxlength', KETERANGAN_MAX);

    const update = () => {
        const len = input.value.length;
        counter.textContent = `${len} / ${KETERANGAN_MAX}`;
        counter.className = 'char-counter';
        if (len >= KETERANGAN_MAX) counter.classList.add('limit');
        else if (len >= KETERANGAN_WARN) counter.classList.add('warn');
    };

    input.addEventListener('input', update);
    update();
}

/* ── Fetch ── */
async function fetchData() {
    try {
        const res = await fetch(API_URL);
        allData   = await res.json();
        currentPage = 1;
        renderTable();
    } catch {
        document.getElementById('tabel-body').innerHTML =
            '<tr><td colspan="5"><div class="empty-state"><i class="ti ti-wifi-off"></i>Gagal terhubung ke server.</div></td></tr>';
    }
}

/* ── Render ── */
function renderTable() {
    const tbody     = document.getElementById('tabel-body');
    const wrap      = document.getElementById('table-wrap');
    const pagBar    = document.getElementById('pagination-bar');
    const tableInfo = document.getElementById('table-info');

    tbody.innerHTML = '';

    let saldo = 0, income = 0, expense = 0;
    allData.forEach(t => {
        const amt = parseFloat(t.jumlah);
        if (t.tipe === 'Pemasukan') { income += amt; saldo += amt; }
        else { expense += amt; saldo -= amt; }
    });

    document.getElementById('total-income').innerText  = fmt(income);
    document.getElementById('total-expense').innerText = fmt(expense);
    const saldoEl = document.getElementById('saldo');
    saldoEl.innerText = fmt(saldo);
    saldoEl.className = 'stat-value ' + (saldo < 0 ? 'red' : 'blue');

    if (!allData.length) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="ti ti-inbox"></i>Belum ada data transaksi.</div></td></tr>';
        tableInfo.innerText = '';
        wrap.classList.remove('scrollable');
        pagBar.classList.add('hidden');
        return;
    }

    const total     = allData.length;
    const totalPgs  = Math.ceil(total / PAGE_SIZE);
    const usePaging = total > PAGE_SIZE;
    const pageData  = usePaging
        ? allData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
        : allData;

    wrap.classList.toggle('scrollable', pageData.length > SCROLL_TH);

    pageData.forEach(t => {
        const isIncome = t.tipe === 'Pemasukan';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="td-mono">${t.tanggal}</td>
            <td class="td-keterangan" title="${t.keterangan}">${t.keterangan}</td>
            <td><span class="badge ${isIncome ? 'income' : 'expense'}">${t.tipe}</span></td>
            <td class="td-mono" style="color:${isIncome ? 'var(--green-700)' : 'var(--red-600)'}">
                ${isIncome ? '+' : '−'} ${fmt(t.jumlah)}
            </td>
            <td>
                <div class="actions">
                    <button class="act-btn" onclick="showDetail(${t.id})"><i class="ti ti-eye"></i> Detail</button>
                    <button class="act-btn" onclick="openEditModal(${t.id})"><i class="ti ti-edit"></i> Edit</button>
                    <button class="act-btn del" onclick="hapusData(${t.id})"><i class="ti ti-trash"></i> Hapus</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (usePaging) {
        const start = (currentPage - 1) * PAGE_SIZE + 1;
        const end   = Math.min(currentPage * PAGE_SIZE, total);
        tableInfo.innerText = `${start}–${end} dari ${total} transaksi`;
        pagBar.classList.remove('hidden');
        renderPagination(totalPgs);
    } else {
        tableInfo.innerText = `${total} transaksi`;
        pagBar.classList.add('hidden');
    }

    wrap.scrollTop = 0;
}

/* ── Pagination ── */
function renderPagination(totalPages) {
    document.getElementById('page-meta').innerText = `Halaman ${currentPage} dari ${totalPages}`;
    const btns = document.getElementById('page-btns');
    btns.innerHTML = '';

    btns.appendChild(makePageBtn('<i class="ti ti-chevron-left"></i>', currentPage === 1, () => goPage(currentPage - 1)));
    getPageNumbers(currentPage, totalPages).forEach(p => {
        if (p === '...') {
            const el = document.createElement('span');
            el.className = 'page-ellipsis'; el.innerText = '···';
            btns.appendChild(el);
        } else {
            const btn = makePageBtn(p, false, () => goPage(p));
            if (p === currentPage) btn.classList.add('active');
            btns.appendChild(btn);
        }
    });
    btns.appendChild(makePageBtn('<i class="ti ti-chevron-right"></i>', currentPage === totalPages, () => goPage(currentPage + 1)));
}

function makePageBtn(html, disabled, onClick) {
    const btn = document.createElement('button');
    btn.className = 'page-btn'; btn.innerHTML = html; btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', onClick);
    return btn;
}

function goPage(page) {
    const total = Math.ceil(allData.length / PAGE_SIZE);
    if (page < 1 || page > total) return;
    currentPage = page; renderTable();
}

function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1].filter(p => p >= 1 && p <= total));
    const sorted = [...pages].sort((a, b) => a - b);
    const result = []; let prev = 0;
    for (const p of sorted) { if (p - prev > 1) result.push('...'); result.push(p); prev = p; }
    return result;
}

/* ── Modal helpers ── */
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('active'); });
});

/* ── Tambah ── */
function openAddModal() {
    document.getElementById('add-form').reset();
    setJumlah('add-jumlah-display', 'add-jumlah', 0);
    // reset char counter
    document.getElementById('add-keterangan').dispatchEvent(new Event('input'));
    openModal('add-modal');
}

document.getElementById('add-form').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
        tanggal:    document.getElementById('add-tanggal').value,
        keterangan: document.getElementById('add-keterangan').value,
        jumlah:     parseFloat(document.getElementById('add-jumlah').value) || 0,
        tipe:       document.getElementById('add-tipe').value,
    };
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        closeModal('add-modal');
        fetchData();
    } catch (err) { console.error('Gagal menyimpan:', err); }
});

/* ── Edit ── */
async function openEditModal(id) {
    try {
        const res  = await fetch(`${API_URL}/${id}`);
        const item = await res.json();
        document.getElementById('edit-id').value         = item.id;
        document.getElementById('edit-tanggal').value    = item.tanggal;
        document.getElementById('edit-keterangan').value = item.keterangan;
        document.getElementById('edit-keterangan').dispatchEvent(new Event('input'));
        document.getElementById('edit-tipe').value       = item.tipe;
        setJumlah('edit-jumlah-display', 'edit-jumlah', item.jumlah);
        openModal('edit-modal');
    } catch (err) { console.error('Gagal mengambil data edit:', err); }
}

document.getElementById('edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const payload = {
        tanggal:    document.getElementById('edit-tanggal').value,
        keterangan: document.getElementById('edit-keterangan').value,
        jumlah:     parseFloat(document.getElementById('edit-jumlah').value) || 0,
        tipe:       document.getElementById('edit-tipe').value,
    };
    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        closeModal('edit-modal');
        fetchData();
    } catch (err) { console.error('Gagal update:', err); }
});

/* ── Detail ── */
async function showDetail(id) {
    try {
        const res  = await fetch(`${API_URL}/${id}`);
        const item = await res.json();
        const isIncome = item.tipe === 'Pemasukan';
        document.getElementById('detail-content').innerHTML = `
            <div class="detail-row">
                <span class="detail-key">ID transaksi</span>
                <span class="detail-val" style="font-family:'DM Mono',monospace;font-size:12px">#${item.id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Tanggal</span>
                <span class="detail-val">${item.tanggal}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Keterangan</span>
                <span class="detail-val" style="max-width:60%;word-break:break-word;white-space:normal">${item.keterangan}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Jenis</span>
                <span class="detail-val">
                    <span class="badge ${isIncome ? 'income' : 'expense'}">${item.tipe}</span>
                </span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Nominal</span>
                <span class="detail-val" style="font-family:'DM Mono',monospace;color:${isIncome ? 'var(--green-700)' : 'var(--red-600)'}">
                    ${isIncome ? '+' : '−'} ${fmt(item.jumlah)}
                </span>
            </div>
        `;
        openModal('detail-modal');
    } catch (err) { console.error('Gagal mengambil detail:', err); }
}

/* ── Hapus ── */
let pendingDeleteId = null;

function hapusData(id) {
    const t = allData.find(x => x.id === id);
    if (!t) return;

    pendingDeleteId = id;

    // Tampilkan info transaksi di modal: keterangan + nominal
    const isIncome = t.tipe === 'Pemasukan';
    const sign     = isIncome ? '+' : '−';
    document.getElementById('delete-label').textContent =
        `"${t.keterangan}" (${sign} ${fmt(t.jumlah)})`;

    openModal('delete-modal');
}

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    pendingDeleteId = null;
    closeModal('delete-modal');
    try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        fetchData();
    } catch (err) { console.error('Gagal menghapus:', err); }
});

/* ── Export ── */
document.getElementById('btn-export').addEventListener('click', () => {
    window.open(API_URL.replace('/transaksi', '/export-pdf'), '_blank');
});

/* ── Init ── */
bindJumlahInput('add-jumlah-display', 'add-jumlah');
bindJumlahInput('edit-jumlah-display', 'edit-jumlah');
bindCharCounter('add-keterangan',  'add-keterangan-count');
bindCharCounter('edit-keterangan', 'edit-keterangan-count');

fetchData();