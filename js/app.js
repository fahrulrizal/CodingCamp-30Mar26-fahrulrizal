// Expense & Budget Visualizer — app.js

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'expense_transactions';
const CATEGORIES_KEY = 'expense_categories';
const THEME_KEY = 'expense_theme';

let CATEGORIES = loadCategories();

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
let transactions = [];

/** @type {Chart|null} */
let chartInstance = null;

/** @type {string} current sort key */
let currentSort = 'date-desc';

/** @type {string} monthly summary filter start date (YYYY-MM-DD or '') */
let summaryFilterStart = '';

/** @type {string} monthly summary filter end date (YYYY-MM-DD or '') */
let summaryFilterEnd = '';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Load categories from localStorage, falling back to defaults.
 * @returns {string[]}
 */
function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return ['Food', 'Transport', 'Fun'];
    return JSON.parse(raw);
  } catch {
    return ['Food', 'Transport', 'Fun'];
  }
}

/**
 * Persist categories to localStorage.
 * @param {string[]} cats
 */
function saveCategories(cats) {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  } catch (err) {
    console.warn('Failed to save categories:', err);
  }
}

/**
 * Load transactions from localStorage, migrating any that lack a date field.
 * @returns {object[]}
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    let migrated = false;
    const result = parsed.map(t => {
      if (!t.date) { migrated = true; return { ...t, date: today }; }
      return t;
    });
    if (migrated) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); } catch (_) {}
    }
    return result;
  } catch (err) {
    console.warn('Failed to load transactions from localStorage:', err);
    return [];
  }
}

/**
 * Persist transactions to localStorage.
 * @param {object[]} txns
 */
function saveTransactions(txns) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
  } catch (err) {
    console.warn('Failed to save transactions to localStorage:', err);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate transaction fields.
 * @param {string} name
 * @param {string|number} amount
 * @param {string} category
 * @returns {string|null} error message, or null if valid
 */
function validateTransaction(name, amount, category) {
  if (!name || !name.trim()) return 'Item name is required.';
  if (amount === '' || amount === null || amount === undefined) return 'Amount is required.';
  const parsed = Number(amount);
  if (isNaN(parsed)) return 'Amount must be a number.';
  if (parsed <= 0) return 'Amount must be greater than zero.';
  if (!category) return 'Please select a category.';
  return null;
}

// ---------------------------------------------------------------------------
// Business logic
// ---------------------------------------------------------------------------

/**
 * Add a transaction to state, persist, and re-render.
 * @param {string} name
 * @param {number} amount
 * @param {string} category
 * @param {string} [date] - YYYY-MM-DD; defaults to today
 */
function addTransaction(name, amount, category, date) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString();

  const transaction = {
    id,
    name: name.trim(),
    amount: Number(amount),
    category,
    date: date || new Date().toISOString().slice(0, 10),
  };

  transactions.push(transaction);
  saveTransactions(transactions);
  renderAll();
}

/**
 * Delete a transaction by id, persist, and re-render.
 * @param {string} id
 */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions(transactions);
  renderAll();
}

/**
 * Compute the total balance.
 * @param {object[]} txns
 * @returns {number}
 */
