function app() {
  return {
    user: null,
    email: '',
    password: '',
    oldPassword: '',
    newPassword: '',
    view: 'new',
    entries: [],
    filterDate: '',
    entry: { date: '', shift: 'AM', line: '1', completedTasks: '', issues: '', nextActions: '' },
    async init() {
      const res = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null)
      if (res && res.user) { this.user = res.user; this.view = 'new'; this.loadEntries() }
    },
    async login() {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: this.email, password: this.password })
      })
      if (res.ok) { this.user = (await res.json()).user; this.view = 'new'; this.loadEntries() }
    },
    async logout() {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      this.user = null
      this.view = 'new'
    },
    async changePassword() {
      await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword: this.oldPassword, newPassword: this.newPassword })
      })
      this.oldPassword = this.newPassword = ''
    },
    async createEntry() {
      const files = this.$refs.files.files
      let attachments = []
      if (files.length) {
        const fd = new FormData()
        for (const f of files) fd.append('files', f)
        const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
        if (up.ok) attachments = (await up.json()).files
      }
      const payload = { ...this.entry, attachments }
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      this.entry = { date: '', shift: 'AM', line: '1', completedTasks: '', issues: '', nextActions: '' }
      this.$refs.files.value = null
      this.loadEntries()
    },
    async loadEntries() {
      const params = new URLSearchParams()
      if (this.filterDate) params.append('date', this.filterDate)
      const res = await fetch('/api/entries?' + params.toString(), { credentials: 'include' })
      if (res.ok) this.entries = await res.json()
    },
    setView(v) {
      this.view = v
      if (v === 'list') this.loadEntries()
    }
  }
}
