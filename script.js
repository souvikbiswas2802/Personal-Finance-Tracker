document.addEventListener('DOMContentLoaded', () => {
  const CURRENT_USER_KEY = 'finance_current_user';
  const STORAGE_PREFIX = 'financeTracker_';

  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!currentUser) {
    window.location.href = "../auth.html";
    return;
  }

  function getStorageKeyForUser(user) {
    return `${STORAGE_PREFIX}${user}`;
  }
  function saveForUser(user, data) {
    try {
      localStorage.setItem(getStorageKeyForUser(user), JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save for user', e);
    }
  }
  function loadForUser(user) {
    try {
      const raw = localStorage.getItem(getStorageKeyForUser(user));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load for user', e);
      return null;
    }
  }
  function emptyDataShape() {
    return {
      income: [],
      expenses: [],
      expenseCategories: { food:0, transport:0, entertainment:0, shopping:0, bills:0, other:0 },
      incomeCategories: { salary:0, investment:0, freelance:0, gift:0, other:0 }
    };
  }

  let financialData = emptyDataShape();

  const logoutBtn = document.getElementById('logoutBtn');
  const exportJSONBtn = document.getElementById('exportJSONBtn');
  const importJSONInput = document.getElementById('importJSONInput');
  const importJSONBtn = document.getElementById('importJSONBtn');

  const expenseBtn = document.getElementById('expenseBtn');
  const incomeBtn  = document.getElementById('incomeBtn');
  const expensePage = document.getElementById('expensePage');
  const incomePage  = document.getElementById('incomePage');

  const csvFileExpense = document.getElementById('csvFileExpense');
  const csvFileIncome  = document.getElementById('csvFileIncome');
  const csvExpenseStatus = document.getElementById('csvExpenseStatus');
  const csvIncomeStatus  = document.getElementById('csvIncomeStatus');

  const expenseForm = document.getElementById('expenseForm');
  const incomeForm  = document.getElementById('incomeForm');

  const expensesList = document.getElementById('expensesList');
  const incomeList   = document.getElementById('incomeList');
  const noExpenses   = document.getElementById('noExpenses');
  const noIncome     = document.getElementById('noIncome');

  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  const today = new Date().toISOString().split('T')[0];

  const expenseChartCanvas = document.getElementById('expenseChart')?.getContext?.('2d');
  const incomeChartCanvas  = document.getElementById('incomeChart')?.getContext?.('2d');
  const trendChartCanvas   = document.getElementById('trendChart')?.getContext?.('2d');
  const incomeTrendCanvas  = document.getElementById('incomeTrendChart')?.getContext?.('2d');

  function saveDataForCurrentUser() {
    saveForUser(currentUser, financialData);
  }
  function loadDataForCurrentUser() {
    const loaded = loadForUser(currentUser);
    if (!loaded) return null;
    return loaded;
  }
  function escapeHtml(s){ if (!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  const existing = loadDataForCurrentUser();
  financialData = existing || emptyDataShape();

  (function initTheme() {
    const saved = localStorage.getItem('financeTrackerTheme');
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
    if (themeToggle) themeToggle.addEventListener('click', () => {
      const isDark = body.classList.toggle('dark-mode');
      applyTheme(isDark ? 'dark' : 'light');
    });
    function applyTheme(name) {
      if (name === 'dark') {
        body.classList.add('dark-mode'); localStorage.setItem('financeTrackerTheme', 'dark');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i> Light';
      } else {
        body.classList.remove('dark-mode'); localStorage.setItem('financeTrackerTheme', 'light');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i> Night';
      }
    }
  })();

  let expenseChartObj = null, incomeChartObj = null, trendChartObj = null, incomeTrendObj = null;
  function initCharts() {
    try {
      if (expenseChartCanvas && !expenseChartObj) {
        expenseChartObj = new Chart(expenseChartCanvas, { type:'doughnut', data:{ labels:['Food','Transport','Entertainment','Shopping','Bills','Other'], datasets:[{ data:[0,0,0,0,0,0] }]}, options:{responsive:true, maintainAspectRatio:false} });
      }
      if (incomeChartCanvas && !incomeChartObj) {
        incomeChartObj = new Chart(incomeChartCanvas, { type:'doughnut', data:{ labels:['Salary','Investment','Freelance','Gift','Other'], datasets:[{ data:[0,0,0,0,0] }]}, options:{responsive:true, maintainAspectRatio:false} });
      }
      if (trendChartCanvas && !trendChartObj) {
        trendChartObj = new Chart(trendChartCanvas, { type:'line', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'Expenses', data:new Array(12).fill(0) }]}, options:{responsive:true, maintainAspectRatio:false} });
      }
      if (incomeTrendCanvas && !incomeTrendObj) {
        incomeTrendObj = new Chart(incomeTrendCanvas, { type:'line', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'Income', data:new Array(12).fill(0) }]}, options:{responsive:true, maintainAspectRatio:false} });
      }
    } catch (e) { console.warn('charts init skipped', e); }
  }
  function updateAllCharts() {
    initCharts();
    if (expenseChartObj) {
      const ds = ['food','transport','entertainment','shopping','bills','other'].map(k => financialData.expenseCategories[k] || 0);
      expenseChartObj.data.datasets[0].data = ds; expenseChartObj.update();
    }
    if (incomeChartObj) {
      const ds = ['salary','investment','freelance','gift','other'].map(k => financialData.incomeCategories[k] || 0);
      incomeChartObj.data.datasets[0].data = ds; incomeChartObj.update();
    }
    const year = new Date().getFullYear();
    if (trendChartObj) {
      const months = new Array(12).fill(0);
      financialData.expenses.forEach(e => { const d = new Date(e.date); if (!isNaN(d) && d.getFullYear() === year) months[d.getMonth()] += Number(e.amount)||0; });
      trendChartObj.data.datasets[0].data = months; trendChartObj.update();
    }
    if (incomeTrendObj) {
      const months = new Array(12).fill(0);
      financialData.income.forEach(i => { const d = new Date(i.date); if (!isNaN(d) && d.getFullYear() === year) months[d.getMonth()] += Number(i.amount)||0; });
      incomeTrendObj.data.datasets[0].data = months; incomeTrendObj.update();
    }
  }

  function addExpenseToTable(expense) {
    if (!expensesList) return;
    const tr = document.createElement('tr');
    tr.dataset.id = expense.id;
    tr.innerHTML = `
      <td>${escapeHtml(expense.description)}</td>
      <td>₹${Number(expense.amount).toFixed(2)}</td>
      <td><span class="category-badge">${escapeHtml(expense.category || 'other')}</span></td>
      <td>${escapeHtml(expense.date)}</td>
      <td><button class="delete-btn" data-type="expense"><i class="fas fa-trash"></i></button></td>
    `;
    expensesList.appendChild(tr);
  }
  function addIncomeToTable(income) {
    if (!incomeList) return;
    const tr = document.createElement('tr');
    tr.dataset.id = income.id;
    tr.innerHTML = `
      <td>${escapeHtml(income.description)}</td>
      <td>₹${Number(income.amount).toFixed(2)}</td>
      <td><span class="category-badge">${escapeHtml(income.category || 'other')}</span></td>
      <td>${escapeHtml(income.date)}</td>
      <td><button class="delete-btn" data-type="income"><i class="fas fa-trash"></i></button></td>
    `;
    incomeList.appendChild(tr);
  }
  function updateTotalsUI() {
    const totalIncome = financialData.income.reduce((s,i) => s + (Number(i.amount)||0), 0);
    const totalExpense = financialData.expenses.reduce((s,e) => s + (Number(e.amount)||0), 0);
    const balance = totalIncome - totalExpense;
    document.getElementById('incomeValue') && (document.getElementById('incomeValue').textContent = `₹${totalIncome.toFixed(2)}`);
    document.getElementById('expenseValue') && (document.getElementById('expenseValue').textContent = `₹${totalExpense.toFixed(2)}`);
    document.getElementById('balanceValue') && (document.getElementById('balanceValue').textContent = `₹${balance.toFixed(2)}`);
  }

  function addExpense(rec) {
    rec.id = rec.id || (Date.now() + Math.floor(Math.random()*1000));
    rec.amount = Number(rec.amount) || 0;
    rec.category = (rec.category || 'other').toLowerCase();
    financialData.expenses.push(rec);
    financialData.expenseCategories[rec.category] = (financialData.expenseCategories[rec.category] || 0) + rec.amount;
    addExpenseToTable(rec);
    updateTotalsUI(); updateAllCharts(); saveDataForCurrentUser();
  }
  function addIncome(rec) {
    rec.id = rec.id || (Date.now() + Math.floor(Math.random()*1000));
    rec.amount = Number(rec.amount) || 0;
    rec.category = (rec.category || 'other').toLowerCase();
    financialData.income.push(rec);
    financialData.incomeCategories[rec.category] = (financialData.incomeCategories[rec.category] || 0) + rec.amount;
    addIncomeToTable(rec);
    updateTotalsUI(); updateAllCharts(); saveDataForCurrentUser();
  }

  function rebuildUIFromData() {
    if (expensesList) expensesList.innerHTML = '';
    if (incomeList) incomeList.innerHTML = '';

    if (!financialData.expenses.length) {
      noExpenses && (noExpenses.style.display = 'block');
      document.getElementById('expensesTable') && (document.getElementById('expensesTable').style.display = 'none');
    } else {
      noExpenses && (noExpenses.style.display = 'none');
      document.getElementById('expensesTable') && (document.getElementById('expensesTable').style.display = 'table');
      financialData.expenses.forEach(addExpenseToTable);
    }

    if (!financialData.income.length) {
      noIncome && (noIncome.style.display = 'block');
      document.getElementById('incomeTable') && (document.getElementById('incomeTable').style.display = 'none');
    } else {
      noIncome && (noIncome.style.display = 'none');
      document.getElementById('incomeTable') && (document.getElementById('incomeTable').style.display = 'table');
      financialData.income.forEach(addIncomeToTable);
    }

    updateTotalsUI(); updateAllCharts();
  }

  csvFileExpense?.addEventListener('change', ()=>{ const f = csvFileExpense.files[0]; csvExpenseStatus && (csvExpenseStatus.textContent = f ? `${f.name} — ${Math.round(f.size/1024)}KB` : ''); });
  csvFileIncome?.addEventListener('change', ()=>{ const f = csvFileIncome.files[0]; csvIncomeStatus && (csvIncomeStatus.textContent = f ? `${f.name} — ${Math.round(f.size/1024)}KB` : ''); });

  function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      let cur = '', inQuotes = false, row = [];
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if (ch === '"' && !inQuotes) { inQuotes = true; continue; }
        if (ch === '"' && inQuotes) { inQuotes = false; continue; }
        if (ch === ',' && !inQuotes) { row.push(cur); cur = ''; continue; }
        cur += ch;
      }
      row.push(cur);
      rows.push(row.map(s => s.trim()));
    }
    return rows;
  }

  document.getElementById('processCSVExpense')?.addEventListener('click', ()=>{
    if (!csvFileExpense?.files || csvFileExpense.files.length === 0) return alert('Select CSV');
    const f = csvFileExpense.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result);
        if (rows.length <= 1) return alert('CSV empty or invalid');
        let added = 0;
        for (let i=1;i<rows.length;i++){
          const r = rows[i]; if (!r || r.length < 4) continue;
          const desc = r[0], amount = parseFloat(r[1]), cat = (r[2]||'other').toLowerCase(), date = r[3];
          if (!desc || isNaN(amount) || amount <= 0 || !date) continue;
          addExpense({ description: desc, amount, category: cat, date });
          added++;
        }
        csvExpenseStatus && (csvExpenseStatus.textContent = `Loaded ${f.name} — ${added} added`);
        csvFileExpense.value = '';
        alert(`Imported ${added} expenses.`);
      } catch (err) { console.error(err); alert('CSV import error'); }
    };
    reader.readAsText(f);
  });

  document.getElementById('processCSVIncome')?.addEventListener('click', ()=>{
    if (!csvFileIncome?.files || csvFileIncome.files.length === 0) return alert('Select CSV');
    const f = csvFileIncome.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result);
        if (rows.length <= 1) return alert('CSV empty or invalid');
        let added = 0;
        for (let i=1;i<rows.length;i++){
          const r = rows[i]; if (!r || r.length < 4) continue;
          const desc = r[0], amount = parseFloat(r[1]), cat = (r[2]||'other').toLowerCase(), date = r[3];
          if (!desc || isNaN(amount) || amount <= 0 || !date) continue;
          addIncome({ description: desc, amount, category: cat, date });
          added++;
        }
        csvIncomeStatus && (csvIncomeStatus.textContent = `Loaded ${f.name} — ${added} added`);
        csvFileIncome.value = '';
        alert(`Imported ${added} incomes.`);
      } catch (err) { console.error(err); alert('CSV import error'); }
    };
    reader.readAsText(f);
  });

  expenseForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const desc = (document.getElementById('expenseDescription')?.value || '').trim();
    const amount = parseFloat(document.getElementById('expenseAmount')?.value);
    const category = (document.getElementById('expenseCategory')?.value || 'other').toLowerCase();
    const date = document.getElementById('expenseDate')?.value || today;
    if (!desc || isNaN(amount) || amount <= 0) return alert('Enter valid description & amount');
    addExpense({ description: desc, amount, category, date });
    expenseForm.reset(); document.getElementById('expenseDate') && (document.getElementById('expenseDate').valueAsDate = new Date());
    alert('Expense added.');
  });

  incomeForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const desc = (document.getElementById('incomeDescription')?.value || '').trim();
    const amount = parseFloat(document.getElementById('incomeAmount')?.value);
    const category = (document.getElementById('incomeCategory')?.value || 'other').toLowerCase();
    const date = document.getElementById('incomeDate')?.value || today;
    if (!desc || isNaN(amount) || amount <= 0) return alert('Enter valid description & amount');
    addIncome({ description: desc, amount, category, date });
    incomeForm.reset(); document.getElementById('incomeDate') && (document.getElementById('incomeDate').valueAsDate = new Date());
    alert('Income added.');
  });

  document.addEventListener('click', (e)=>{
    let t = e.target;
    if (t.tagName.toLowerCase() === 'i' && t.parentElement) t = t.parentElement;
    if (!t.classList.contains('delete-btn')) return;
    const row = t.closest('tr'); if (!row) return;
    const id = Number(row.dataset.id); const type = t.dataset.type;
    if (!id || !type) return;
    if (!confirm('Delete this record?')) return;
    if (type === 'expense') {
      const idx = financialData.expenses.findIndex(x => x.id === id);
      if (idx !== -1) {
        const rec = financialData.expenses[idx];
        financialData.expenseCategories[rec.category] = Math.max(0, (financialData.expenseCategories[rec.category]||0) - (Number(rec.amount)||0));
        financialData.expenses.splice(idx,1);
        row.remove();
        if (!financialData.expenses.length) { noExpenses && (noExpenses.style.display = 'block'); document.getElementById('expensesTable') && (document.getElementById('expensesTable').style.display = 'none'); }
        updateTotalsUI(); updateAllCharts(); saveDataForCurrentUser();
      }
    } else if (type === 'income') {
      const idx = financialData.income.findIndex(x => x.id === id);
      if (idx !== -1) {
        const rec = financialData.income[idx];
        financialData.incomeCategories[rec.category] = Math.max(0, (financialData.incomeCategories[rec.category]||0) - (Number(rec.amount)||0));
        financialData.income.splice(idx,1);
        row.remove();
        if (!financialData.income.length) { noIncome && (noIncome.style.display = 'block'); document.getElementById('incomeTable') && (document.getElementById('incomeTable').style.display = 'none'); }
        updateTotalsUI(); updateAllCharts(); saveDataForCurrentUser();
      }
    }
  });

  exportJSONBtn?.addEventListener('click', ()=>{
    const payload = { _user: currentUser, _exportedAt: new Date().toISOString(), data: financialData };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentUser}_finance_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  });

  importJSONBtn?.addEventListener('click', ()=>{
    if (!importJSONInput?.files || importJSONInput.files.length === 0) return alert('Choose a JSON file to import');
    const f = importJSONInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const candidate = parsed.data || parsed;
        if (!candidate || typeof candidate !== 'object') return alert('Invalid JSON shape');
        if (!Array.isArray(candidate.income) || !Array.isArray(candidate.expenses)) return alert('JSON must include income & expenses arrays');
        if (!confirm('Importing JSON will replace your current saved data for this user. Continue?')) return;
        candidate.expenseCategories = candidate.expenseCategories || financialData.expenseCategories || {};
        candidate.incomeCategories = candidate.incomeCategories || financialData.incomeCategories || {};
        financialData = candidate;
        saveDataForCurrentUser();
        rebuildUIFromData();
        alert('Import successful.');
      } catch (err) {
        console.error('import json', err);
        alert('Failed to parse JSON.');
      }
    };
    reader.readAsText(f);
  });

  logoutBtn?.addEventListener('click', ()=>{
    if (!confirm('Logout?')) return;
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = "../auth.html";
  });

  (function initUI(){
    const expenseDateEl = document.getElementById('expenseDate');
    const incomeDateEl = document.getElementById('incomeDate');
    if (expenseDateEl) { expenseDateEl.max = today; expenseDateEl.valueAsDate = new Date(); }
    if (incomeDateEl) { incomeDateEl.max = today; incomeDateEl.valueAsDate = new Date(); }

    function showExpensePage(){ expensePage?.classList.add('active'); incomePage?.classList.remove('active'); expenseBtn?.classList.add('active'); incomeBtn?.classList.remove('active'); }
    function showIncomePage(){ incomePage?.classList.add('active'); expensePage?.classList.remove('active'); incomeBtn?.classList.add('active'); expenseBtn?.classList.remove('active'); }
    expenseBtn?.addEventListener('click', (e)=>{ e.preventDefault(); showExpensePage(); });
    incomeBtn?.addEventListener('click', (e)=>{ e.preventDefault(); showIncomePage(); });
    if (!expensePage?.classList.contains('active') && !incomePage?.classList.contains('active')) showExpensePage();

    rebuildUIFromData();
  })();

  function convertToCSV(dataArray, headers) {
    const csvRows = [];
    csvRows.push(headers.join(','));
    dataArray.forEach(item => {
      const row = [
        `"${item.description}"`,
        item.amount,
        `"${item.category}"`,
        `"${item.date}"`
      ];
      csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
  }

  document.getElementById('downloadExpensesCSV')?.addEventListener('click', () => {
    if (!financialData.expenses.length) return alert('No expenses to download.');
    const csv = convertToCSV(financialData.expenses, ['Description', 'Amount', 'Category', 'Date']);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentUser}_expenses_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  document.getElementById('downloadIncomeCSV')?.addEventListener('click', () => {
    if (!financialData.income.length) return alert('No income to download.');
    const csv = convertToCSV(financialData.income, ['Description', 'Amount', 'Category', 'Date']);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentUser}_income_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  window.__financeDebug = { currentUser, financialData, saveDataForCurrentUser, loadForUser };
});