function computeBalance(txns) {
  return txns.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Compute per-category totals (dynamic categories).
 * @param {object[]} txns
 * @returns {Object.<string, number>}
 */
function computeCategoryTotals(txns) {
  const totals = {};
  for (const c of CATEGORIES) totals[c] = 0;
  for (const t of txns) {
    if (t.category in totals) {
      totals[t.category] += t.amount;
    } else {
      totals[t.category] = t.amount;
    }
  }
  return totals;
}

/**
 * Return a sorted copy of transactions based on currentSort.
 * @param {object[]} txns
 * @returns {object[]}
 */
function getSortedTransactions(txns) {
  const copy = [...txns];
  switch (currentSort) {
    case 'amount-desc': return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':  return copy.sort((a, b) => a.amount - b.amount);
    case 'category':    return copy.sort((a, b) => a.category.localeCompare(b.category));
    case 'date-asc':    return copy.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    case 'month-desc':  return copy.sort((a, b) => (b.date || '').slice(0, 7).localeCompare((a.date || '').slice(0, 7)));
    case 'month-asc':   return copy.sort((a, b) => (a.date || '').slice(0, 7).localeCompare((b.date || '').slice(0, 7)));
    case 'date-desc':
    default:            return copy.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Fixed palette for built-in categories; custom ones get a deterministic hsl color. */
const CATEGORY_PALETTE = { Food: '#86efac', Transport: '#93c5fd', Fun: '#fde68a' };

/**
 * Return a background color for a category.
 * For custom categories the index is derived from its position in CATEGORIES
 * so the color stays stable across re-renders.
 * @param {string} category
 * @returns {string}
 */
function getCategoryColor(category) {
  if (CATEGORY_PALETTE[category]) return CATEGORY_PALETTE[category];
  const idx = CATEGORIES.indexOf(category);
  const seed = idx >= 0 ? idx : category.length;
  return `hsl(${(seed * 67 + 200) % 360}, 70%, 75%)`;
}

/**
 * Update the balance display.
 * @param {object[]} txns
 */
function renderBalance(txns) {
  const el = document.getElementById('balance');
  if (!el) return;
  el.textContent = '$' + computeBalance(txns).toFixed(2);
}

/**
 * Render the transaction list (sorted).
 * @param {object[]} txns
 */
function renderTransactionList(txns) {
  const container = document.getElementById('transaction-list');
  if (!container) return;

  container.innerHTML = '';

  if (txns.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No transactions yet.';
    container.appendChild(empty);
    return;
  }

  for (const t of getSortedTransactions(txns)) {
    const row = document.createElement('div');
    row.className = 'transaction-row';
    row.dataset.id = t.id;

    const name = document.createElement('span');
    name.className = 'transaction-name';
    name.textContent = t.name;

    const meta = document.createElement('span');
    meta.className = 'transaction-meta';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'transaction-date';
    dateSpan.textContent = t.date
      ? new Date(t.date + 'T00:00:00').toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    const amount = document.createElement('span');
    amount.className = 'transaction-amount';
    amount.textContent = '$' + t.amount.toFixed(2);

    meta.appendChild(dateSpan);
    meta.appendChild(amount);

    const badge = document.createElement('span');
    badge.className = 'category-badge ' + t.category;
    badge.textContent = t.category;
    // For custom categories (no CSS class), apply color inline
    if (!CATEGORY_PALETTE[t.category]) {
      const bg = getCategoryColor(t.category);
      badge.style.background = bg;
      badge.style.color = '#1f2937';
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete ' + t.name);
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => deleteTransaction(t.id));

    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(badge);
    row.appendChild(deleteBtn);
    container.appendChild(row);
  }
}

/**
 * Render the spending pie chart.
 * @param {object[]} txns
 */
function renderChart(txns) {
  const canvas = document.getElementById('spending-chart');
  const emptyMsg = document.getElementById('chart-empty');
  if (!canvas || !emptyMsg) return;

  if (txns.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.style.display = 'none';
    emptyMsg.style.display = '';
    return;
  }

  const totals = computeCategoryTotals(txns);
  const labels = Object.keys(totals).filter(c => totals[c] > 0);
  const data = labels.map(c => totals[c]);

  const colors = labels.map((c, i) => getCategoryColor(c, i));

  emptyMsg.style.display = 'none';
  canvas.style.display = 'block';

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
    return;
  }

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not available.');
    return;
  }

  chartInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 1 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

/**
 * Group transactions by month (YYYY-MM) and compute totals per category.
 * Returns an array sorted newest-first.
 * @param {object[]} txns
 * @returns {{ month: string, label: string, total: number, byCategory: Object.<string,number> }[]}
 */
function computeMonthlySummary(txns) {
  const map = {};
  for (const t of txns) {
    const month = (t.date || '').slice(0, 7); // YYYY-MM
    if (!month) continue;
    if (!map[month]) map[month] = { total: 0, byCategory: {} };
    map[month].total += t.amount;
    map[month].byCategory[t.category] = (map[month].byCategory[t.category] || 0) + t.amount;
  }
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map(month => {
      const [year, m] = month.split('-');
      const label = new Date(Number(year), Number(m) - 1, 1)
        .toLocaleString('default', { month: 'long', year: 'numeric' });
      return { month, label, total: map[month].total, byCategory: map[month].byCategory };
    });
}

/**
 * Render the monthly summary section as a grouped transaction list.
 * Applies summaryFilterStart / summaryFilterEnd if set.
 * @param {object[]} txns
 */
function renderMonthlySummary(txns) {
  const container = document.getElementById('monthly-summary');
  if (!container) return;
  container.innerHTML = '';

  // Apply date range filter
  const filtered = txns.filter(t => {
    const d = t.date || '';
    if (summaryFilterStart && d < summaryFilterStart) return false;
    if (summaryFilterEnd && d > summaryFilterEnd) return false;
    return true;
  });

  const summary = computeMonthlySummary(filtered);

  if (summary.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = (summaryFilterStart || summaryFilterEnd) ? 'No data for the selected period.' : 'No data yet.';
    container.appendChild(empty);
    return;
  }

  for (const row of summary) {
    // Month header row
    const monthHeader = document.createElement('div');
    monthHeader.className = 'month-header';

    const monthLabel = document.createElement('span');
    monthLabel.className = 'month-label';
    monthLabel.textContent = row.label;

    const monthTotal = document.createElement('span');
    monthTotal.className = 'month-total';
    monthTotal.textContent = '$' + row.total.toFixed(2);

    monthHeader.appendChild(monthLabel);
    monthHeader.appendChild(monthTotal);
    container.appendChild(monthHeader);

    // Category breakdown chips
    const cats = document.createElement('div');
    cats.className = 'month-categories';
    for (const [cat, amt] of Object.entries(row.byCategory).sort((a, b) => b[1] - a[1])) {
      const item = document.createElement('span');
      item.className = 'month-cat-item';
      const badge = document.createElement('span');
      badge.className = 'category-badge ' + cat;
      badge.textContent = cat;
      if (!CATEGORY_PALETTE[cat]) {
        badge.style.background = getCategoryColor(cat);
        badge.style.color = '#1f2937';
      }
      const catAmt = document.createElement('span');
      catAmt.className = 'month-cat-amount';
      catAmt.textContent = '$' + amt.toFixed(2);
      item.appendChild(badge);
      item.appendChild(catAmt);
      cats.appendChild(item);
    }
    container.appendChild(cats);

    // Transaction list for this month
    const monthTxns = filtered
      .filter(t => (t.date || '').slice(0, 7) === row.month)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const list = document.createElement('div');
    list.className = 'month-txn-list';

    for (const t of monthTxns) {
      const item = document.createElement('div');
      item.className = 'month-txn-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'month-txn-name';
      nameSpan.textContent = t.name;

      const dateSpan = document.createElement('span');
      dateSpan.className = 'transaction-date';
      dateSpan.textContent = t.date
        ? new Date(t.date + 'T00:00:00').toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

      const badge = document.createElement('span');
      badge.className = 'category-badge ' + t.category;
      badge.textContent = t.category;
      if (!CATEGORY_PALETTE[t.category]) {
        badge.style.background = getCategoryColor(t.category);
        badge.style.color = '#1f2937';
      }

      const amtSpan = document.createElement('span');
      amtSpan.className = 'transaction-amount';
      amtSpan.textContent = '$' + t.amount.toFixed(2);

      item.appendChild(nameSpan);
      item.appendChild(dateSpan);
      item.appendChild(badge);
      item.appendChild(amtSpan);
      list.appendChild(item);
    }
    container.appendChild(list);
  }
}

/**
 * Re-render all UI components.
 */
function renderAll() {
  renderBalance(transactions);
  renderTransactionList(transactions);
  renderChart(transactions);
  renderMonthlySummary(transactions);
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

/**
 * Handle form submit event.
 * @param {Event} event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const errorEl = document.getElementById('form-error');

  const name = form.itemName.value;
  const amount = form.amount.value;
  const category = form.category.value;
  const date = form.date ? form.date.value : '';

  const error = validateTransaction(name, amount, category);

  if (error) {
    if (errorEl) errorEl.textContent = error;
    return;
  }

  if (errorEl) errorEl.textContent = '';
  addTransaction(name, Number(amount), category, date || undefined);
  form.reset();
  // Restore date to today after reset
  if (form.date) form.date.value = new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

/** @type {number|null} */
let toastTimer = null;

/**
 * Show a brief success toast message.
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-visible');
    toastTimer = null;
  }, 3000);
}

// ---------------------------------------------------------------------------
// Custom categories
// ---------------------------------------------------------------------------

/**
 * Add a new category, persist, and refresh the category select.
 * @param {string} name
 */
function addCategory(name) {
  CATEGORIES.push(name);
  saveCategories(CATEGORIES);
  refreshCategorySelect();
}

/** Sync the form's category <select> with the current CATEGORIES array. */
function refreshCategorySelect() {
  const select = document.getElementById('category');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Select category --</option>';
  for (const c of CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  }
  // Restore selection if still valid
  if (CATEGORIES.includes(current)) select.value = current;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  transactions = loadTransactions();

  // Sync category <select> with any custom categories saved in localStorage
  refreshCategorySelect();

  // Set date input default to today
  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  // Theme
  const savedDark = localStorage.getItem(THEME_KEY) === 'dark';
  applyTheme(savedDark);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  });

  // Form submit
  const form = document.getElementById('transaction-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      renderTransactionList(transactions);
    });
  }

  // New category modal
  const modal = document.getElementById('category-modal');
  const nameInput = document.getElementById('new-category-name');
  const modalError = document.getElementById('modal-error');

  document.getElementById('new-category-btn')?.addEventListener('click', () => {
    nameInput.value = '';
    modalError.textContent = '';
    modal.hidden = false;
    nameInput.focus();
  });

  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    modal.hidden = true;
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { modalError.textContent = 'Category name is required.'; return; }
    if (CATEGORIES.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      modalError.textContent = 'Category already exists.'; return;
    }
    addCategory(name);
    modal.hidden = true;
    showToast('Good Job Data Successful');
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modal-confirm').click();
    if (e.key === 'Escape') modal.hidden = true;
  });

  // Monthly summary date filter
  const filterStart = document.getElementById('summary-filter-start');
  const filterEnd = document.getElementById('summary-filter-end');
  const filterClear = document.getElementById('summary-filter-clear');

  function applyFilter() {
    summaryFilterStart = filterStart ? filterStart.value : '';
    summaryFilterEnd = filterEnd ? filterEnd.value : '';
    renderMonthlySummary(transactions);
  }

  filterStart?.addEventListener('change', applyFilter);
  filterEnd?.addEventListener('change', applyFilter);
  filterClear?.addEventListener('click', () => {
    if (filterStart) filterStart.value = '';
    if (filterEnd) filterEnd.value = '';
    summaryFilterStart = '';
    summaryFilterEnd = '';
    renderMonthlySummary(transactions);
  });

  renderAll();
});

// ---------------------------------------------------------------------------
// Exports (for testing)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadTransactions,
    saveTransactions,
    loadCategories,
    saveCategories,
    validateTransaction,
    addTransaction,
    deleteTransaction,
    computeBalance,
    computeCategoryTotals,
    computeMonthlySummary,
    getSortedTransactions,
    renderBalance,
    renderTransactionList,
    renderChart,
    renderMonthlySummary,
    handleFormSubmit,
  };

}
