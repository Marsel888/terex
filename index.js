// index.js
let inventory = {};
let recipes = {};
let history = [];
let allHistory = [];
const API_URL = 'http://localhost:3000';

const itemSelect = document.getElementById('itemSelect');
const inventoryTable = document.getElementById('inventoryTable').querySelector('tbody');
const sumTable = document.getElementById('sumTable').querySelector('tbody');
const fullInventoryTable = document.getElementById('fullInventoryTable').querySelector('tbody');
//const recipeTable = document.getElementById('recipeTable').querySelector('tbody');
const productSelect = document.getElementById('productSelect');
const maxInfo = document.getElementById('maxInfo');
const produceQtyInput = document.getElementById('produceQty');
const historyBody = document.getElementById('historyBody');

// --- Готові рецепти ---
const savedRecipes = {
  'Комплект 4': {'Викрутка': 1, 'Саморіз': 4, 'Упаковка': 1},
  'Комплект 2': {'Викрутка': 1, 'Саморіз': 2, 'Упаковка': 1}
};
recipes = savedRecipes;

// --- Список доступних компонентів ---
const availableComponents = ['Викрутка', 'Саморіз', 'Упаковка'];
itemSelect.innerHTML = availableComponents.map(c => `<option value='${c}'>${c}</option>`).join('');

// --- Fetch даних з сервера ---
async function loadInventory() {
  const res = await fetch('http://localhost:3000/inventory');
  const items = await res.json();

  
  inventory = {};
  items.forEach(item => inventory[item.name] = item.qty);
  renderInventory();
}

async function loadHistory() {
  const res = await fetch('http://localhost:3000/history');
  history = await res.json();

      const allRes = await fetch('http://localhost:3000/allHistory');
      allHistory = await allRes.json();
  renderHistory();
  renderDataProducts()
  calculateMax();
}

// --- Inventory ---
async function addItem() {
  const name = itemSelect.value;
  const qty = parseFloat(document.getElementById('itemQty').value);
  if (!name || qty <= 0) return;
  inventory[name] = (inventory[name] || 0) + qty;
  await fetch('http://localhost:3000/inventory', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(inventory)
  });
  renderInventory();
  calculateMax();
}

async function removeItem() {
  const name = itemSelect.value; // вибраний компонент
  if (!name) return;

  // Обнуляємо локально
  inventory[name] = 0;

  // Відправляємо на сервер
  await fetch(`http://localhost:3000/inventory/${encodeURIComponent(name)}`, {
    method: 'PATCH', // оновлення кількості
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qty: 0 })
  });

  renderInventory();
  calculateMax();
}

async function removeFullInventoryTable() {
   await fetch(`http://localhost:3000/allHistory`, { method: 'DELETE' });

 const allRes = await fetch('http://localhost:3000/allHistory');
      allHistory = await allRes.json();

     fullInventoryTable.innerHTML = allHistory.map(item =>
    `<tr><td>${item.product}</td><td>${item.qty}</td></tr>`
  ).join('');
}



function renderInventory() {
  inventoryTable.innerHTML = Object.entries(inventory).map(([n,q]) =>
    `<tr><td>${n}</td><td>${q}</td></tr>`
  ).join('');
}

// --- Recipes ---
function renderRecipes() {
  // recipeTable.innerHTML = Object.entries(recipes).map(([name, comp]) =>
  //   `<tr><td>${name}</td><td>${Object.entries(comp).map(([k,v])=>`${k}: ${v}`).join(', ')}</td></tr>`
  // ).join('');
   productSelect.innerHTML = Object.keys(recipes).map(r => `<option value='${r}'>${r}</option>`).join('');
}

//--- Виробництво ---
function calculateMax() {
  const product = productSelect.value;
  if (!product) return;
  const recipe = recipes[product];
  let max = Infinity;
  for (const [n,q] of Object.entries(recipe)) {
    const available = inventory[n] || 0;
    max = Math.min(max, Math.floor(available/q));
  }
  maxInfo.textContent = `Можна зробити максимум ${max} шт.`;
}

async function produce() {

  const product = productSelect.value;
  const qty = parseInt(produceQtyInput.value) || 1;
  if (!product) return;
  const recipe = recipes[product];
  let max = Infinity;
  for (const [n,q] of Object.entries(recipe)) {
    const available = inventory[n] || 0;
    max = Math.min(max, Math.floor(available/q));
  }
  if (max < qty) return alert('Недостатньо компонентів!');
  for (const [n,q] of Object.entries(recipe)) {
    inventory[n] -= q*qty;
  }
  const entry = { date: new Date().toLocaleString(), product, qty };
  await fetch('http://localhost:3000/history', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(entry)
  });

   await fetch('http://localhost:3000/allHistory', { 
    method: 'POST', 
    headers:{'Content-Type':'application/json'}, 
    body: JSON.stringify(entry) });

  await fetch('http://localhost:3000/inventory', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(inventory)
  });
  await loadHistory();
  renderInventory();
}

