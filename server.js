const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
}

if (!fs.existsSync(NOTES_FILE)) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2), 'utf8');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT_DIR));

function readData(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw ? JSON.parse(raw) : [];
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeText(value) {
  return String(value || '').trim();
}

app.get('/api/notes', (req, res) => {
  const notes = readData(NOTES_FILE).sort((a, b) => b.createdAt - a.createdAt);
  res.json(notes);
});

app.post('/api/signup', (req, res) => {
  const name = normalizeText(req.body.name);
  const email = normalizeText(req.body.email).toLowerCase();
  const password = normalizeText(req.body.password);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email and password.' });
  }

  const users = readData(USERS_FILE);
  if (users.some(user => user.email === email)) {
    return res.status(409).json({ error: 'Email already exists. Please login.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password: hashedPassword,
    createdAt: Date.now()
  };

  users.push(user);
  writeData(USERS_FILE, users);

  res.json({ message: 'Signup successful', user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/login', (req, res) => {
  const email = normalizeText(req.body.email).toLowerCase();
  const password = normalizeText(req.body.password);

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  const users = readData(USERS_FILE);
  const user = users.find(item => item.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials. Try again.' });
  }

  res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/notes', upload.single('file'), (req, res) => {
  const title = normalizeText(req.body.title);
  const subject = normalizeText(req.body.subject);
  const description = normalizeText(req.body.description);
  const author = normalizeText(req.body.author);

  if (!title || !subject || !author || !req.file) {
    return res.status(400).json({ error: 'Title, subject, author and file are required.' });
  }

  const notes = readData(NOTES_FILE);
  const note = {
    id: Date.now().toString(),
    title,
    subject,
    description,
    author,
    filename: req.file.filename,
    originalName: req.file.originalname,
    createdAt: Date.now()
  };

  notes.push(note);
  writeData(NOTES_FILE, notes);

  res.json({ message: 'Note uploaded successfully.', note });
});

app.get('/api/notes/:id/download', (req, res) => {
  const notes = readData(NOTES_FILE);
  const note = notes.find(item => item.id === req.params.id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }

  const filePath = path.join(UPLOAD_DIR, note.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Uploaded file not found.' });
  }

  res.download(filePath, note.originalName);
});

app.listen(PORT, () => {
  console.log(`CampusNotes server started on http://localhost:${PORT}`);
});
