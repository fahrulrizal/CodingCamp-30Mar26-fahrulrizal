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
 * Load transactions from localStorage.
 * @returns {object[]}
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
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
 */
function addTransaction(name, amount, category) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString();

  const transaction = {
    id,
    name: name.trim(),
    amount: Number(amount),
    category,
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
    case 'date-asc':    return copy.sort((a, b) => a.id.localeCompare(b.id));
    case 'date-desc':
    default:            return copy.sort((a, b) => b.id.localeCompare(a.id));
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

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

    const amount = document.createElement('span');
    amount.className = 'transaction-amount';
    amount.textContent = '$' + t.amount.toFixed(2);

    const badge = document.createElement('span');
    badge.className = 'category-badge ' + t.category;
    badge.textContent = t.category;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete ' + t.name);
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => deleteTransaction(t.id));

    row.appendChild(name);
    row.appendChild(amount);
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

  // Generate colors — fixed palette for known categories, hashed for custom
  const palette = { Food: '#86efac', Transport: '#93c5fd', Fun: '#fde68a' };
  const colors = labels.map((c, i) => palette[c] || `hsl(${(i * 67 + 200) % 360}, 70%, 75%)`);

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
 * Re-render all UI components.
 */
function renderAll() {
  renderBalance(transactions);
  renderTransactionList(transactions);
  renderChart(transactions);
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

  const error = validateTransaction(name, amount, category);

  if (error) {
    if (errorEl) errorEl.textContent = error;
    return;
  }

  if (errorEl) errorEl.textContent = '';
  addTransaction(name, Number(amount), category);
  form.reset();
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
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modal-confirm').click();
    if (e.key === 'Escape') modal.hidden = true;
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
    getSortedTransactions,
    renderBalance,
    renderTransactionList,
    renderChart,
    handleFormSubmit,
  };
}