// --- Історія ---
function renderHistory() {
  historyBody.innerHTML = history.map(h =>
    `<tr>
      <td>${h.date}</td>
      <td>${h.product}</td>
      <td>${h.qty}</td>
      <td><button onclick='deleteProduced("${h._id}")'>Видалити</button></td>
    </tr>`
  ).join('');
}

async function deleteProduced(id) {
  if (!confirm('Видалити цю вироблену продукцію?')) return;
  const entry = history.find(h => h._id === id);
  if (entry) {
    const recipe = recipes[entry.product];
    for (const [comp, qty] of Object.entries(recipe)) {
      inventory[comp] = (inventory[comp] || 0) + qty*entry.qty;
    }
    await fetch(`http://localhost:3000/history/${id}`, { method: 'DELETE' });
    // await fetch('http://localhost:3000/inventory', {
    //   method: 'POST',
    //   headers: {'Content-Type': 'application/json'},
    //   body: JSON.stringify(inventory)
    // });
    await loadHistory();
    renderInventory();
  }
}

// --- Ініціалізація ---
async function init() {
  await loadInventory();
  renderRecipes();
  await loadHistory();
}

// Отримуємо склад компонентів
async function fetchInventory() {
  const res = await fetch(`${API_URL}/inventory`);
  const arr = await res.json(); // масив об'єктів
  const result = {};
  arr.forEach(item => {
    result[item.name] = item.qty;
  });
  return result; // тепер можна робити inventory[component]
}

// Отримуємо рецепти
async function fetchRecipes() {
  const res = await fetch(`${API_URL}/recipes`);
  return await res.json(); // повертає {назваВиробу: {компонент: кількість}}
}

// Рахуємо максимально можливу кількість продуктів
async function calculateMax() {
  const inventory = await fetchInventory();
  const recipes = await fetchRecipes();

  const results = {};

  // Проходимо по всіх наявних рецептах з бази
  for (const product of Object.keys(recipes)) {
    const recipe = recipes[product];
    let max = Infinity;

    // Перевіряємо, скільки можна зробити з кожного компонента
    for (const [component, qty] of Object.entries(recipe)) {
      const available = inventory[component] || 0; // якщо немає компоненту → 0
      max = Math.min(max, Math.floor(available / qty));
    }

    // Якщо хоча б один компонент є у складі, додаємо до результату
    if (max > 0) {
      results[product] = max;
    }
  }

  renderMaxProducts(results);
}

// Виводимо на сторінку
function renderMaxProducts(maxData) {
  if (!Object.keys(maxData).length) {
    sumTable.innerHTML = 'Немає можливих продуктів для виробництва';
    return;
  }

//   el.innerHTML = Object.entries(maxData)
//     .map(([product, max]) => `${product}: ${max} шт.`)
//     .join('<br>');


   sumTable.innerHTML = Object.entries(maxData).map(([name, comp]) =>
    `<tr><td>${name}</td><td>${comp}</td></tr>`
  ).join('');
  //inventoryTable.innerHTML = Object.keys(recipes).map(r => `<option value='${r}'>${r}</option>`).join('');
}
function renderDataProducts() {
if (!allHistory.length) return;
const entries = Object.values(allHistory);
  // 1. Сортуємо масив по product
  const sorted = entries.slice().sort((a, b) => a.product.localeCompare(b.product, 'uk'));
  const totals = [];
  let currentName = sorted[0].product;
  let sumQty = 0;

  // 2. Проходимо по відсортованому масиву
  for (const comp of sorted) {
    if (comp.product === currentName) {
      sumQty += comp.qty; // сумуємо кількість
    } else {
      // Додаємо попередній продукт у totals
      totals.push({ product: currentName, qty: sumQty });

      // Починаємо новий продукт
      currentName = comp.product;
      sumQty = comp.qty;
    }
  }
  // Додаємо останній продукт
  totals.push({ product: currentName, qty: sumQty });

  // 3. Генеруємо HTML
  fullInventoryTable.innerHTML = totals.map(item =>
    `<tr><td>${item.product}</td><td>${item.qty}</td></tr>`
  ).join('');

}


async function loadFullInventory() {
  try {
    const res = await fetch('http://localhost:3000/inventory'); // беремо поточний інвентар
    const data = await res.json(); 

    const tbody = document.getElementById('fullInventoryTable').querySelector('tbody');
    tbody.innerHTML = '';

    for (const [name, qty] of Object.entries(data)) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${name}</td><td>${qty}</td>`;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error('Помилка завантаження складу продукції:', err);
  }
}

// Викликаємо на старті
calculateMax();


init();