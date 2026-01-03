// finance.js

const API_URL = 'http://localhost:3000';

let transactions = [];
let allHistory = [];
let currentPage = 1;
const rowsPerPage = 5;

const productSelect = document.getElementById('productSelect');
const availableInfo = document.getElementById('availableInfo');

// --- Завантаження всіх даних ---
async function loadTransactions() {
    const res = await fetch(`${API_URL}/finance`);
    transactions = await res.json();
    currentPage = 1;
    renderPage();
}

async function loadAllHistory() {
    const res = await fetch(`${API_URL}/allHistory`);
    allHistory = await res.json();
    renderProductSelect();
    updateAvailableInfo();
}

function renderProductSelect() {
    // підвантажуємо всі доступні вироби зі складу
    const totals = {};
    allHistory.forEach(h => {
        totals[h.product] = (totals[h.product] || 0) + h.qty;
    });
    productSelect.innerHTML = Object.keys(totals).map(p => `<option value="${p}">${p}</option>`).join('');
    updateAvailableInfo();
}

function updateAvailableInfo() {
    const selected = productSelect.value;
    if (!selected) return;
    const qty = allHistory.filter(h => h.product === selected).reduce((acc, h) => acc + h.qty, 0);
    availableInfo.textContent = `Доступно: ${qty} шт.`;
}

productSelect.addEventListener('change', updateAvailableInfo);

// --- Прихід ---
async function addIncome() {
    const product = document.getElementById('productSelect').value;
    const qty = parseInt(document.getElementById('productQty').value);
    const amount = parseFloat(document.getElementById('incomeAmount').value);
    const description = document.getElementById('incomeDesc').value;
    const date = document.getElementById('incomeDate').value;

    if (!product || qty <= 0 || !amount || !description || !date) {
        alert('Будь ласка, заповніть усі поля приходу');
        return;
    }

    // Перевіряємо доступність товару на складі
    const availableQty = allHistory
        .filter(h => h.product === product)
        .reduce((acc, h) => acc + h.qty, 0);
    if (qty > availableQty) {
        alert(`Недостатньо продукції! Доступно: ${availableQty} шт.`);
        return;
    }

    // Списуємо товар зі складу
    let remaining = qty;
    for (let i = 0; i < allHistory.length && remaining > 0; i++) {
        const entry = allHistory[i];
        if (entry.product === product) {
            if (entry.qty <= remaining) {
                remaining -= entry.qty;
                await fetch(`${API_URL}/allHistory/${entry._id}`, { method: 'DELETE' });
            } else {
                const newQty = entry.qty - remaining;
                remaining = 0;
                await fetch(`${API_URL}/allHistory/${entry._id}`, {
                    method: 'PATCH',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ qty: newQty })
                });
            }
        }
    }

    // Додаємо фінансову операцію (надходження грошей)
    await fetch(`${API_URL}/finance`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ type: 'прихід', amount, description, date })
    });

    // Очищаємо поля
    document.getElementById('productQty').value = '';
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeDesc').value = '';
    document.getElementById('incomeDate').value = '';

    await loadAllHistory();
    await loadTransactions();
}

// --- Розхід (списання грошей з балансу) ---
async function addExpense() {
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDesc').value;
    const date = document.getElementById('expenseDate').value;

    if (!amount || !description || !date) {
        alert('Будь ласка, заповніть усі поля розходу');
        return;
    }

    // Перевірка балансу
    const balance = transactions.reduce((acc, item) => {
        return item.type === 'прихід' ? acc + item.amount : acc - item.amount;
    }, 0);

    if (amount > balance) {
        alert(`Недостатньо грошей на балансі! Поточний баланс: ${balance} грн`);
        return;
    }

    // Додаємо фінансову операцію (списання грошей)
    await fetch(`${API_URL}/finance`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ type: 'розхід', amount, description, date })
    });

    // Очищаємо поля
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseDate').value = '';

    await loadTransactions();
}

// --- Видалити фінансову операцію ---
async function deleteTransaction(id) {
    await fetch(`${API_URL}/finance/${id}`, { method: 'DELETE' });
    await loadTransactions();
}

// --- Пагінація ---
function renderPage() {
    const tbody = document.querySelector('#financeTable tbody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageItems = transactions.slice(start, end);

    let balance = 0;
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        const [year, month, day] = item.date.split('-');
        const formattedDate = `${day}.${month}.${year}`;

        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${item.type}</td>
            <td>${item.amount}</td>
            <td>${item.description}</td>
            <td><button onclick="deleteTransaction('${item._id}')">Видалити</button></td>
        `;

        if(item.type === 'прихід') tr.style.backgroundColor = '#d4edda';
        else if(item.type === 'розхід') tr.style.backgroundColor = '#f8d7da';

        tbody.appendChild(tr);

        if(item.type === 'прихід') balance += item.amount;
        else balance -= item.amount;
    });

    document.getElementById('balance').textContent = balance + ' грн';
    document.getElementById('pageInfo').textContent = `Сторінка ${currentPage}`;
}

document.getElementById('prevPage').addEventListener('click', () => {
    if(currentPage > 1) currentPage--;
    renderPage();
});

document.getElementById('nextPage').addEventListener('click', () => {
    if(currentPage * rowsPerPage < transactions.length) currentPage++;
    renderPage();
});

// --- Ініціалізація ---
async function init() {
    await loadAllHistory();
    await loadTransactions();
}

init();