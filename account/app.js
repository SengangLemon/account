/* =====================================================
   Budget App — Vanilla JS
   State / Compute / UI 분리 아키텍처
   ===================================================== */

/* ─────────────────────────────────────────────────────
   1. STATE MODULE  — 데이터 저장·조회·유지
   ───────────────────────────────────────────────────── */
const State = (() => {
  const KEYS = { stocks: 'ba_stocks', savings: 'ba_savings', loans: 'ba_loans' };

  let data = { stocks: [], savings: [], loans: [] };

  function load() {
    for (const k of Object.keys(KEYS)) {
      try {
        const raw = localStorage.getItem(KEYS[k]);
        if (raw) data[k] = JSON.parse(raw);
      } catch (_) {}
    }
  }

  function save(section) {
    localStorage.setItem(KEYS[section], JSON.stringify(data[section]));
  }

  function getAll() { return data; }

  function addStock(item)  { data.stocks.push({ ...item, id: uid() }); save('stocks'); }
  function addSaving(item) { data.savings.push({ ...item, id: uid() }); save('savings'); }
  function addLoan(item)   { data.loans.push({ ...item, id: uid() }); save('loans'); }

  function updateStock(id, patch) {
    const idx = data.stocks.findIndex(s => s.id === id);
    if (idx > -1) { data.stocks[idx] = { ...data.stocks[idx], ...patch }; save('stocks'); }
  }
  function updateSaving(id, patch) {
    const idx = data.savings.findIndex(s => s.id === id);
    if (idx > -1) { data.savings[idx] = { ...data.savings[idx], ...patch }; save('savings'); }
  }
  function updateLoan(id, patch) {
    const idx = data.loans.findIndex(l => l.id === id);
    if (idx > -1) { data.loans[idx] = { ...data.loans[idx], ...patch }; save('loans'); }
  }

  function deleteStock(id)  { data.stocks = data.stocks.filter(s => s.id !== id); save('stocks'); }
  function deleteSaving(id) { data.savings = data.savings.filter(s => s.id !== id); save('savings'); }
  function deleteLoan(id)   { data.loans = data.loans.filter(l => l.id !== id); save('loans'); }

  function reset() {
    data = { stocks: [], savings: [], loans: [] };
    Object.values(KEYS).forEach((k, i) => localStorage.removeItem(Object.values(KEYS)[i]));
    Object.keys(KEYS).forEach(k => localStorage.removeItem(KEYS[k]));
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  return { load, getAll, addStock, addSaving, addLoan, updateStock, updateSaving, updateLoan, deleteStock, deleteSaving, deleteLoan, reset };
})();


/* ─────────────────────────────────────────────────────
   2. COMPUTE MODULE  — 순수 계산 함수 모음
   ───────────────────────────────────────────────────── */
const Compute = (() => {

  /* 주식 단일 종목 */
  function stockItem(s) {
    const qty       = Number(s.qty) || 0;
    const avgPrice  = Number(s.avgPrice) || 0;
    const curPrice  = Number(s.curPrice) || 0;
    const buyTotal  = qty * avgPrice;
    const evalTotal = qty * curPrice;
    const pnl       = evalTotal - buyTotal;
    const rate      = buyTotal > 0 ? (pnl / buyTotal) * 100 : 0;
    return { buyTotal, evalTotal, pnl, rate };
  }

  /* 주식 전체 합계 */
  function stockSummary(stocks) {
    let totalBuy = 0, totalEval = 0;
    stocks.forEach(s => {
      const c = stockItem(s);
      totalBuy  += c.buyTotal;
      totalEval += c.evalTotal;
    });
    const totalPnl  = totalEval - totalBuy;
    const totalRate = totalBuy > 0 ? (totalPnl / totalBuy) * 100 : 0;
    return { totalBuy, totalEval, totalPnl, totalRate };
  }

  /* 예적금 단일 계좌 */
  function savingItem(s) {
    const principal = Number(s.principal) || 0;
    const rate      = Number(s.rate) || 0;
    const months    = Number(s.months) || 12;
    const years     = months / 12;
    let interest    = 0;

    if (s.interestType === 'compound') {
      // 복리: 연복리 기준
      interest = principal * (Math.pow(1 + rate / 100, years) - 1);
    } else {
      // 단리
      interest = principal * (rate / 100) * years;
    }
    return { interest: Math.round(interest), maturity: principal + Math.round(interest) };
  }

  /* 예적금 전체 합계 */
  function savingSummary(savings) {
    let totalPrincipal = 0, totalInterest = 0, totalMaturity = 0;
    savings.forEach(s => {
      const c = savingItem(s);
      totalPrincipal += Number(s.principal) || 0;
      totalInterest  += c.interest;
      totalMaturity  += c.maturity;
    });
    return { totalPrincipal, totalInterest, totalMaturity };
  }

  /* 대출 단일 항목 */
  function loanItem(l) {
    const principal  = Number(l.principal) || 0;
    const rate       = Number(l.rate) || 0;
    const monthlyInt = Math.round(principal * (rate / 100) / 12);
    const annualInt  = Math.round(principal * (rate / 100));
    return { monthlyInt, annualInt };
  }

  /* 대출 전체 합계 */
  function loanSummary(loans) {
    let totalPrincipal = 0, totalMonthly = 0, totalAnnual = 0;
    loans.forEach(l => {
      const c = loanItem(l);
      totalPrincipal += Number(l.principal) || 0;
      totalMonthly   += c.monthlyInt;
      totalAnnual    += c.annualInt;
    });
    return { totalPrincipal, totalMonthly, totalAnnual };
  }

  /* 대시보드 순자산 */
  function netWorth(stocks, savings, loans) {
    const { totalEval }      = stockSummary(stocks);
    const { totalPrincipal: savP } = savingSummary(savings);
    const { totalPrincipal: loanP, totalMonthly } = loanSummary(loans);
    const total    = totalEval + savP;
    const netWorth = total - loanP;
    return { total, netWorth, stocksEval: totalEval, savingsTotal: savP, loansTotal: loanP, monthlyInterest: totalMonthly };
  }

  return { stockItem, stockSummary, savingItem, savingSummary, loanItem, loanSummary, netWorth };
})();


/* ─────────────────────────────────────────────────────
   3. FORMAT MODULE  — 표시 형식 변환
   ───────────────────────────────────────────────────── */
const Format = (() => {
  const krw = n => '₩' + Math.round(n).toLocaleString('ko-KR');
  const pct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  const num = n => Number(n).toLocaleString('ko-KR');
  const colorClass = n => n > 0 ? 'color-positive' : n < 0 ? 'color-negative' : 'color-neutral';
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} 기준`;
  };
  return { krw, pct, num, colorClass, today };
})();


/* ─────────────────────────────────────────────────────
   4. UI MODULE  — DOM 렌더링
   ───────────────────────────────────────────────────── */
const UI = (() => {
  let _modalType = null;
  let _editId    = null;

  /* ── 탭 전환 ── */
  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(el => el.classList.toggle('active', el.id === `tab-${tab}`));
  }

  /* ── 대시보드 렌더 ── */
  function renderDashboard() {
    const { stocks, savings, loans } = State.getAll();
    const nw = Compute.netWorth(stocks, savings, loans);
    const { totalBuy, totalEval, totalPnl, totalRate } = Compute.stockSummary(stocks);

    document.getElementById('last-updated').textContent = Format.today();
    document.getElementById('net-worth').textContent = Format.krw(nw.netWorth);
    document.getElementById('net-worth').className = 'hero-amount ' + Format.colorClass(nw.netWorth);

    // sub text
    const sub = `총 자산 ${Format.krw(nw.total)} · 대출 ${Format.krw(nw.loansTotal)} 차감`;
    document.getElementById('net-worth-sub').textContent = sub;

    document.getElementById('dash-stocks').textContent   = Format.krw(nw.stocksEval);
    document.getElementById('dash-savings').textContent  = Format.krw(nw.savingsTotal);
    document.getElementById('dash-loans').textContent    = Format.krw(nw.loansTotal);
    document.getElementById('dash-interest').textContent = Format.krw(nw.monthlyInterest);

    // P&L
    document.getElementById('dash-total-buy').textContent  = Format.krw(totalBuy);
    document.getElementById('dash-total-eval').textContent = Format.krw(totalEval);
    const pnlEl  = document.getElementById('dash-total-pnl');
    const rateEl = document.getElementById('dash-total-rate');
    pnlEl.textContent  = Format.krw(totalPnl);
    pnlEl.className    = 'pnl-val ' + Format.colorClass(totalPnl);
    rateEl.textContent = Format.pct(totalRate);
    rateEl.className   = 'pnl-val ' + Format.colorClass(totalRate);

    renderAllocationBar(nw);
  }

  /* ── 자산 배분 바 ── */
  function renderAllocationBar(nw) {
    const total = nw.stocksEval + nw.savingsTotal + nw.loansTotal || 1;
    const stockPct  = (nw.stocksEval / total * 100).toFixed(1);
    const savPct    = (nw.savingsTotal / total * 100).toFixed(1);
    const loanPct   = (nw.loansTotal / total * 100).toFixed(1);

    document.getElementById('alloc-bar').innerHTML = `
      <div class="alloc-segment" style="width:${stockPct}%;background:#007aff" title="주식"></div>
      <div class="alloc-segment" style="width:${savPct}%;background:#34c759" title="예적금"></div>
      <div class="alloc-segment" style="width:${loanPct}%;background:#ff3b30" title="대출"></div>
    `;
    document.getElementById('alloc-legend').innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#007aff"></div>주식 ${stockPct}%</div>
      <div class="legend-item"><div class="legend-dot" style="background:#34c759"></div>예적금 ${savPct}%</div>
      <div class="legend-item"><div class="legend-dot" style="background:#ff3b30"></div>대출 ${loanPct}%</div>
    `;
  }

  /* ── 주식 탭 렌더 ── */
  function renderStocks() {
    const { stocks } = State.getAll();
    const sum = Compute.stockSummary(stocks);

    document.getElementById('stock-total-eval').textContent = Format.krw(sum.totalEval);
    const pnlEl  = document.getElementById('stock-total-pnl');
    const rateEl = document.getElementById('stock-total-rate');
    pnlEl.textContent  = Format.krw(sum.totalPnl);
    pnlEl.className    = 'ssb-val ' + Format.colorClass(sum.totalPnl);
    rateEl.textContent = Format.pct(sum.totalRate);
    rateEl.className   = 'ssb-val ' + Format.colorClass(sum.totalRate);

    const listEl = document.getElementById('stock-list');
    if (stocks.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="var(--border)" stroke-width="2"/><polyline points="20 38 28 28 36 34 46 22" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <p>아직 등록된 종목이 없습니다</p>
          <button class="btn-primary" onclick="UI.openModal('stock')">첫 종목 추가하기</button>
        </div>`;
      return;
    }

    listEl.innerHTML = stocks.map(s => {
      const c = Compute.stockItem(s);
      const cc = Format.colorClass(c.pnl);
      return `
        <div class="stock-card">
          <div class="stock-card-left">
            <div class="stock-name">${escHtml(s.name)}</div>
            <div class="stock-meta">
              <div class="stock-meta-item"><span class="stock-meta-label">보유수량</span><span class="stock-meta-val">${Format.num(s.qty)}주</span></div>
              <div class="stock-meta-item"><span class="stock-meta-label">평단가</span><span class="stock-meta-val">${Format.krw(s.avgPrice)}</span></div>
              <div class="stock-meta-item"><span class="stock-meta-label">현재가</span>
                <div class="price-edit-wrap">
                  <input class="price-input-inline" type="number" value="${s.curPrice}" id="cur-${s.id}" placeholder="현재가" />
                  <button class="btn-apply" onclick="App.updateCurPrice('${s.id}')">적용</button>
                </div>
              </div>
            </div>
          </div>
          <div class="stock-card-right">
            <div class="stock-eval">${Format.krw(c.evalTotal)}</div>
            <div class="stock-pnl ${cc}">${Format.krw(c.pnl)} (${Format.pct(c.rate)})</div>
            <div class="card-actions">
              <button class="btn-icon" onclick="UI.openModal('stock','${s.id}')" title="수정">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon danger" onclick="App.deleteStock('${s.id}')" title="삭제">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── 예적금 탭 렌더 ── */
  function renderSavings() {
    const { savings } = State.getAll();
    const sum = Compute.savingSummary(savings);

    document.getElementById('saving-total-principal').textContent = Format.krw(sum.totalPrincipal);
    document.getElementById('saving-total-interest').textContent  = Format.krw(sum.totalInterest);
    document.getElementById('saving-total-maturity').textContent  = Format.krw(sum.totalMaturity);

    const listEl = document.getElementById('saving-list');
    if (savings.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="var(--border)" stroke-width="2"/><path d="M32 20v4M32 40v4M22 32h4M38 32h4" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/></svg>
          <p>아직 등록된 예적금 계좌가 없습니다</p>
          <button class="btn-primary" onclick="UI.openModal('saving')">첫 계좌 추가하기</button>
        </div>`;
      return;
    }

    listEl.innerHTML = savings.map(s => {
      const c = Compute.savingItem(s);
      const typeLabel = s.type === 'savings' ? '적금' : '예금';
      const typeClass = s.type === 'savings' ? 'type-savings' : 'type-deposit';
      const intTypeLabel = s.interestType === 'compound' ? '복리' : '단리';
      return `
        <div class="saving-card">
          <div>
            <span class="saving-badge ${typeClass}">${typeLabel} · ${intTypeLabel}</span>
            <div class="saving-name">${escHtml(s.name)}</div>
            <div class="saving-meta">
              <div class="saving-meta-item"><span class="saving-meta-label">원금</span><span class="saving-meta-val">${Format.krw(s.principal)}</span></div>
              <div class="saving-meta-item"><span class="saving-meta-label">금리</span><span class="saving-meta-val">${s.rate}%</span></div>
              <div class="saving-meta-item"><span class="saving-meta-label">기간</span><span class="saving-meta-val">${s.months}개월</span></div>
              ${s.maturityDate ? `<div class="saving-meta-item"><span class="saving-meta-label">만기일</span><span class="saving-meta-val">${s.maturityDate}</span></div>` : ''}
            </div>
          </div>
          <div class="saving-right">
            <div class="saving-maturity">${Format.krw(c.maturity)}</div>
            <div class="saving-interest">+${Format.krw(c.interest)} 이자</div>
            <div class="card-actions">
              <button class="btn-icon" onclick="UI.openModal('saving','${s.id}')" title="수정">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon danger" onclick="App.deleteSaving('${s.id}')" title="삭제">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── 대출 탭 렌더 ── */
  function renderLoans() {
    const { loans } = State.getAll();
    const sum = Compute.loanSummary(loans);

    document.getElementById('loan-total-principal').textContent = Format.krw(sum.totalPrincipal);
    document.getElementById('loan-total-monthly').textContent   = Format.krw(sum.totalMonthly);
    document.getElementById('loan-total-annual').textContent    = Format.krw(sum.totalAnnual);

    const listEl = document.getElementById('loan-list');
    if (loans.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="var(--border)" stroke-width="2"/><rect x="20" y="26" width="24" height="16" rx="2" stroke="var(--accent)" stroke-width="2.5"/><path d="M26 26v-4a6 6 0 0112 0v4" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/></svg>
          <p>등록된 대출이 없습니다</p>
          <button class="btn-primary" onclick="UI.openModal('loan')">대출 추가하기</button>
        </div>`;
      return;
    }

    listEl.innerHTML = loans.map(l => {
      const c = Compute.loanItem(l);
      return `
        <div class="loan-card">
          <div>
            <div class="loan-name">${escHtml(l.name)}</div>
            <div class="loan-meta">
              <div class="loan-meta-item"><span class="loan-meta-label">원금</span><span class="loan-meta-val">${Format.krw(l.principal)}</span></div>
              <div class="loan-meta-item"><span class="loan-meta-label">금리</span><span class="loan-meta-val">${l.rate}%</span></div>
              <div class="loan-meta-item"><span class="loan-meta-label">연 이자</span><span class="loan-meta-val">${Format.krw(c.annualInt)}</span></div>
            </div>
          </div>
          <div class="loan-right">
            <div class="loan-monthly-label">월 이자</div>
            <div class="loan-monthly">${Format.krw(c.monthlyInt)}</div>
            <div class="card-actions">
              <button class="btn-icon" onclick="UI.openModal('loan','${l.id}')" title="수정">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon danger" onclick="App.deleteLoan('${l.id}')" title="삭제">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── 전체 렌더 ── */
  function renderAll() {
    renderDashboard();
    renderStocks();
    renderSavings();
    renderLoans();
  }

  /* ── 모달 열기 ── */
  function openModal(type, editId = null) {
    _modalType = type;
    _editId    = editId;

    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl  = document.getElementById('modal-body');

    let existing = null;
    if (editId) {
      const { stocks, savings, loans } = State.getAll();
      if (type === 'stock')  existing = stocks.find(s => s.id === editId);
      if (type === 'saving') existing = savings.find(s => s.id === editId);
      if (type === 'loan')   existing = loans.find(l => l.id === editId);
    }

    if (type === 'stock') {
      titleEl.textContent = editId ? '종목 수정' : '주식 종목 추가';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">종목명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 삼성전자, APPLE" value="${existing ? escHtml(existing.name) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">보유 수량 (주)</label>
            <input class="form-input" id="f-qty" type="number" min="0" placeholder="100" value="${existing ? existing.qty : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">매입 평단가 (₩)</label>
            <input class="form-input" id="f-avg" type="number" min="0" placeholder="75000" value="${existing ? existing.avgPrice : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">현재가 (₩)</label>
          <input class="form-input" id="f-cur" type="number" min="0" placeholder="80000" value="${existing ? existing.curPrice : ''}" />
          <p class="form-hint">나중에 카드에서 직접 수정할 수 있습니다.</p>
        </div>`;
    }

    else if (type === 'saving') {
      titleEl.textContent = editId ? '예적금 수정' : '예적금 계좌 추가';
      const selType = existing ? existing.type : 'deposit';
      const selInt  = existing ? existing.interestType : 'simple';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">계좌명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 신한 정기예금, KB 청년적금" value="${existing ? escHtml(existing.name) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">종류</label>
            <select class="form-select" id="f-type">
              <option value="deposit" ${selType==='deposit'?'selected':''}>예금</option>
              <option value="savings" ${selType==='savings'?'selected':''}>적금</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">이자 계산 방식</label>
            <select class="form-select" id="f-itype">
              <option value="simple"   ${selInt==='simple'?'selected':''}>단리</option>
              <option value="compound" ${selInt==='compound'?'selected':''}>복리</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">원금 (₩)</label>
            <input class="form-input" id="f-principal" type="number" min="0" placeholder="10000000" value="${existing ? existing.principal : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">연 이자율 (%)</label>
            <input class="form-input" id="f-rate" type="number" min="0" step="0.01" placeholder="3.5" value="${existing ? existing.rate : ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">기간 (개월)</label>
            <input class="form-input" id="f-months" type="number" min="1" placeholder="12" value="${existing ? existing.months : 12}" />
          </div>
          <div class="form-group">
            <label class="form-label">만기일 (선택)</label>
            <input class="form-input" id="f-maturity" type="date" value="${existing ? (existing.maturityDate || '') : ''}" />
          </div>
        </div>`;
    }

    else if (type === 'loan') {
      titleEl.textContent = editId ? '대출 수정' : '대출 추가';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">대출명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 주택담보대출, 신용대출" value="${existing ? escHtml(existing.name) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">대출 원금 (₩)</label>
            <input class="form-input" id="f-principal" type="number" min="0" placeholder="100000000" value="${existing ? existing.principal : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">연 이자율 (%)</label>
            <input class="form-input" id="f-rate" type="number" min="0" step="0.01" placeholder="4.5" value="${existing ? existing.rate : ''}" />
          </div>
        </div>
        <p class="form-hint" style="margin-top:-8px">월 이자 = 원금 × 연이율 ÷ 12 (이자만 납입 기준)</p>`;
    }

    overlay.classList.add('open');
    setTimeout(() => {
      const first = bodyEl.querySelector('input, select');
      if (first) first.focus();
    }, 100);
  }

  /* ── 모달 닫기 ── */
  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    _modalType = null;
    _editId    = null;
  }

  /* ── 모달 저장 ── */
  function saveModal() {
    const type = _modalType;
    const editId = _editId;

    if (type === 'stock') {
      const name     = document.getElementById('f-name').value.trim();
      const qty      = document.getElementById('f-qty').value;
      const avgPrice = document.getElementById('f-avg').value;
      const curPrice = document.getElementById('f-cur').value;
      if (!name || !qty || !avgPrice || !curPrice) { alert('모든 항목을 입력해 주세요.'); return; }
      const item = { name, qty: Number(qty), avgPrice: Number(avgPrice), curPrice: Number(curPrice) };
      if (editId) State.updateStock(editId, item);
      else State.addStock(item);
    }

    else if (type === 'saving') {
      const name         = document.getElementById('f-name').value.trim();
      const type_        = document.getElementById('f-type').value;
      const interestType = document.getElementById('f-itype').value;
      const principal    = document.getElementById('f-principal').value;
      const rate         = document.getElementById('f-rate').value;
      const months       = document.getElementById('f-months').value;
      const maturityDate = document.getElementById('f-maturity').value;
      if (!name || !principal || !rate || !months) { alert('필수 항목을 입력해 주세요.'); return; }
      const item = { name, type: type_, interestType, principal: Number(principal), rate: Number(rate), months: Number(months), maturityDate };
      if (editId) State.updateSaving(editId, item);
      else State.addSaving(item);
    }

    else if (type === 'loan') {
      const name      = document.getElementById('f-name').value.trim();
      const principal = document.getElementById('f-principal').value;
      const rate      = document.getElementById('f-rate').value;
      if (!name || !principal || !rate) { alert('모든 항목을 입력해 주세요.'); return; }
      const item = { name, principal: Number(principal), rate: Number(rate) };
      if (editId) State.updateLoan(editId, item);
      else State.addLoan(item);
    }

    closeModal();
    renderAll();
  }

  /* ── 유틸 ── */
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { switchTab, renderAll, openModal, closeModal, saveModal };
})();


/* ─────────────────────────────────────────────────────
   5. APP MODULE  — 이벤트 연결 및 앱 진입점
   ───────────────────────────────────────────────────── */
const App = (() => {

  function updateCurPrice(id) {
    const input = document.getElementById(`cur-${id}`);
    if (!input) return;
    const val = Number(input.value);
    if (isNaN(val) || val < 0) { alert('올바른 현재가를 입력해 주세요.'); return; }
    State.updateStock(id, { curPrice: val });
    UI.renderAll();
  }

  function deleteStock(id) {
    if (!confirm('종목을 삭제하시겠습니까?')) return;
    State.deleteStock(id);
    UI.renderAll();
  }

  function deleteSaving(id) {
    if (!confirm('예적금 계좌를 삭제하시겠습니까?')) return;
    State.deleteSaving(id);
    UI.renderAll();
  }

  function deleteLoan(id) {
    if (!confirm('대출을 삭제하시겠습니까?')) return;
    State.deleteLoan(id);
    UI.renderAll();
  }

  function resetAll() {
    if (!confirm('모든 자산 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    State.reset();
    UI.renderAll();
  }

  function init() {
    State.load();

    // 탭 클릭
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => UI.switchTab(el.dataset.tab));
    });

    // ESC로 모달 닫기
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') UI.closeModal();
    });

    // Enter로 모달 저장
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && document.getElementById('modal-overlay').classList.contains('open')) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) {
          UI.saveModal();
        }
      }
    });

    UI.renderAll();
  }

  return { init, updateCurPrice, deleteStock, deleteSaving, deleteLoan, resetAll };
})();

/* ─── 앱 시작 ─── */
document.addEventListener('DOMContentLoaded', App.init);
