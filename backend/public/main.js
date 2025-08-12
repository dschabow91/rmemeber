const state = {
  user: null,
  entries: [],
  filterDate: ''
};

async function init() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (res.ok) {
    state.user = (await res.json()).user;
    renderDashboard();
  } else {
    renderLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'card space-y-4 max-w-sm mx-auto mt-10';
  form.innerHTML = `
    <input id="email" type="email" placeholder="Email" class="border p-2 w-full" required />
    <input id="password" type="password" placeholder="Password" class="border p-2 w-full" required />
    <button class="btn btn-primary w-full">Login</button>
  `;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      state.user = (await res.json()).user;
      renderDashboard();
    }
  });
  app.appendChild(form);
}

function renderDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'space-y-6';

  const top = document.createElement('div');
  top.className = 'card flex justify-between items-center';
  top.innerHTML = `
    <h2 class="text-lg font-semibold">Welcome ${state.user.name}</h2>
    <div class="space-x-2">
      <button id="pwBtn" class="link">Change Password</button>
      <button id="logoutBtn" class="link text-red-600">Logout</button>
    </div>
  `;
  container.appendChild(top);

  const pwForm = createPasswordForm();
  pwForm.classList.add('hidden');
  container.appendChild(pwForm);

  const entryForm = createEntryForm();
  container.appendChild(entryForm);

  const listSection = createEntriesSection();
  container.appendChild(listSection);

  app.appendChild(container);

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    state.user = null;
    renderLogin();
  });

  document.getElementById('pwBtn').addEventListener('click', () => {
    pwForm.classList.toggle('hidden');
  });

  loadEntries();
}

function createPasswordForm() {
  const form = document.createElement('form');
  form.className = 'card space-y-2 max-w-sm';
  form.innerHTML = `
    <input type="password" id="oldPw" placeholder="Old password" class="border p-2 w-full" required />
    <input type="password" id="newPw" placeholder="New password" class="border p-2 w-full" required />
    <button class="btn btn-primary">Update</button>
  `;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const oldPassword = form.querySelector('#oldPw').value;
    const newPassword = form.querySelector('#newPw').value;
    await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ oldPassword, newPassword })
    });
    form.reset();
    form.classList.add('hidden');
  });
  return form;
}

function createEntryForm() {
  const form = document.createElement('form');
  form.className = 'card space-y-3';
  form.innerHTML = `
    <h3 class="text-lg font-semibold">New Entry</h3>
    <div class="flex flex-wrap gap-2">
      <label>Date <input type="date" id="entryDate" required class="border p-1"></label>
      <label>Shift
        <select id="entryShift" class="border p-1" required>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </label>
      <label>Line
        <select id="entryLine" class="border p-1" required>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </label>
    </div>
    <textarea id="tasks" placeholder="Completed tasks" class="border w-full p-1"></textarea>
    <textarea id="issues" placeholder="Issues" class="border w-full p-1"></textarea>
    <textarea id="next" placeholder="Next actions" class="border w-full p-1"></textarea>
    <input type="file" id="files" multiple />
    <button class="btn btn-secondary">Save</button>
  `;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    let attachments = [];
    const files = form.querySelector('#files').files;
    if (files.length) {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
      if (up.ok) attachments = (await up.json()).files;
    }
    const payload = {
      date: form.querySelector('#entryDate').value,
      shift: form.querySelector('#entryShift').value,
      line: form.querySelector('#entryLine').value,
      completedTasks: form.querySelector('#tasks').value,
      issues: form.querySelector('#issues').value,
      nextActions: form.querySelector('#next').value,
      attachments
    };
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    form.reset();
    loadEntries();
  });
  return form;
}

function createEntriesSection() {
  const section = document.createElement('div');
  section.className = 'card';
  section.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-lg font-semibold">Entries</h3>
      <input type="date" id="filterDate" class="border p-1" />
    </div>
    <div id="entriesList"></div>
  `;
  section.querySelector('#filterDate').addEventListener('change', e => {
    state.filterDate = e.target.value;
    loadEntries();
  });
  return section;
}

async function loadEntries() {
  const params = new URLSearchParams();
  if (state.filterDate) params.append('date', state.filterDate);
  const res = await fetch('/api/entries?' + params.toString(), { credentials: 'include' });
  if (res.ok) state.entries = await res.json();
  const list = document.getElementById('entriesList');
  if (!list) return;
  list.innerHTML = '';
  state.entries.forEach(e => {
    const item = document.createElement('div');
    item.className = 'border p-2 my-2 rounded bg-white';
    item.innerHTML = `
      <div class="flex justify-between">
        <div><b>${e.date}</b> - ${e.shift} - Line ${e.line}</div>
        <a href="/api/entries/export?date=${e.date}&line=${e.line}" class="link">Export</a>
      </div>
      <div class="mt-1">${e.completedTasks}</div>
      <div class="mt-1">${e.issues}</div>
      <div class="mt-1">${e.nextActions}</div>
    `;
    list.appendChild(item);
  });
}
