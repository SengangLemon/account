/* =====================================================
   Budget App — Vanilla JS
   State / Compute / UI 분리 아키텍처 (모바일 최적화)
   ===================================================== */

/* ─────────────────────────────────────────────────────
   1. STATE MODULE
   ───────────────────────────────────────────────────── */
const State = (() => {
  const KEYS = { stocks: 'ba_stocks', savings: 'ba_savings', loans: 'ba_loans', fixed: 'ba_fixed', logs: 'ba_logs' };
  let data = { stocks: [], savings: [], loans: [], fixed: [], logs: [] };

  function load() {
    for (const k of Object.keys(KEYS)) {
      try {
        const raw = localStorage.getItem(KEYS[k]);
        if (raw) data[k] = JSON.parse(raw);
      } catch (_) {}
    }
  }

  function save(section) { localStorage.setItem(KEYS[section], JSON.stringify(data[section])); }
  function getAll() { return data; }

  function addStock(item)  { data.stocks.push({ ...item, id: uid() }); save('stocks'); }
  function addSaving(item) { data.savings.push({ ...item, id: uid() }); save('savings'); }
  function addLoan(item)   { data.loans.push({ ...item, id: uid() }); save('loans'); }
  function addFixed(item)  { data.fixed.push({ ...item, id: uid() }); save('fixed'); }
  function addLog(item)    { data.logs.push({ ...item, id: uid(), ts: Date.now() }); save('logs'); }

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
  function updateFixed(id, patch) {
    const idx = data.fixed.findIndex(f => f.id === id);
    if (idx > -1) { data.fixed[idx] = { ...data.fixed[idx], ...patch }; save('fixed'); }
  }
  function updateLog(id, patch) {
    const idx = data.logs.findIndex(l => l.id === id);
    if (idx > -1) { data.logs[idx] = { ...data.logs[idx], ...patch }; save('logs'); }
  }

  function deleteStock(id)  { data.stocks  = data.stocks.filter(s => s.id !== id); save('stocks'); }
  function deleteSaving(id) { data.savings = data.savings.filter(s => s.id !== id); save('savings'); }
  function deleteLoan(id)   { data.loans   = data.loans.filter(l => l.id !== id); save('loans'); }
  function deleteFixed(id)  { data.fixed   = data.fixed.filter(f => f.id !== id); save('fixed'); }
  function deleteLog(id)    { data.logs    = data.logs.filter(l => l.id !== id); save('logs'); }

  function reset() {
    data = { stocks: [], savings: [], loans: [], fixed: [], logs: [] };
    Object.keys(KEYS).forEach(k => localStorage.removeItem(KEYS[k]));
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  return {
    load, getAll,
    addStock, addSaving, addLoan, addFixed, addLog,
    updateStock, updateSaving, updateLoan, updateFixed, updateLog,
    deleteStock, deleteSaving, deleteLoan, deleteFixed, deleteLog,
    reset
  };
})();


/* ─────────────────────────────────────────────────────
   2. COMPUTE MODULE
   ───────────────────────────────────────────────────── */
const Compute = (() => {
  function stockItem(s) {
    const qty = Number(s.qty) || 0, avg = Number(s.avgPrice) || 0, cur = Number(s.curPrice) || 0;
    const buyTotal = qty * avg, evalTotal = qty * cur;
    const pnl = evalTotal - buyTotal;
    const rate = buyTotal > 0 ? (pnl / buyTotal) * 100 : 0;
    return { buyTotal, evalTotal, pnl, rate };
  }

  function stockSummary(stocks) {
    let totalBuy = 0, totalEval = 0;
    stocks.forEach(s => { const c = stockItem(s); totalBuy += c.buyTotal; totalEval += c.evalTotal; });
    const totalPnl = totalEval - totalBuy;
    const totalRate = totalBuy > 0 ? (totalPnl / totalBuy) * 100 : 0;
    return { totalBuy, totalEval, totalPnl, totalRate };
  }

  function savingItem(s) {
    const principal = Number(s.principal) || 0, rate = Number(s.rate) || 0, years = (Number(s.months) || 12) / 12;
    const interest = s.interestType === 'compound'
      ? principal * (Math.pow(1 + rate / 100, years) - 1)
      : principal * (rate / 100) * years;
    return { interest: Math.round(interest), maturity: principal + Math.round(interest) };
  }

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

  function loanItem(l) {
    const principal = Number(l.principal) || 0, rate = Number(l.rate) || 0;
    return { monthlyInt: Math.round(principal * rate / 100 / 12), annualInt: Math.round(principal * rate / 100) };
  }

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

  function netWorth(stocks, savings, loans) {
    const { totalEval } = stockSummary(stocks);
    const { totalPrincipal: savP } = savingSummary(savings);
    const { totalPrincipal: loanP, totalMonthly } = loanSummary(loans);
    const total = totalEval + savP;
    return { total, netWorth: total - loanP, stocksEval: totalEval, savingsTotal: savP, loansTotal: loanP, monthlyInterest: totalMonthly };
  }

  function currentMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthKeyOf(dateStr) { return (dateStr || '').slice(0, 7); }

  function thisMonthLogs(logs) {
    const mk = currentMonthKey();
    return logs.filter(l => monthKeyOf(l.date) === mk);
  }
  function totalSpent(logs) {
    return logs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }
  function fixedTotal(fixed) {
    return fixed.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  }
  function isPaidThisMonth(fixedId, logs) {
    const mk = currentMonthKey();
    return logs.some(l => l.fixedId === fixedId && monthKeyOf(l.date) === mk);
  }
  function unpaidFixedCount(fixed, logs) {
    return fixed.filter(f => !isPaidThisMonth(f.id, logs)).length;
  }

  return {
    stockItem, stockSummary, savingItem, savingSummary, loanItem, loanSummary, netWorth,
    thisMonthLogs, totalSpent, fixedTotal, isPaidThisMonth, unpaidFixedCount
  };
})();


/* ─────────────────────────────────────────────────────
   3. FORMAT MODULE
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
  const todayDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  return { krw, pct, num, colorClass, today, todayDate };
})();


/* ─────────────────────────────────────────────────────
   3-b. CATEGORY MODULE
   ───────────────────────────────────────────────────── */
const Cat = (() => {
  const list = [
    { id: 'housing',    label: '주거/월세',  cls: 'blue'   },
    { id: 'utility',    label: '공과금',     cls: 'orange' },
    { id: 'sub',        label: '구독',       cls: 'purple' },
    { id: 'insurance',  label: '보험',       cls: 'teal'   },
    { id: 'transport',  label: '교통',       cls: 'pink'   },
    { id: 'food',       label: '식비/생활',  cls: 'green'  },
    { id: 'etc',        label: '기타',       cls: 'gray'   },
  ];
  function info(id) { return list.find(c => c.id === id) || list[list.length - 1]; }
  return { list, info };
})();


/* ─────────────────────────────────────────────────────
   4. UI MODULE
   ───────────────────────────────────────────────────── */
const UI = (() => {
  let _modalType = null;
  let _editId    = null;

  const TAB_TITLES = { dashboard: '내 자산', stocks: '주식', savings: '예적금', loans: '대출', expenses: '지출' };

  /* ── 탭 전환 ── */
  function switchTab(tab) {
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(el => el.classList.toggle('active', el.id === `tab-${tab}`));
    document.getElementById('top-title').textContent = TAB_TITLES[tab] || '';
    const addBtn = document.getElementById('add-btn');
    addBtn.style.display = (tab === 'dashboard') ? 'none' : 'flex';
    addBtn.dataset.currentTab = tab;
    window.scrollTo(0, 0);
  }

  /* ── 현재 탭 기반 모달 열기 (+ 버튼) ── */
  function openModalFromTab() {
    const tab = document.getElementById('add-btn').dataset.currentTab;
    const typeMap = { stocks: 'stock', savings: 'saving', loans: 'loan', expenses: 'fixed' };
    openModal(typeMap[tab] || 'stock');
  }

  /* ── 대시보드 렌더 ── */
  function renderDashboard() {
    const { stocks, savings, loans } = State.getAll();
    const nw = Compute.netWorth(stocks, savings, loans);
    const { totalBuy, totalEval, totalPnl, totalRate } = Compute.stockSummary(stocks);

    document.getElementById('last-updated').textContent = Format.today();

    const nwEl = document.getElementById('net-worth');
    nwEl.textContent = Format.krw(nw.netWorth);
    nwEl.className = 'hero-amount';

    document.getElementById('net-worth-sub').textContent =
      `총 자산 ${Format.krw(nw.total)} · 대출 ${Format.krw(nw.loansTotal)} 차감`;

    document.getElementById('dash-stocks').textContent   = Format.krw(nw.stocksEval);
    document.getElementById('dash-savings').textContent  = Format.krw(nw.savingsTotal);
    document.getElementById('dash-loans').textContent    = Format.krw(nw.loansTotal);
    document.getElementById('dash-interest').textContent = Format.krw(nw.monthlyInterest);

    document.getElementById('dash-total-buy').textContent  = Format.krw(totalBuy);
    document.getElementById('dash-total-eval').textContent = Format.krw(totalEval);

    const pnlEl  = document.getElementById('dash-total-pnl');
    const rateEl = document.getElementById('dash-total-rate');
    pnlEl.textContent  = Format.krw(totalPnl);
    pnlEl.className    = 'row-val bold ' + Format.colorClass(totalPnl);
    rateEl.textContent = Format.pct(totalRate);
    rateEl.className   = 'row-val bold ' + Format.colorClass(totalRate);

    renderAllocationBar(nw);
  }

  function renderAllocationBar(nw) {
    const total = (nw.stocksEval + nw.savingsTotal + nw.loansTotal) || 1;
    const sp = (nw.stocksEval / total * 100).toFixed(1);
    const vp = (nw.savingsTotal / total * 100).toFixed(1);
    const lp = (nw.loansTotal / total * 100).toFixed(1);
    document.getElementById('alloc-bar').innerHTML = `
      <div class="alloc-segment" style="width:${sp}%;background:#007aff"></div>
      <div class="alloc-segment" style="width:${vp}%;background:#34c759"></div>
      <div class="alloc-segment" style="width:${lp}%;background:#ff3b30"></div>`;
    document.getElementById('alloc-legend').innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#007aff"></div>주식 ${sp}%</div>
      <div class="legend-item"><div class="legend-dot" style="background:#34c759"></div>예적금 ${vp}%</div>
      <div class="legend-item"><div class="legend-dot" style="background:#ff3b30"></div>대출 ${lp}%</div>`;
  }

  /* ── 주식 탭 렌더 ── */
  function renderStocks() {
    const { stocks } = State.getAll();
    const sum = Compute.stockSummary(stocks);

    document.getElementById('stock-total-eval').textContent = Format.krw(sum.totalEval);
    const pnlEl  = document.getElementById('stock-total-pnl');
    const rateEl = document.getElementById('stock-total-rate');
    pnlEl.textContent  = Format.krw(sum.totalPnl);
    pnlEl.className    = 'strip-val ' + Format.colorClass(sum.totalPnl);
    rateEl.textContent = Format.pct(sum.totalRate);
    rateEl.className   = 'strip-val ' + Format.colorClass(sum.totalRate);

    const listEl = document.getElementById('stock-list');
    if (!stocks.length) {
      listEl.innerHTML = emptyState('주식 종목이 없습니다', "stock");
      return;
    }
    listEl.innerHTML = stocks.map(s => {
      const c = Compute.stockItem(s);
      return `
        <div class="stock-card">
          <div class="sc-top">
            <div class="sc-name">${esc(s.name)}</div>
            <div class="sc-right">
              <div class="sc-eval">${Format.krw(c.evalTotal)}</div>
              <div class="sc-pnl ${Format.colorClass(c.pnl)}">${Format.krw(c.pnl)} (${Format.pct(c.rate)})</div>
            </div>
          </div>
          <div class="sc-meta">
            <div class="sc-meta-item"><span class="sc-meta-label">보유수량</span><span class="sc-meta-val">${Format.num(s.qty)}주</span></div>
            <div class="sc-meta-item"><span class="sc-meta-label">매입 평단가</span><span class="sc-meta-val">${Format.krw(s.avgPrice)}</span></div>
          </div>
          <div class="price-edit-row">
            <span class="price-edit-label">현재가</span>
            <input class="price-input-inline" type="number" id="cur-${s.id}" value="${s.curPrice}" inputmode="numeric" />
            <button class="btn-apply" onclick="App.updateCurPrice('${s.id}')">적용</button>
          </div>
          <div class="card-actions">
            <button class="btn-icon" onclick="UI.openModal('stock','${s.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon danger" onclick="App.deleteStock('${s.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
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
    if (!savings.length) {
      listEl.innerHTML = emptyState('예적금 계좌가 없습니다', "saving");
      return;
    }
    listEl.innerHTML = savings.map(s => {
      const c = Compute.savingItem(s);
      const typeLabel = s.type === 'savings' ? '적금' : '예금';
      const typeClass = s.type === 'savings' ? 'type-savings' : 'type-deposit';
      return `
        <div class="saving-card">
          <span class="sv-badge ${typeClass}">${typeLabel} · ${s.interestType === 'compound' ? '복리' : '단리'}</span>
          <div class="sv-top">
            <div class="sv-name">${esc(s.name)}</div>
            <div class="sv-right">
              <div class="sv-maturity">${Format.krw(c.maturity)}</div>
              <div class="sv-interest">+${Format.krw(c.interest)}</div>
            </div>
          </div>
          <div class="sv-meta">
            <div class="sv-meta-item"><span class="sv-meta-label">원금</span><span class="sv-meta-val">${Format.krw(s.principal)}</span></div>
            <div class="sv-meta-item"><span class="sv-meta-label">금리</span><span class="sv-meta-val">${s.rate}%</span></div>
            <div class="sv-meta-item"><span class="sv-meta-label">기간</span><span class="sv-meta-val">${s.months}개월</span></div>
          </div>
          <div class="card-actions">
            <button class="btn-icon" onclick="UI.openModal('saving','${s.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon danger" onclick="App.deleteSaving('${s.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
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
    if (!loans.length) {
      listEl.innerHTML = emptyState('대출이 없습니다', "loan");
      return;
    }
    listEl.innerHTML = loans.map(l => {
      const c = Compute.loanItem(l);
      return `
        <div class="loan-card">
          <div class="ln-top">
            <div class="ln-name">${esc(l.name)}</div>
            <div class="ln-right">
              <div class="ln-monthly-label">월 이자</div>
              <div class="ln-monthly">${Format.krw(c.monthlyInt)}</div>
            </div>
          </div>
          <div class="ln-meta">
            <div class="ln-meta-item"><span class="ln-meta-label">원금</span><span class="ln-meta-val">${Format.krw(l.principal)}</span></div>
            <div class="ln-meta-item"><span class="ln-meta-label">금리</span><span class="ln-meta-val">${l.rate}%</span></div>
            <div class="ln-meta-item"><span class="ln-meta-label">연 이자</span><span class="ln-meta-val">${Format.krw(c.annualInt)}</span></div>
          </div>
          <div class="card-actions">
            <button class="btn-icon" onclick="UI.openModal('loan','${l.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon danger" onclick="App.deleteLoan('${l.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  /* ── 지출 탭 렌더 ── */
  function renderExpenses() {
    const { fixed, logs } = State.getAll();
    const monthLogs = Compute.thisMonthLogs(logs);

    document.getElementById('exp-total-spent').textContent = Format.krw(Compute.totalSpent(monthLogs));
    document.getElementById('exp-fixed-total').textContent = Format.krw(Compute.fixedTotal(fixed));
    document.getElementById('exp-fixed-unpaid').textContent = Compute.unpaidFixedCount(fixed, logs) + '건';

    const fixedListEl = document.getElementById('fixed-list');
    if (!fixed.length) {
      fixedListEl.innerHTML = emptyState('등록된 고정비가 없습니다', 'fixed');
    } else {
      const sorted = [...fixed].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));
      fixedListEl.innerHTML = sorted.map(f => {
        const cat = Cat.info(f.category);
        const paid = Compute.isPaidThisMonth(f.id, logs);
        return `
          <div class="fixed-card">
            <div class="fx-day">${f.day}일</div>
            <div class="fx-main">
              <div class="fx-top">
                <span class="cat-chip cat-${cat.cls}">${cat.label}</span>
                ${paid ? '<span class="paid-chip">이번달 완료</span>' : ''}
              </div>
              <div class="fx-name">${esc(f.name)}</div>
              <div class="fx-amount">${Format.krw(f.amount)}</div>
            </div>
            <div class="fx-actions">
              <button class="btn-record" onclick="UI.openLogFromFixed('${f.id}')">기록</button>
              <div class="fx-icon-row">
                <button class="btn-icon sm" onclick="UI.openModal('fixed','${f.id}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon sm danger" onclick="App.deleteFixed('${f.id}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </button>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    const logListEl = document.getElementById('log-list');
    if (!logs.length) {
      logListEl.innerHTML = emptyState('지출 기록이 없습니다', 'log');
    } else {
      const sorted = [...logs].sort((a, b) => b.ts - a.ts);
      logListEl.innerHTML = sorted.map(l => {
        const cat = Cat.info(l.category);
        return `
          <div class="log-row" onclick="UI.openModal('log','${l.id}')">
            <div class="log-cat dot-${cat.cls}"></div>
            <div class="log-info">
              <div class="log-name">${esc(l.name) || cat.label}</div>
              <div class="log-date">${l.date} · ${cat.label}</div>
            </div>
            <div class="log-amount">${Format.krw(l.amount)}</div>
            <button class="btn-icon sm danger" onclick="event.stopPropagation(); App.deleteLog('${l.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>`;
      }).join('');
    }
  }

  /* ── 전체 렌더 ── */
  function renderAll() {
    renderDashboard();
    renderStocks();
    renderSavings();
    renderLoans();
    renderExpenses();
  }

  /* ── 모달 열기 ── */
  function openModal(type, editId = null, prefill = null) {
    _modalType = type;
    _editId    = editId;

    const titleEl = document.getElementById('modal-title');
    const bodyEl  = document.getElementById('modal-body');

    let ex = null;
    if (editId) {
      const { stocks, savings, loans, fixed, logs } = State.getAll();
      if (type === 'stock')  ex = stocks.find(s => s.id === editId);
      if (type === 'saving') ex = savings.find(s => s.id === editId);
      if (type === 'loan')   ex = loans.find(l => l.id === editId);
      if (type === 'fixed')  ex = fixed.find(f => f.id === editId);
      if (type === 'log')    ex = logs.find(l => l.id === editId);
    }

    if (type === 'stock') {
      titleEl.textContent = editId ? '종목 수정' : '주식 추가';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">종목명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 삼성전자, AAPL" value="${ex ? esc(ex.name) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">보유 수량 (주)</label>
            <input class="form-input" id="f-qty" type="number" inputmode="numeric" placeholder="100" value="${ex ? ex.qty : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">매입 평단가 (₩)</label>
            <input class="form-input" id="f-avg" type="number" inputmode="numeric" placeholder="75000" value="${ex ? ex.avgPrice : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">현재가 (₩)</label>
          <input class="form-input" id="f-cur" type="number" inputmode="numeric" placeholder="80000" value="${ex ? ex.curPrice : ''}" />
          <p class="form-hint">카드에서 언제든지 수정 가능합니다</p>
        </div>`;
    }

    else if (type === 'saving') {
      titleEl.textContent = editId ? '예적금 수정' : '예적금 추가';
      const selType = ex ? ex.type : 'deposit';
      const selInt  = ex ? ex.interestType : 'simple';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">계좌명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 신한 정기예금" value="${ex ? esc(ex.name) : ''}" />
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
            <label class="form-label">이자 방식</label>
            <select class="form-select" id="f-itype">
              <option value="simple"   ${selInt==='simple'?'selected':''}>단리</option>
              <option value="compound" ${selInt==='compound'?'selected':''}>복리</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">원금 (₩)</label>
            <input class="form-input" id="f-principal" type="number" inputmode="numeric" placeholder="10000000" value="${ex ? ex.principal : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">연 이자율 (%)</label>
            <input class="form-input" id="f-rate" type="number" inputmode="decimal" step="0.01" placeholder="3.5" value="${ex ? ex.rate : ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">기간 (개월)</label>
            <input class="form-input" id="f-months" type="number" inputmode="numeric" placeholder="12" value="${ex ? ex.months : 12}" />
          </div>
          <div class="form-group">
            <label class="form-label">만기일 (선택)</label>
            <input class="form-input" id="f-maturity" type="date" value="${ex ? (ex.maturityDate || '') : ''}" />
          </div>
        </div>`;
    }

    else if (type === 'loan') {
      titleEl.textContent = editId ? '대출 수정' : '대출 추가';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">대출명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 주택담보대출" value="${ex ? esc(ex.name) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">대출 원금 (₩)</label>
            <input class="form-input" id="f-principal" type="number" inputmode="numeric" placeholder="100000000" value="${ex ? ex.principal : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">연 이자율 (%)</label>
            <input class="form-input" id="f-rate" type="number" inputmode="decimal" step="0.01" placeholder="4.5" value="${ex ? ex.rate : ''}" />
          </div>
        </div>
        <p class="form-hint">월 이자 = 원금 × 연이율 ÷ 12</p>`;
    }

    else if (type === 'fixed') {
      titleEl.textContent = editId ? '고정비 수정' : '고정비 추가';
      bodyEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">항목명</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 월세, 넷플릭스" value="${ex ? esc(ex.name) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">결제일 (매월)</label>
            <input class="form-input" id="f-day" type="number" inputmode="numeric" min="1" max="31" placeholder="25" value="${ex ? ex.day : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">금액 (₩)</label>
            <input class="form-input" id="f-amount" type="number" inputmode="numeric" placeholder="55000" value="${ex ? ex.amount : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <select class="form-select" id="f-category">
            ${Cat.list.map(c => `<option value="${c.id}" ${ex && ex.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>`;
    }

    else if (type === 'log') {
      titleEl.textContent = editId ? '지출 수정' : '지출 기록';
      const pf = prefill || {};
      const amount   = ex ? ex.amount   : (pf.amount ?? '');
      const category = ex ? ex.category : (pf.category || Cat.list[0].id);
      const name     = ex ? ex.name     : (pf.name || '');
      const date     = ex ? ex.date     : (pf.date || Format.todayDate());
      const fixedId  = ex ? (ex.fixedId || '') : (pf.fixedId || '');
      bodyEl.innerHTML = `
        <input type="hidden" id="f-fixedid" value="${fixedId}" />
        <div class="form-group">
          <label class="form-label">금액 (₩)</label>
          <input class="form-input" id="f-amount" type="number" inputmode="numeric" placeholder="12000" value="${amount}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">카테고리</label>
            <select class="form-select" id="f-category">
              ${Cat.list.map(c => `<option value="${c.id}" ${category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">날짜</label>
            <input class="form-input" id="f-date" type="date" value="${date}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">메모 (선택)</label>
          <input class="form-input" id="f-name" type="text" placeholder="예) 스타벅스" value="${esc(name)}" />
        </div>`;
    }

    document.getElementById('modal-overlay').classList.add('open');
    setTimeout(() => {
      const first = bodyEl.querySelector('input');
      if (first) first.focus();
    }, 300);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    _modalType = null;
    _editId    = null;
  }

  function saveModal() {
    const type = _modalType, editId = _editId;

    if (type === 'stock') {
      const name = document.getElementById('f-name').value.trim();
      const qty  = document.getElementById('f-qty').value;
      const avg  = document.getElementById('f-avg').value;
      const cur  = document.getElementById('f-cur').value;
      if (!name || !qty || !avg || !cur) { alert('모든 항목을 입력해 주세요.'); return; }
      const item = { name, qty: Number(qty), avgPrice: Number(avg), curPrice: Number(cur) };
      editId ? State.updateStock(editId, item) : State.addStock(item);
    }
    else if (type === 'saving') {
      const name      = document.getElementById('f-name').value.trim();
      const stype     = document.getElementById('f-type').value;
      const itype     = document.getElementById('f-itype').value;
      const principal = document.getElementById('f-principal').value;
      const rate      = document.getElementById('f-rate').value;
      const months    = document.getElementById('f-months').value;
      const matDate   = document.getElementById('f-maturity').value;
      if (!name || !principal || !rate || !months) { alert('필수 항목을 입력해 주세요.'); return; }
      const item = { name, type: stype, interestType: itype, principal: Number(principal), rate: Number(rate), months: Number(months), maturityDate: matDate };
      editId ? State.updateSaving(editId, item) : State.addSaving(item);
    }
    else if (type === 'loan') {
      const name      = document.getElementById('f-name').value.trim();
      const principal = document.getElementById('f-principal').value;
      const rate      = document.getElementById('f-rate').value;
      if (!name || !principal || !rate) { alert('모든 항목을 입력해 주세요.'); return; }
      const item = { name, principal: Number(principal), rate: Number(rate) };
      editId ? State.updateLoan(editId, item) : State.addLoan(item);
    }
    else if (type === 'fixed') {
      const name   = document.getElementById('f-name').value.trim();
      const day    = document.getElementById('f-day').value;
      const amount = document.getElementById('f-amount').value;
      const category = document.getElementById('f-category').value;
      if (!name || !day || !amount) { alert('모든 항목을 입력해 주세요.'); return; }
      const d = Number(day);
      if (d < 1 || d > 31) { alert('결제일은 1~31 사이로 입력해 주세요.'); return; }
      const item = { name, day: d, amount: Number(amount), category };
      editId ? State.updateFixed(editId, item) : State.addFixed(item);
    }
    else if (type === 'log') {
      const amount   = document.getElementById('f-amount').value;
      const category = document.getElementById('f-category').value;
      const date     = document.getElementById('f-date').value;
      const name     = document.getElementById('f-name').value.trim();
      const fixedId  = document.getElementById('f-fixedid').value || null;
      if (!amount || !date) { alert('금액과 날짜를 입력해 주세요.'); return; }
      const item = { amount: Number(amount), category, date, name, fixedId };
      editId ? State.updateLog(editId, item) : State.addLog(item);
    }

    closeModal();
    renderAll();
  }

  /* ── 고정비 카드에서 바로 지출 기록 ── */
  function openLogFromFixed(fixedId) {
    const { fixed } = State.getAll();
    const f = fixed.find(x => x.id === fixedId);
    if (!f) return;
    openModal('log', null, {
      amount: f.amount,
      category: f.category,
      name: f.name,
      fixedId: f.id,
      date: Format.todayDate()
    });
  }

  /* ── 유틸 ── */
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function emptyState(msg, type) {
    const typeMap = { stock: '주식 종목', saving: '예적금 계좌', loan: '대출', fixed: '고정비', log: '지출 기록' };
    return `
      <div class="empty-state">
        <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="var(--border)" stroke-width="2"/><line x1="22" y1="32" x2="42" y2="32" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="22" x2="32" y2="42" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/></svg>
        <p>${msg}</p>
        <button class="btn-primary-sm" onclick="UI.openModal('${type}')">+ ${typeMap[type]} 추가</button>
      </div>`;
  }

  return { switchTab, openModalFromTab, renderAll, openModal, closeModal, saveModal, openLogFromFixed };
})();


/* ─────────────────────────────────────────────────────
   5. APP MODULE
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

  function deleteStock(id)  { if (confirm('삭제하시겠습니까?'))  { State.deleteStock(id);  UI.renderAll(); } }
  function deleteSaving(id) { if (confirm('삭제하시겠습니까?'))  { State.deleteSaving(id); UI.renderAll(); } }
  function deleteLoan(id)   { if (confirm('삭제하시겠습니까?'))  { State.deleteLoan(id);   UI.renderAll(); } }
  function deleteFixed(id)  { if (confirm('삭제하시겠습니까?'))  { State.deleteFixed(id);  UI.renderAll(); } }
  function deleteLog(id)    { if (confirm('삭제하시겠습니까?'))  { State.deleteLog(id);    UI.renderAll(); } }

  function resetAll() {
    if (confirm('모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      State.reset();
      UI.renderAll();
    }
  }

  function init() {
    State.load();

    document.querySelectorAll('.nav-btn').forEach(el => {
      el.addEventListener('click', () => UI.switchTab(el.dataset.tab));
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') UI.closeModal();
    });

    UI.renderAll();
  }

  return { init, updateCurPrice, deleteStock, deleteSaving, deleteLoan, deleteFixed, deleteLog, resetAll };
})();

document.addEventListener('DOMContentLoaded', App.init);
