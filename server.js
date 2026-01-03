const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const express = require('express')

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ==== Сесії для логіну ====
app.use(session({
  secret: 'terrex_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 година
}));

// ==== Статичні файли ====
app.use(express.static(path.join(__dirname, '')));

// ==== MongoDB ====
const uri = 'mongodb+srv://bjiad7778888_db_user:AanyYeZnz4CvOgSx@cluster1.d3ce91h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';
const client = new MongoClient(uri);
let db;

async function start() {
  await client.connect();
  db = client.db('productionDB');
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on port ${PORT}`));
}
start();

// ==== Мідлвар для перевірки логіну ====
function checkAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login.html');
}

// ==== Маршрути HTML ====
app.get('/', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'terrex', 'index.html'));
});

app.get('/finance.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'terrex', 'finance.html'));
});

// ==== Логін ====
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '1234') {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.send('Невірний логін або пароль. <a href="/login.html">Спробувати ще раз</a>');
  }
});

// ==== Вихід ====
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// ==== INVENTORY API ====
app.post('/inventory', async (req, res) => {
  const data = req.body;
  const collection = db.collection('inventory');
  await collection.deleteMany({});
  const docs = Object.entries(data).map(([name, qty]) => ({ name, qty }));
  await collection.insertMany(docs);
  res.send({ success: true });
});

app.get('/inventory', async (req, res) => {
  const collection = db.collection('inventory');
  const items = await collection.find({}).toArray();
  res.send(items);
});

app.patch('/inventory/:name', async (req, res) => {
  const name = req.params.name;
  const { qty } = req.body;
  const collection = db.collection('inventory');
  try {
    const result = await collection.updateOne({ name }, { $set: { qty } });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Компонент не знайдено' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// ==== RECIPES API ====
app.get('/recipes', async (req, res) => {
  const recipes = {
    'Комплект 4шт': { 'Викрутка': 1, 'Саморіз': 4, 'Упаковка': 1 },
    'Комплект 2шт': { 'Викрутка': 1, 'Саморіз': 2, 'Упаковка': 1 }
  };
  res.send(recipes);
});

// ==== HISTORY API ====
app.post('/history', async (req, res) => {
  const data = req.body;
  const collection = db.collection('history');
  await collection.insertOne(data);
  res.send({ success: true });
});

app.get('/history', async (req, res) => {
  const collection = db.collection('history');
  const items = await collection.find({}).toArray();
  res.send(items);
});

app.delete('/history/:id', async (req, res) => {
  const id = req.params.id;
  const collection = db.collection('history');
  await collection.deleteOne({ _id: new ObjectId(id) });
  res.send({ success: true });
});

// ==== ALL HISTORY API ====
app.post('/allHistory', async (req, res) => {
  const data = req.body;
  const collection = db.collection('allHistory');
  await collection.insertOne(data);
  res.json({ success: true });
});

app.patch('/allHistory/:id', async (req, res) => {
  const id = req.params.id;
  const { qty } = req.body;
  const collection = db.collection('allHistory');
  try {
    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { qty } });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Компонент не знайдено' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.get('/allHistory', async (req, res) => {
  const collection = db.collection('allHistory');
  const items = await collection.find({}).toArray();
  res.json(items);
});

app.delete('/allHistory', async (req, res) => {
  const collection = db.collection('allHistory');
  await collection.deleteMany({});
  res.json({ success: true });
});

app.delete('/allHistory/:id', async (req, res) => {
  const id = req.params.id;
  const collection = db.collection('allHistory');
  await collection.deleteOne({ _id: new ObjectId(id) });
  res.json({ success: true });
});

app.put('/allHistory', async (req, res) => {
  const { name, qty } = req.body;
  const collection = db.collection('allHistory');
  try {
    let remaining = qty;
    const items = await collection.find({ product: name, qty: { $gt: 0 } }).sort({ date: 1 }).toArray();
    for (const item of items) {
      if (remaining <= 0) break;
      const deduct = Math.min(item.qty, remaining);
      await collection.updateOne({ _id: item._id }, { $inc: { qty: -deduct } });
      remaining -= deduct;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка списання продукції' });
  }
});

// ==== FINANCE API ====
app.get('/finance', async (req, res) => {
  const collection = db.collection('finance');
  const data = await collection.find().sort({ date: -1 }).toArray();
  res.json(data);
});

app.post('/finance', async (req, res) => {
  const collection = db.collection('finance');
  try {
    const { type, amount, description, date } = req.body;
    if (!type || !amount || !description || !date) return res.status(400).json({ error: 'Всі поля обовʼязкові' });
    const record = { type, amount, description, date };
    const result = await collection.insertOne(record);
    res.json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.delete('/finance/:id', async (req, res) => {
  const collection = db.collection('finance');
  const id = req.params.id;
  await collection.deleteOne({ _id: new ObjectId(id) });
  res.json({ success: true });
});

// ==== FULL INVENTORY API ====
app.get('/api/fullInventory', async (req, res) => {
  try {
    const collection = db.collection('inventory');
    const products = await collection.find({}).toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});