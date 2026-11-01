const categories = ['Food', 'Travel', 'College', 'Shopping', 'Entertainment', 'Bills', 'Others'];
const payments = ['Cash', 'UPI', 'Card'];
const colors = ['#7461cf', '#4987c6', '#d69442', '#ce6b92', '#58a393', '#7e83b9', '#88919f'];
const storageKey = 'campusSpend';
const limit = 1000000000; // ₹1 crore, in integer paise.
const $ = id => document.getElementById(id);
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
let expenses = [];
let plans = {};
let editingId = null;
let storageBlocked = false;

function money(amount) {
  return (amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}
function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date.slice(0, 4) !== '0000' && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
function validMoney(amount) {
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= limit;
}
function readAmount(id) {
  const value = $(id).value;
  return value.trim() === '' ? NaN : Math.round(Number(value) * 100);
}
function announce(message) {
  $('message').textContent = message;
}
function loadExpenses() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    const ids = new Set();
    if (!data || !Array.isArray(data.expenses) || !data.plans || typeof data.plans !== 'object' || Array.isArray(data.plans)) throw Error();
    for (const expense of data.expenses) {
      if (!expense || typeof expense.id !== 'string' || ids.has(expense.id) ||
          !validMoney(expense.amount) || expense.amount === 0 || !validDate(expense.date) ||
          !categories.includes(expense.category) || !payments.includes(expense.payment) ||
          typeof expense.note !== 'string' || expense.note.length > 160) throw Error();
      ids.add(expense.id);
    }
    for (const [month, plan] of Object.entries(data.plans)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !plan || !validMoney(plan.funds) || !validMoney(plan.budget)) throw Error();
    }
    expenses = data.expenses;
    plans = data.plans;
  } catch {
    storageBlocked = true;
    document.querySelector('.local-badge').textContent = 'Storage needs attention';
    announce('Saved data could not be read. It has not been overwritten. Export any visible records and check browser storage before continuing.');
  }
}
function saveExpenses() {
  if (storageBlocked) {
    announce('Changes are only in memory because saved data could not be read. Export before leaving; existing storage has been preserved.');
    return;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify({ expenses, plans }));
    announce('Saved on this device.');
  } catch {
    document.querySelector('.local-badge').textContent = 'Not saved · export a backup';
    announce('Browser storage is unavailable or full. Changes are only in memory; export CSV before leaving.');
  }
}
function monthlyExpenses() {
  return expenses.filter(expense => expense.date.slice(0, 7) === $('month').value);
}
function calculateTotal(records) {
  return records.reduce((total, expense) => total + expense.amount, 0);
}
function resetForm() {
  editingId = null;
  $('expense-form').reset();
  $('date').value = localDate;
  $('form-title').textContent = 'Add an expense';
  $('save-expense').textContent = '+ Add expense';
  $('cancel-edit').hidden = true;
}
function addExpense(event) {
  event.preventDefault();
  const amount = readAmount('amount');
  if (!validMoney(amount) || amount === 0 || !validDate($('date').value) ||
      !categories.includes($('category').value) || !payments.includes($('payment').value)) {
    announce('Enter a valid date, category, payment method, and amount from ₹0.01 to ₹1 crore.');
    return;
  }
  const expense = {
    id: editingId || crypto.randomUUID(), amount,
    category: $('category').value, date: $('date').value,
    payment: $('payment').value, note: $('note').value.trim()
  };
  const duplicate = expenses.some(item => item.id !== editingId && item.amount === amount &&
    item.date === expense.date && item.category === expense.category && item.payment === expense.payment && item.note === expense.note);
  if (duplicate && !confirm('An identical expense exists. Save another anyway?')) return;
  if (editingId) expenses = expenses.map(item => item.id === editingId ? expense : item);
  else expenses.push(expense);
  $('month').value = expense.date.slice(0, 7);
  saveExpenses();
  resetForm();
  displayExpenses();
}
function editExpense(id) {
  const expense = expenses.find(item => item.id === id);
  editingId = id;
  for (const field of ['category', 'date', 'payment', 'note']) $(field).value = expense[field];
  $('amount').value = expense.amount / 100;
  $('form-title').textContent = 'Edit expense';
  $('save-expense').textContent = 'Save changes';
  $('cancel-edit').hidden = false;
  $('amount').focus();
  $('expense-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function deleteExpense(id) {
  if (!confirm('Delete this expense? This cannot be undone.')) return;
  expenses = expenses.filter(expense => expense.id !== id);
  if (editingId === id) resetForm();
  saveExpenses();
  displayExpenses();
}
function savePlan(event) {
  event.preventDefault();
  const funds = readAmount('funds');
  const budget = readAmount('budget');
  if (!validMoney(funds) || !validMoney(budget)) return announce('Enter available money and budget between ₹0 and ₹1 crore.');
  plans[$('month').value] = { funds, budget };
  saveExpenses();
  displayExpenses();
}
function displayExpenses() {
  const records = monthlyExpenses();
  const totalSpent = calculateTotal(records);
  const plan = plans[$('month').value] || { funds: 0, budget: 0 };
  $('available').textContent = money(plan.funds);
  $('spent').textContent = money(totalSpent);
  $('remaining').textContent = money(plan.funds - totalSpent);
  $('count').textContent = records.length;
  $('funds').value = plan.funds / 100;
  $('budget').value = plan.budget / 100;
  const percent = plan.budget ? totalSpent / plan.budget * 100 : 0;
  $('budget-progress').value = Math.min(percent, 100);
  $('budget-progress').className = percent >= 100 ? 'over' : percent >= 80 ? 'warning' : '';
  $('budget-percent').textContent = plan.budget ? Math.round(percent) + '% used' : '—';
  $('budget-status').textContent = plan.budget ? money(plan.budget - totalSpent) + ' budget remaining' : 'No budget set';
  $('budget-warning').textContent = !plan.budget ? 'Set a budget to give your spending a little direction.' :
    percent > 100 ? 'You are over budget. Time to pause and review your spending.' :
    percent >= 100 ? 'Your budget is fully used.' : percent >= 80 ? 'You have used at least 80% of your budget. Keep an eye on the little things.' : 'Looking good. Keep building that mindful spending habit.';
  displayBreakdown(records, totalSpent);
  const filtered = records.filter(expense => !$('filter-category').value || expense.category === $('filter-category').value);
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  $('transactions').replaceChildren();
  $('empty').hidden = filtered.length > 0;
  $('empty').querySelector('h3').textContent = records.length ? 'No expenses in this category' : 'A fresh start for your finances';
  $('empty').querySelector('p').textContent = records.length ? 'Try another category or add a new expense.' : 'Add your first expense. Even the ₹10 chai counts.';
  for (const expense of filtered) {
    const row = document.createElement('tr');
    for (const value of [expense.note || expense.category + ' expense', expense.category, expense.date, expense.payment, money(expense.amount)]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const categoryCell = row.children[1];
    const tag = document.createElement('span');
    tag.className = 'category-tag';
    tag.textContent = expense.category;
    tag.style.color = colors[categories.indexOf(expense.category)];
    categoryCell.replaceChildren(tag);
    row.children[4].className = 'number';
    const actions = document.createElement('td');
    const buttons = document.createElement('div');
    buttons.className = 'actions';
    for (const action of ['Edit', 'Delete']) {
      const button = document.createElement('button');
      button.textContent = action;
      button.setAttribute('aria-label', action + ' ' + (expense.note || expense.category) + ' ' + money(expense.amount));
      button.onclick = () => action === 'Edit' ? editExpense(expense.id) : deleteExpense(expense.id);
      buttons.append(button);
    }
    actions.append(buttons);
    row.append(actions);
    $('transactions').append(row);
  }
}
function displayBreakdown(records, totalSpent) {
  $('breakdown').replaceChildren();
  if (!records.length) {
    $('breakdown').textContent = 'Your spending story starts with your first expense.';
    return;
  }
  categories.forEach((category, index) => {
    const total = calculateTotal(records.filter(expense => expense.category === category));
    if (!total) return;
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    const label = document.createElement('span');
    label.textContent = category;
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.style.width = (total / totalSpent * 100) + '%';
    fill.style.background = colors[index];
    bar.append(fill);
    const amount = document.createElement('strong');
    amount.className = 'number';
    amount.textContent = money(total);
    row.append(label, bar, amount);
    $('breakdown').append(row);
  });
}
function exportCSV() {
  if (!expenses.length) return announce('Add an expense before exporting.');
  const rows = [['Date', 'Category', 'Payment', 'Amount (INR)', 'Note']];
  for (const expense of expenses) rows.push([expense.date, expense.category, expense.payment, (expense.amount / 100).toFixed(2), expense.note]);
  // Quote cells and neutralize spreadsheet formulas in user-entered notes.
  const csv = rows.map(row => row.map(value => {
    const text = String(value);
    return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'campusspend-all-expenses.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Exported all recorded expenses, across every month. Monthly plans stay in this browser.');
}
for (const category of categories) {
  $('category').add(new Option(category, category));
  $('filter-category').add(new Option(category, category));
}
$('month').value = localDate.slice(0, 7);
loadExpenses();
resetForm();
$('expense-form').onsubmit = addExpense;
$('plan-form').onsubmit = savePlan;
$('cancel-edit').onclick = resetForm;
$('month').onchange = () => {
  if (!$('month').value) $('month').value = localDate.slice(0, 7);
  displayExpenses();
};
$('filter-category').onchange = displayExpenses;
$('export').onclick = exportCSV;
displayExpenses();
