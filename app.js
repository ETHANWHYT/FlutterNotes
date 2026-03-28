const state = {
  user: null,
  adminToken: null,
  notes: [],
  subjects: ['All subjects', 'UI/UX', 'Computer Networks', 'Data Structures', 'Database', 'Math', 'Physics', 'Operating Systems']
};

const elements = {
  notesGrid: document.getElementById('notesGrid'),
  subjectFilter: document.getElementById('subjectFilter'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  loginBtn: document.getElementById('loginBtn'),
  signupBtn: document.getElementById('signupBtn'),
  openUpload: document.getElementById('openUpload'),
  loginModal: document.getElementById('loginModal'),
  signupModal: document.getElementById('signupModal'),
  uploadModal: document.getElementById('uploadModal'),
  closeButtons: document.querySelectorAll('.close-btn'),
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  uploadForm: document.getElementById('uploadForm'),
  userStatus: document.getElementById('userStatus'),
  userName: document.getElementById('userName'),
  logoutBtn: document.getElementById('logoutBtn'),
  adminPanel: document.getElementById('adminPanel'),
  adminPendingNotes: document.getElementById('adminPendingNotes'),
  adminUsersList: document.getElementById('adminUsersList'),
  statusBar: document.getElementById('statusBar')
};

function showStatus(message) {
  elements.statusBar.textContent = message;
  elements.statusBar.classList.add('visible');
  window.setTimeout(() => elements.statusBar.classList.remove('visible'), 2500);
}

function setAdminToken(token) {
  state.adminToken = token;
  if (token) {
    localStorage.setItem('campusnotes-admin-token', token);
  } else {
    localStorage.removeItem('campusnotes-admin-token');
  }
}

function setUser(user, token = null) {
  state.user = user;
  if (user) {
    localStorage.setItem('campusnotes-user', JSON.stringify(user));
    document.body.classList.add('logged-in');
    elements.userName.textContent = user.name;
    elements.userStatus.classList.remove('hidden');
    elements.loginBtn.classList.add('hidden');
    elements.signupBtn.classList.add('hidden');
    if (user.isAdmin) {
      setAdminToken(token);
      elements.adminPanel?.classList.remove('hidden');
      fetchAdminData();
    }
  } else {
    setAdminToken(null);
    state.user = null;
    localStorage.removeItem('campusnotes-user');
    document.body.classList.remove('logged-in');
    elements.userStatus.classList.add('hidden');
    elements.loginBtn.classList.remove('hidden');
    elements.signupBtn.classList.remove('hidden');
    elements.adminPanel?.classList.add('hidden');
  }
}

async function fetchNotes() {
  try {
    const response = await fetch('/api/notes');
    state.notes = await response.json();
    renderNotes();
  } catch (error) {
    showStatus('Failed to load notes.');
  }
}

function getAdminHeaders() {
  const headers = {};
  if (state.adminToken) {
    headers['x-admin-token'] = state.adminToken;
  }
  return headers;
}

function renderAdminNotes(notes) {
  if (!elements.adminPendingNotes) return;
  const pending = notes.filter(note => note.status === 'pending');
  elements.adminPendingNotes.innerHTML = pending.length ? pending.map(note => `
    <article class="note-card">
      <div>
        <p class="note-meta">${new Date(note.createdAt).toLocaleDateString()} · ${note.author}</p>
        <h3 class="note-title">${note.title}</h3>
        <p class="note-copy">${note.description || 'No description provided.'}</p>
        <p><strong>Subject:</strong> ${note.subject}</p>
      </div>
      <div class="review-actions">
        <button class="primary" onclick="handleDecision('${note.id}', 'approve')">Approve</button>
        <button class="secondary" onclick="handleDecision('${note.id}', 'reject')">Reject</button>
      </div>
    </article>
  `).join('') : '<p style="color: var(--muted);">No pending uploads right now.</p>';
}

function renderAdminUsers(users) {
  if (!elements.adminUsersList) return;
  elements.adminUsersList.innerHTML = users.length ? users.map(user => `
    <article class="note-card">
      <div>
        <p class="note-meta">ID: ${user.id}</p>
        <h3 class="note-title">${user.name}</h3>
        <p class="note-copy">${user.email}</p>
        <p><strong>Password hash:</strong> ${user.password}</p>
      </div>
    </article>
  `).join('') : '<p style="color: var(--muted);">No student accounts found.</p>';
}

async function fetchAdminData() {
  if (!state.user?.isAdmin) return;

  try {
    const [notesResponse, usersResponse] = await Promise.all([
      fetch('/api/admin/notes', { headers: getAdminHeaders() }),
      fetch('/api/admin/users', { headers: getAdminHeaders() })
    ]);

    if (!notesResponse.ok || !usersResponse.ok) {
      showStatus('Failed to load admin data.');
      return;
    }

    const [notes, users] = await Promise.all([notesResponse.json(), usersResponse.json()]);
    renderAdminNotes(notes);
    renderAdminUsers(users);
  } catch (error) {
    showStatus('Admin panel failed to load.');
  }
}

function renderNotes() {
  const searchValue = elements.searchInput.value.trim().toLowerCase();
  const selectedSubject = elements.subjectFilter.value;

  const filtered = state.notes.filter(note => {
    const matchesSubject = selectedSubject === 'All subjects' || note.subject === selectedSubject;
    const title = note.title.toLowerCase();
    const description = note.description.toLowerCase();
    const author = note.author.toLowerCase();
    const matchesSearch = !searchValue || title.includes(searchValue) || description.includes(searchValue) || author.includes(searchValue) || note.subject.toLowerCase().includes(searchValue);
    return matchesSubject && matchesSearch;
  });

  if (!elements.notesGrid) return;
  elements.notesGrid.innerHTML = filtered.length ? filtered.map(note => `
    <article class="note-card">
      <div>
        <p class="note-meta">${new Date(note.createdAt).toLocaleDateString()} · ${note.author}</p>
        <h3 class="note-title">${note.title}</h3>
        <p class="note-copy">${note.description || 'Short notes prepared by college students.'}</p>
      </div>
      <div>
        <span class="note-tag">${note.subject}</span>
      </div>
      <div class="note-actions">
        <a href="/api/notes/${note.id}/download" target="_blank">Download</a>
        <button type="button" onclick="handleShare('${note.title}', '${note.subject}')">Share</button>
      </div>
    </article>
  `).join('') : '<p style="color: var(--muted);">No notes found. Try another subject or upload your own.</p>';
}

function handleShare(title, subject) {
  navigator.clipboard.writeText(`Check out ${title} notes for ${subject} on CampusNotes.`).then(() => {
    showStatus('Share message copied to clipboard.');
  }).catch(() => {
    showStatus('Copy failed.');
  });
}

function toggleModal(modal, visible) {
  if (!modal) return;
  modal.classList.toggle('hidden', !visible);
}

async function loginUser(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = {
    email: form.get('email'),
    password: form.get('password')
  };

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (response.ok) {
    setUser(result.user, result.token || null);
    toggleModal(elements.loginModal, false);
    showStatus('Welcome back, ' + result.user.name + '!');
  } else {
    showStatus(result.error || 'Login failed.');
  }
}

async function signupUser(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = {
    name: form.get('name'),
    email: form.get('email'),
    password: form.get('password')
  };

  const response = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (response.ok) {
    setUser(result.user);
    toggleModal(elements.signupModal, false);
    showStatus('Signup complete. Welcome, ' + result.user.name + '!');
  } else {
    showStatus(result.error || 'Signup failed.');
  }
}

async function uploadNote(event) {
  event.preventDefault();
  if (!state.user) {
    showStatus('Login required to upload notes.');
    return;
  }

  const form = new FormData(event.target);
  form.set('author', state.user.name);

  const response = await fetch('/api/notes', {
    method: 'POST',
    body: form
  });

  const result = await response.json();
  if (response.ok) {
    await fetchNotes();
    toggleModal(elements.uploadModal, false);
    elements.uploadForm.reset();
    showStatus('Note uploaded successfully and sent to admin approval.');
  } else {
    showStatus(result.error || 'Upload failed.');
  }
}

function logoutUser() {
  setUser(null);
  showStatus('You are logged out.');
}

function initSubjectFilter() {
  if (!elements.subjectFilter) return;
  elements.subjectFilter.innerHTML = state.subjects.map(subject => `<option>${subject}</option>`).join('');
  elements.subjectFilter.addEventListener('change', renderNotes);
}

function restoreSession() {
  const saved = localStorage.getItem('campusnotes-user');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user.isAdmin) {
        const token = localStorage.getItem('campusnotes-admin-token');
        setUser(user, token);
      } else {
        setUser(user);
      }
    } catch (error) {
      setUser(null);
    }
  }
}

function attachEvents() {
  if (elements.searchBtn) elements.searchBtn.addEventListener('click', renderNotes);
  if (elements.searchInput) elements.searchInput.addEventListener('input', renderNotes);
  if (elements.loginBtn) elements.loginBtn.addEventListener('click', () => toggleModal(elements.loginModal, true));
  if (elements.signupBtn) elements.signupBtn.addEventListener('click', () => toggleModal(elements.signupModal, true));
  if (elements.openUpload) elements.openUpload.addEventListener('click', () => toggleModal(elements.uploadModal, true));
  elements.closeButtons.forEach(button => button.addEventListener('click', () => {
    toggleModal(button.closest('.modal'), false);
  }));
  if (elements.loginForm) elements.loginForm.addEventListener('submit', loginUser);
  if (elements.signupForm) elements.signupForm.addEventListener('submit', signupUser);
  if (elements.uploadForm) elements.uploadForm.addEventListener('submit', uploadNote);
  if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', logoutUser);
}

window.addEventListener('DOMContentLoaded', () => {
  initSubjectFilter();
  restoreSession();
  attachEvents();
  fetchNotes();
});
