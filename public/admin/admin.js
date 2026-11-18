// public/admin/admin.js

(function initAdminTheme(){
  const saved = localStorage.getItem('boatek-admin-theme');
  let theme;
  if (saved) {
    theme = saved;
  } else {
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = systemPrefersDark ? 'dark' : 'light';
  }
  if (theme === 'dark') document.documentElement.setAttribute('data-admin-theme', 'dark');
  document.addEventListener('DOMContentLoaded', () => { updateThemeButton(theme); initAdminGoogleSignIn(); });
})();
function toggleAdminTheme(){
  const isDark = document.documentElement.getAttribute('data-admin-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  if (next === 'dark') document.documentElement.setAttribute('data-admin-theme', 'dark');
  else document.documentElement.removeAttribute('data-admin-theme');
  localStorage.setItem('boatek-admin-theme', next);
  updateThemeButton(next);
}
function updateThemeButton(theme){
  const btn = document.getElementById('adminThemeToggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i> Light' : '<i class="fas fa-moon"></i> Dark';
}

let currentAdmin = null;
async function initAdminGoogleSignIn(){const box=document.getElementById('googleSignInButton'),help=document.getElementById('googleAuthHelp');try{const cfg=await fetch('/api/admin/auth-config').then(r=>r.json());if(!cfg.googleClientId){if(help)help.textContent='Google sign-in is not configured yet.';return;}const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.onload=()=>{if(!window.google?.accounts?.id)return;google.accounts.id.initialize({client_id:cfg.googleClientId,callback:handleGoogleCredential});google.accounts.id.renderButton(box,{theme:'outline',size:'large',shape:'rectangular',width:280,text:'continue_with'});};document.head.appendChild(script);}catch{if(help)help.textContent='Google sign-in is temporarily unavailable.';}}
async function handleGoogleCredential(response){const e=document.getElementById('loginError');try{const r=await fetch('/api/admin/google-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential})});const d=await r.json();if(!r.ok)throw Error(d.error||'Google sign-in failed.');currentAdmin=d.admin;showDashboard();}catch(x){e.textContent=x.message;e.style.display='block';}}
async function handleOwnerSetup(e){e.preventDefault();const box=document.getElementById('loginError');try{const body={name:setupName.value,email:setupEmail.value,password:setupPassword.value,setupKey:setupKey.value};const r=await fetch('/api/admin/setup-owner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Setup failed.');currentAdmin=d.admin;showDashboard();}catch(x){box.textContent=x.message;box.style.display='block';}return false;}


async function checkAdminSession(){
  try {
    const res = await fetch('/api/admin/session');
    const data = await res.json();
    if (data.authenticated) {
      currentAdmin = data.admin;
      showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}
function showLogin(){
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboardShell').classList.remove('visible');
}
function showDashboard(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboardShell').classList.add('visible');
  applyRole();
  loadOverview();
}
function hasPermission(key){
  if (!currentAdmin) return false;
  if (currentAdmin.role === 'super') return true;
  return (currentAdmin.permissions || []).includes(key);
}
function applyRole(){
  if (!currentAdmin) return;
  const isSuper = currentAdmin.role === 'super';
  document.body.classList.toggle('role-owner', isSuper); // 'role-owner' CSS class name kept for the super-only Team Accounts nav item
  document.getElementById('viewerBanner').classList.toggle('visible', !isSuper);
  if (!isSuper) {
    const granted = (currentAdmin.permissions || []);
    document.getElementById('viewerBannerText').textContent = granted.length
      ? `You're signed in as an editor with access to: ${granted.join(', ')}.`
      : "You're signed in as an editor. Your account doesn't have edit access to any section yet — ask a super admin to assign some.";
  }
  document.getElementById('whoAmI').textContent = currentAdmin.name + ' (' + currentAdmin.email + ') \u00b7 ' + currentAdmin.role;
  // Grey out/disable every top-level "needs-perm" control the current admin doesn't have access to.
  document.querySelectorAll('.needs-perm').forEach(el => {
    const perm = el.dataset.perm;
    el.disabled = !hasPermission(perm);
    el.style.opacity = hasPermission(perm) ? '1' : '0.45';
  });
}

async function handleAdminLogin(e){
  e.preventDefault();
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  const errorBox = document.getElementById('loginError');
  errorBox.style.display = 'none';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');
    currentAdmin = data.admin;
    showDashboard();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
  return false;
}
async function handleAdminLogout(){
  await fetch('/api/admin/logout', { method: 'POST' });
  currentAdmin = null;
  showLogin();
}

const DATA_PANELS = ['project-inquiries', 'career-applications', 'collaboration-requests', 'general-inquiries', 'subscribers', 'messages'];

function showAdminPanel(name, el){
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');

  if (name === 'overview') loadOverview();
  if (name === 'analytics') loadAnalytics();
  if (name === 'config') loadConfig();
  if (name === 'team') loadTeam();
  if (name === 'projects') loadProjects();
  if (name === 'journal') loadJournal();
  if (name === 'newsletter') loadNewsletterPanel();
  if (name === 'admins') loadAdmins();
  if (DATA_PANELS.includes(name)) loadDataTable(name);
}

async function loadOverview(){
  const box = document.getElementById('overviewStats');
  box.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const res = await fetch('/api/admin/overview');
    const d = await res.json();
    box.innerHTML = `
      <div class="stat-card"><div class="label">Hosting Environment</div><div class="value">${escapeHtml(d.hostingEnvironment)}</div></div>
      <div class="stat-card"><div class="label">NODE_ENV</div><div class="value">${escapeHtml(d.nodeEnv)}</div></div>
      <div class="stat-card"><div class="label">Node Version</div><div class="value">${escapeHtml(d.nodeVersion)}</div></div>
      <div class="stat-card"><div class="label">Platform</div><div class="value">${escapeHtml(d.platform)} / ${escapeHtml(d.arch)}</div></div>
      <div class="stat-card"><div class="label">Uptime</div><div class="value">${formatUptime(d.uptimeSeconds)}</div></div>
      <div class="stat-card"><div class="label">Memory (RSS)</div><div class="value">${d.memoryUsageMb} MB</div></div>
      <div class="stat-card"><div class="label">SMTP Configured</div><div class="value ${d.smtpConfigured ? 'ok' : 'warn'}">${d.smtpConfigured ? 'Yes' : 'No — logging to console'}</div></div>
      <div class="stat-card"><div class="label">Port</div><div class="value">${d.port}</div></div>
    `;
  } catch {
    box.innerHTML = '<div class="empty-state">Could not load environment data.</div>';
  }
}
function formatUptime(seconds){
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

async function loadAnalytics(){
  const box = document.getElementById('analyticsContent');
  box.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const res = await fetch('/api/admin/analytics');
    const d = await res.json();

    const colors = { 'project-inquiries': '#3B82F6', 'career-applications': '#8B5CF6', 'collaboration-requests': '#22D3EE', 'general-inquiries': '#F97316' };
    const labels = { 'project-inquiries': 'Project Inquiries', 'career-applications': 'Career Applications', 'collaboration-requests': 'Collaboration Requests', 'general-inquiries': 'General Inquiries' };

    let maxVal = 1;
    Object.values(d.submissionsPerWeek).forEach(arr => arr.forEach(v => { if (v > maxVal) maxVal = v; }));

    const bars = d.weekLabels.map((label, wi) => {
      const barsForWeek = Object.keys(d.submissionsPerWeek).map(type => {
        const val = d.submissionsPerWeek[type][wi];
        const heightPct = Math.max((val / maxVal) * 100, val > 0 ? 6 : 0);
        return `<div class="bar-chart-bar" style="height:${heightPct}%; background:${colors[type]};" title="${labels[type]}: ${val}"></div>`;
      }).join('');
      return `<div class="bar-chart-group"><div class="bar-chart-bars">${barsForWeek}</div><div class="bar-chart-label">${label.slice(5)}</div></div>`;
    }).join('');

    const legend = Object.keys(colors).map(type =>
      `<span><span class="legend-dot" style="background:${colors[type]}"></span>${labels[type]}</span>`
    ).join('');

    const typeEntries = Object.entries(d.projectTypeBreakdown);
    const maxType = Math.max(1, ...typeEntries.map(([, c]) => c));
    const typeBars = typeEntries.length ? typeEntries.map(([type, count]) => `
      <div class="breakdown-bar-row">
        <div class="breakdown-bar-label">${escapeHtml(type)}</div>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:${(count / maxType) * 100}%"></div></div>
        <div class="breakdown-bar-count">${count}</div>
      </div>`).join('') : '<div class="empty-state">No project inquiries yet.</div>';

    const topPathsHtml = d.pageviews.topPaths.length ? d.pageviews.topPaths.map(p => `
      <div class="breakdown-bar-row">
        <div class="breakdown-bar-label" style="width:200px;">${escapeHtml(p.path)}</div>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:${(p.count / d.pageviews.topPaths[0].count) * 100}%; background:var(--cyan);"></div></div>
        <div class="breakdown-bar-count">${p.count}</div>
      </div>`).join('') : '<div class="empty-state">No pageviews recorded yet.</div>';

    box.innerHTML = `
      <div class="chart-card">
        <h4>Submissions per week (last 8 weeks)</h4>
        <div class="bar-chart">${bars}</div>
        <div class="chart-legend">${legend}</div>
      </div>
      <div class="chart-card">
        <h4>Project Type Breakdown</h4>
        ${typeBars}
      </div>
      <div class="chart-card">
        <h4>Pageviews (last 30 days) — ${d.pageviews.totalLast30Days} total, ${d.pageviews.uniqueVisitorsLast30Days} unique visitors</h4>
        ${topPathsHtml}
      </div>
    `;
  } catch {
    box.innerHTML = '<div class="empty-state">Could not load analytics.</div>';
  }
}

async function loadConfig(){
  try {
    const res = await fetch('/api/admin/config');
    const c = await res.json();
    document.getElementById('cfg-statusMessage').value = c.statusMessage || '';
    document.getElementById('cfg-contactEmail').value = c.contactEmail || '';
    document.getElementById('cfg-supportEmail').value = c.supportEmail || '';
    document.getElementById('cfg-location').value = c.location || '';
    document.getElementById('cfg-linkedin').value = (c.social && c.social.linkedin) || '';
    document.getElementById('cfg-x').value = (c.social && c.social.x) || '';
    document.getElementById('cfg-github').value = (c.social && c.social.github) || '';
  } catch {
    console.warn('Could not load site config.');
  }
}
async function saveConfig(e){
  e.preventDefault();
  const payload = {
    statusMessage: document.getElementById('cfg-statusMessage').value,
    contactEmail: document.getElementById('cfg-contactEmail').value,
    supportEmail: document.getElementById('cfg-supportEmail').value,
    location: document.getElementById('cfg-location').value,
    social: {
      linkedin: document.getElementById('cfg-linkedin').value,
      x: document.getElementById('cfg-x').value,
      github: document.getElementById('cfg-github').value
    }
  };
  try {
    const res = await fetch('/api/admin/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed.'); }
    flashSaved('configSaveMsg');
  } catch (err) { alert(err.message); }
  return false;
}
function flashSaved(id){
  const msg = document.getElementById(id);
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

let teamDraft = [];
async function loadTeam(){
  try {
    const res = await fetch('/api/admin/team');
    teamDraft = await res.json();
    renderTeamEditor();
  } catch { console.warn('Could not load team data.'); }
}
function renderTeamEditor(){
  const box = document.getElementById('teamEditorList');
  box.innerHTML = teamDraft.map((m, i) => `
    <div class="team-member-card">
      <div class="field-group">
        <input placeholder="Name" value="${escapeAttr(m.name)}" oninput="teamDraft[${i}].name=this.value">
        <input placeholder="Role" value="${escapeAttr(m.role)}" oninput="teamDraft[${i}].role=this.value">
        <input placeholder="Tags (comma separated)" value="${escapeAttr((m.tags||[]).join(', '))}" oninput="teamDraft[${i}].tags=this.value.split(',').map(t=>t.trim()).filter(Boolean)">
        <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--muted);">
          <input type="checkbox" style="width:auto;" ${m.hiring ? 'checked' : ''} onchange="teamDraft[${i}].hiring=this.checked">
          Show as "Hiring" card
        </label>
      </div>
      <button class="remove-member owner-only" onclick="removeTeamMember(${i})"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}
function addTeamMember(){
  teamDraft.push({ id: 'member-' + Date.now(), name: '', role: '', tags: [], featured: true, hiring: false });
  renderTeamEditor();
}
function removeTeamMember(i){ teamDraft.splice(i, 1); renderTeamEditor(); }
async function saveTeam(){
  try {
    const res = await fetch('/api/admin/team', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(teamDraft)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    flashSaved('teamSaveMsg');
  } catch (err) { alert(err.message); }
}

const PANEL_COLUMNS = {
  'project-inquiries': ['receivedAt', 'name', 'email', 'projectType', 'brief', 'budget', 'timeline'],
  'career-applications': ['receivedAt', 'name', 'email', 'roleInterest', 'portfolioUrl', 'message'],
  'collaboration-requests': ['receivedAt', 'organization', 'contactName', 'email', 'partnershipType', 'message'],
  'general-inquiries': ['receivedAt', 'name', 'email', 'message'],
  subscribers: ['subscribedAt', 'email'],
  messages: ['receivedAt', 'message']
};

let dataCache = {};
async function loadDataTable(type){
  const wrap = document.getElementById('table-' + type);
  wrap.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const res = await fetch('/api/admin/data/' + type);
    const rows = await res.json();
    dataCache[type] = rows;
    if (!rows.length) { wrap.innerHTML = '<div class="empty-state">No entries yet.</div>'; return; }

    const cols = PANEL_COLUMNS[type];
    const showStatus = type === 'career-applications';
    wrap.innerHTML = `
      <div class="data-table-wrap">
        <table>
          <thead><tr>
            ${cols.map(c => `<th>${labelForColumn(c)}</th>`).join('')}
            <th>Replied</th><th>Note</th>${showStatus ? '<th>Status</th>' : ''}<th></th>
          </tr></thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                ${cols.map(c => `<td class="${c === 'message' || c === 'brief' ? 'cell-msg' : ''}">${formatCell(c, r[c])}</td>`).join('')}
                <td><input type="checkbox" class="replied-checkbox owner-only-input" ${r.replied ? 'checked' : ''} onchange="patchRow('${type}','${r.id}',{replied:this.checked}, this)"></td>
                <td><input type="text" class="note-input owner-only-input" value="${escapeAttr(r.note || '')}" placeholder="Add a note..." onblur="patchRow('${type}','${r.id}',{note:this.value}, this)"></td>
                ${showStatus ? `<td><select class="status-select owner-only-input" onchange="patchRow('${type}','${r.id}',{status:this.value}, this)">
                  ${['received','reviewing','interview','decided'].map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select></td>` : ''}
                <td><button class="delete-btn owner-only-input" onclick="deleteRow('${type}','${r.id}', this)"><i class="fas fa-trash"></i></button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    applyViewerReadOnly(wrap, 'submissions');
  } catch {
    wrap.innerHTML = '<div class="empty-state">Could not load data.</div>';
  }
}
function labelForColumn(c){
  const map = { receivedAt: 'Received', subscribedAt: 'Subscribed', name: 'Name', email: 'Email',
    projectType: 'Type', brief: 'Brief', budget: 'Budget', timeline: 'Timeline',
    roleInterest: 'Role', portfolioUrl: 'Portfolio', organization: 'Organization',
    contactName: 'Contact', partnershipType: 'Partnership', message: 'Message' };
  return map[c] || c;
}
function formatCell(col, value){
  if (!value) return '<span style="color:var(--muted)">—</span>';
  if (col === 'receivedAt' || col === 'subscribedAt') return new Date(value).toLocaleString();
  if (col === 'portfolioUrl') return `<a href="${escapeAttr(value)}" target="_blank" rel="noopener" style="color:var(--cyan)">${escapeHtml(value)}</a>`;
  return escapeHtml(String(value));
}
async function patchRow(type, id, patch, el){
  try {
    const res = await fetch(`/api/admin/data/${type}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error();
  } catch {
    alert('Could not save this change.');
  }
}
async function deleteRow(type, id, btn){
  if (!confirm('Delete this entry permanently?')) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/admin/data/${type}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    loadDataTable(type);
  } catch { alert('Could not delete this entry.'); btn.disabled = false; }
}
function exportCsv(type){
  window.open('/api/admin/export/' + type, '_blank');
}

function applyViewerReadOnly(scope, permKey){
  if (hasPermission(permKey)) return;
  (scope || document).querySelectorAll('.owner-only-input').forEach(el => el.disabled = true);
}

let projectsCache = [];
async function loadProjects(){
  const res = await fetch('/api/admin/projects');
  projectsCache = await res.json();
  renderProjectsList();
}
function renderProjectsList(){
  const box = document.getElementById('projectsList');
  box.innerHTML = projectsCache.map((p, i) => `
    <div class="cms-card">
      <div class="cms-row">
        <div><label>Title</label><input value="${escapeAttr(p.title)}" oninput="projectsCache[${i}].title=this.value" class="owner-only-input"></div>
        <div><label>Category</label>
          <select oninput="projectsCache[${i}].category=this.value" class="owner-only-input">
            <option value="software" ${p.category==='software'?'selected':''}>Software</option>
            <option value="games" ${p.category==='games'?'selected':''}>Games</option>
            <option value="experiences" ${p.category==='experiences'?'selected':''}>Experiences</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px;"><label>Description</label><textarea rows="2" oninput="projectsCache[${i}].description=this.value" class="owner-only-input">${escapeHtml(p.description)}</textarea></div>
      <div class="cms-row">
        <div><label>Tech Stack (comma separated)</label><input value="${escapeAttr((p.techStack||[]).join(', '))}" oninput="projectsCache[${i}].techStack=this.value.split(',').map(t=>t.trim()).filter(Boolean)" class="owner-only-input"></div>
        <div><label>External Link (optional)</label><input value="${escapeAttr(p.link||'')}" oninput="projectsCache[${i}].link=this.value" class="owner-only-input"></div>
      </div>
      <div class="cms-row">
        <div><label>GitHub Org/User (for live stats badge)</label><input value="${escapeAttr(p.githubOrg||'')}" oninput="projectsCache[${i}].githubOrg=this.value" class="owner-only-input"></div>
        <div>
          <label>Thumbnail (card cover image)</label>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="cms-thumb-preview" style="${p.thumbnailUrl ? `background-image:url('${escapeAttr(p.thumbnailUrl)}')` : 'background:var(--bg-alt)'}"></div>
            <input type="file" accept="image/*" onchange="uploadProjectThumbnail(${i}, this)" class="owner-only-input">
          </div>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <label>Gallery (shown on the project's detail page)</label>
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
          ${(p.images || []).map((img, gi) => `
            <div style="position:relative;">
              <div class="cms-thumb-preview" style="background-image:url('${escapeAttr(img)}'); width:70px; height:50px;"></div>
              <button class="owner-only-input" onclick="removeGalleryImage(${i},${gi})" style="position:absolute; top:-6px; right:-6px; background:var(--red); color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; line-height:1;">&times;</button>
            </div>
          `).join('')}
        </div>
        <input type="file" accept="image/*" onchange="uploadGalleryImage(${i}, this)" class="owner-only-input">
      </div>
      <div class="cms-checkbox-row"><input type="checkbox" ${p.featured?'checked':''} onchange="projectsCache[${i}].featured=this.checked" class="owner-only-input"> Featured on homepage</div>

      <div class="cms-checkbox-row"><input type="checkbox" ${p.clientPortal && p.clientPortal.enabled ?'checked':''} onchange="toggleClientPortal(${i}, this.checked)" class="owner-only-input"> Client portal enabled</div>
      ${p.clientPortal && p.clientPortal.enabled ? `
        <div style="margin-bottom:12px;"><label>Access Code</label><input value="${escapeAttr(p.clientPortal.accessCode||'')}" oninput="projectsCache[${i}].clientPortal.accessCode=this.value" class="owner-only-input"></div>
        <div class="portal-updates-list">
          <label>Updates</label>
          ${(p.clientPortal.updates||[]).map((u, ui) => `
            <div class="portal-update-item"><span>${new Date(u.date).toLocaleDateString()} — ${escapeHtml(u.text)}</span><button class="owner-only-input" onclick="removePortalUpdate(${i},${ui})">Remove</button></div>
          `).join('')}
          <div style="display:flex; gap:8px; margin-top:10px;">
            <input type="text" id="newUpdateText-${i}" placeholder="New update text..." style="flex:1;" class="owner-only-input">
            <button class="cms-btn-save owner-only-input" onclick="addPortalUpdate(${i})">Add</button>
          </div>
        </div>
      ` : ''}

      <div class="cms-card-actions">
        <button class="cms-btn-save owner-only-input" onclick="saveProjectRow(${i})">Save</button>
        <button class="cms-btn-delete owner-only-input" onclick="deleteProjectRow(${i})">Delete</button>
        ${p.id ? '' : '<span style="font-size:12px; color:var(--muted);">Not saved yet</span>'}
      </div>
    </div>
  `).join('');
  applyViewerReadOnly(box, 'projects');
}
function addProjectRow(){
  projectsCache.unshift({ title: '', category: 'software', description: '', techStack: [], featured: false, link: '', githubOrg: '', thumbnailUrl: '', thumbnailVariant: 'a', images: [], clientPortal: { enabled: false, accessCode: '', updates: [] } });
  renderProjectsList();
}
function toggleClientPortal(i, enabled){
  if (!projectsCache[i].clientPortal) projectsCache[i].clientPortal = { enabled: false, accessCode: '', updates: [] };
  projectsCache[i].clientPortal.enabled = enabled;
  renderProjectsList();
}
function addPortalUpdate(i){
  const input = document.getElementById('newUpdateText-' + i);
  if (!input.value.trim()) return;
  projectsCache[i].clientPortal.updates = projectsCache[i].clientPortal.updates || [];
  projectsCache[i].clientPortal.updates.push({ date: new Date().toISOString(), text: input.value.trim() });
  renderProjectsList();
}
function removePortalUpdate(i, ui){
  projectsCache[i].clientPortal.updates.splice(ui, 1);
  renderProjectsList();
}
async function uploadProjectThumbnail(i, input){
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    projectsCache[i].thumbnailUrl = data.url;
    renderProjectsList();
  } catch (err) { alert(err.message); }
}
async function uploadGalleryImage(i, input){
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    if (!projectsCache[i].images) projectsCache[i].images = [];
    projectsCache[i].images.push(data.url);
    // If there's no cover thumbnail yet, use the first gallery image as one automatically.
    if (!projectsCache[i].thumbnailUrl) projectsCache[i].thumbnailUrl = data.url;
    renderProjectsList();
  } catch (err) { alert(err.message); }
}
function removeGalleryImage(i, gi){
  projectsCache[i].images.splice(gi, 1);
  renderProjectsList();
}
async function saveProjectRow(i){
  const p = projectsCache[i];
  try {
    if (p.id) {
      const res = await fetch('/api/admin/projects/' + p.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    } else {
      const res = await fetch('/api/admin/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error);
      projectsCache[i] = created;
    }
    renderProjectsList();
  } catch (err) { alert(err.message || 'Could not save project.'); }
}
async function deleteProjectRow(i){
  const p = projectsCache[i];
  if (!confirm('Delete "' + (p.title || 'this project') + '" permanently?')) return;
  if (p.id) {
    try {
      const res = await fetch('/api/admin/projects/' + p.id, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { alert('Could not delete project.'); return; }
  }
  projectsCache.splice(i, 1);
  renderProjectsList();
}

let journalCache = [];
async function loadJournal(){
  const res = await fetch('/api/admin/journal');
  journalCache = await res.json();
  renderJournalList();
}
function renderJournalList(){
  const box = document.getElementById('journalList');
  box.innerHTML = journalCache.map((p, i) => `
    <div class="cms-card">
      <div class="cms-row">
        <div><label>Title</label><input value="${escapeAttr(p.title)}" oninput="journalCache[${i}].title=this.value" class="owner-only-input"></div>
        <div><label>Slug (URL-safe)</label><input value="${escapeAttr(p.slug)}" oninput="journalCache[${i}].slug=this.value" class="owner-only-input"></div>
      </div>
      <div style="margin-bottom:12px;"><label>Excerpt</label><input value="${escapeAttr(p.excerpt)}" oninput="journalCache[${i}].excerpt=this.value" class="owner-only-input"></div>
      <div style="margin-bottom:12px;"><label>Body</label><textarea rows="6" oninput="journalCache[${i}].body=this.value" class="owner-only-input">${escapeHtml(p.body)}</textarea></div>
      <div class="cms-row">
        <div><label>Tags (comma separated)</label><input value="${escapeAttr((p.tags||[]).join(', '))}" oninput="journalCache[${i}].tags=this.value.split(',').map(t=>t.trim()).filter(Boolean)" class="owner-only-input"></div>
        <div><label>Published Date</label><input type="date" value="${(p.publishedAt||'').slice(0,10)}" oninput="journalCache[${i}].publishedAt=this.value" class="owner-only-input"></div>
      </div>
      <div class="cms-checkbox-row"><input type="checkbox" ${p.featured?'checked':''} onchange="journalCache[${i}].featured=this.checked" class="owner-only-input"> Featured</div>
      <div class="cms-card-actions">
        <button class="cms-btn-save owner-only-input" onclick="saveJournalRow(${i})">Save</button>
        <button class="cms-btn-delete owner-only-input" onclick="deleteJournalRow(${i})">Delete</button>
        ${p.id ? '' : '<span style="font-size:12px; color:var(--muted);">Not saved yet</span>'}
      </div>
    </div>
  `).join('');
  applyViewerReadOnly(box, 'journal');
}
function addJournalRow(){
  journalCache.unshift({ title: '', slug: '', excerpt: '', body: '', tags: [], featured: false, publishedAt: new Date().toISOString() });
  renderJournalList();
}
async function saveJournalRow(i){
  const p = journalCache[i];
  try {
    if (p.id) {
      const res = await fetch('/api/admin/journal/' + p.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    } else {
      const res = await fetch('/api/admin/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error);
      journalCache[i] = created;
    }
    renderJournalList();
  } catch (err) { alert(err.message || 'Could not save post.'); }
}
async function deleteJournalRow(i){
  const p = journalCache[i];
  if (!confirm('Delete "' + (p.title || 'this post') + '" permanently?')) return;
  if (p.id) {
    try {
      const res = await fetch('/api/admin/journal/' + p.id, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { alert('Could not delete post.'); return; }
  }
  journalCache.splice(i, 1);
  renderJournalList();
}

async function loadNewsletterPanel(){
  try {
    const subsRes = await fetch('/api/admin/data/subscribers');
    const subs = await subsRes.json();
    document.getElementById('subscriberCount').textContent = subs.length + ' subscriber' + (subs.length === 1 ? '' : 's');
  } catch {
    document.getElementById('subscriberCount').textContent = 'Could not load subscriber count.';
  }
  try {
    const res = await fetch('/api/admin/newsletter/campaigns');
    const campaigns = await res.json();
    const box = document.getElementById('campaignHistory');
    box.innerHTML = campaigns.length ? campaigns.map(c => `
      <div class="campaign-item">
        <strong>${escapeHtml(c.subject)}</strong>
        <div class="campaign-meta">Sent to ${c.sentTo} subscribers on ${new Date(c.sentAt).toLocaleString()}</div>
      </div>
    `).join('') : '<div class="empty-state">No campaigns sent yet.</div>';
  } catch {
    document.getElementById('campaignHistory').innerHTML = '<div class="empty-state">Could not load campaign history.</div>';
  }
  applyViewerReadOnly(document.getElementById('panel-newsletter'), 'newsletter');
}
document.getElementById('newsletterAudience')?.addEventListener('change',function(){
  const box=document.getElementById('newsletterCustomRecipients');
  if(box)box.style.display=this.value==='custom'?'block':'none';
});
async function generateNewsletterDraft(){
  const notes=document.getElementById('newsletterNotes').value.trim();
  const tone=document.getElementById('newsletterTone').value.trim();
  const btn=document.getElementById('newsletterAiBtn');
  const msg=document.getElementById('newsletterAiMsg');
  if(notes.length<20){msg.textContent='Add a little more context first.';return;}
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Drafting...';msg.textContent='AI is shaping your notes into a newsletter.';
  try{
    const res=await fetch('/api/admin/newsletter/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes,tone})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'AI draft failed.');
    const draft=data.draft;
    const match=draft.match(/^SUBJECT:\s*(.+)$/im);
    if(match){document.getElementById('newsletterSubject').value=match[1].trim();document.getElementById('newsletterBody').value=draft.replace(/^SUBJECT:\s*.+\n?/im,'').trim();}
    else document.getElementById('newsletterBody').value=draft;
    msg.textContent='Draft ready. Review and edit before sending.';
  }catch(error){msg.textContent=error.message;}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-sparkles"></i> Generate newsletter draft';}
}
async function sendNewsletter(){
  const subject=document.getElementById('newsletterSubject').value.trim();
  const body=document.getElementById('newsletterBody').value.trim();
  const audience=document.getElementById('newsletterAudience').value;
  const customRecipients=document.getElementById('newsletterCustomRecipients')?.value || '';
  if(!subject||!body){alert('Please fill in both the subject and body.');return;}
  const label=audience==='recent'?'recent subscribers (last 30 days)':audience==='custom'?'the specified email addresses':'all subscribers';
  if(!confirm(`Send this newsletter to ${label} now? This cannot be undone.`))return;
  const btn=document.getElementById('newsletterSendBtn');btn.disabled=true;
  try{
    const res=await fetch('/api/admin/newsletter/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject,body,audience,customRecipients})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Send failed.');
    flashSaved('newsletterSendMsg');
    alert(`Newsletter sent to ${data.sentTo} recipients.`);
    loadNewsletterPanel();
  }catch(err){alert(err.message||'Could not send newsletter.');}
  finally{btn.disabled=false;}
}

const PERMISSION_LABELS = {
  projects: 'Projects', journal: 'Journal', team: 'Team',
  config: 'Site Config', submissions: 'Submissions', newsletter: 'Newsletter'
};

async function loadAdmins(){
  const res = await fetch('/api/admin/admins');
  if (!res.ok) { document.getElementById('adminsList').innerHTML = '<div class="empty-state">Super admin access required.</div>'; return; }
  const admins = await res.json();
  const box = document.getElementById('adminsList');
  box.innerHTML = admins.map(a => {
    const isSuper = a.role === 'super';
    const permsBadges = isSuper
      ? '<span style="font-size:11.5px; color:var(--muted);">Full access</span>'
      : (a.permissions || []).map(p => `<span class="role-badge editor" style="margin-right:4px;">${PERMISSION_LABELS[p] || p}</span>`).join('') || '<span style="font-size:11.5px; color:var(--muted);">No sections assigned yet</span>';
    return `
    <div class="admin-account-row" style="flex-direction:column; align-items:stretch;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <strong>${escapeHtml(a.name)}</strong> <span class="role-badge ${isSuper ? 'owner' : 'viewer'}">${isSuper ? 'super' : 'editor'}</span>
          <div style="font-size:12.5px; color:var(--muted); margin-top:2px;">${escapeHtml(a.email)} &middot; joined ${new Date(a.createdAt).toLocaleDateString()}</div>
        </div>
        <button class="delete-btn" onclick="deleteAdminAccount('${a.id}', this)"><i class="fas fa-trash"></i></button>
      </div>
      <div style="margin-top:10px;">${permsBadges}</div>
      ${!isSuper ? `
        <div style="margin-top:10px; display:flex; gap:14px; flex-wrap:wrap;">
          ${Object.keys(PERMISSION_LABELS).map(p => `
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted);">
              <input type="checkbox" style="width:auto;" value="${p}" ${((a.permissions || []).includes(p)) ? 'checked' : ''} onchange="updateAdminPermission('${a.id}', this)">
              ${PERMISSION_LABELS[p]}
            </label>`).join('')}
        </div>` : ''}
    </div>
  `; }).join('');
}

async function updateAdminPermission(adminId, checkboxEl){
  const row = checkboxEl.closest('.admin-account-row');
  const checked = Array.from(row.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
  try {
    const res = await fetch(`/api/admin/admins/${adminId}/permissions`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: checked })
    });
    if (!res.ok) throw new Error();
    loadAdmins();
  } catch {
    alert('Could not update permissions.');
  }
}

function toggleEditorPermissionFields(role){
  document.getElementById('editorPermissionFields').style.display = role === 'super' ? 'none' : 'block';
}

async function createAdminAccount(){
  const name = document.getElementById('newAdminName').value.trim();
  const email = document.getElementById('newAdminEmail').value.trim();
  const password = document.getElementById('newAdminPassword').value;
  const role = document.getElementById('newAdminRole').value;
  const permissions = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(c => c.value);
  const errorBox = document.getElementById('adminCreateError');
  errorBox.style.display = 'none';
  try {
    const res = await fetch('/api/admin/admins', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, role, permissions })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('newAdminName').value = '';
    document.getElementById('newAdminEmail').value = '';
    document.getElementById('newAdminPassword').value = '';
    document.querySelectorAll('.perm-checkbox').forEach(c => c.checked = false);
    loadAdmins();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
}
async function deleteAdminAccount(id, btn){
  if (!confirm('Remove this admin account?')) return;
  btn.disabled = true;
  try {
    const res = await fetch('/api/admin/admins/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    loadAdmins();
  } catch (err) { alert(err.message); btn.disabled = false; }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}
function escapeAttr(str){
  return String(str || '').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', checkAdminSession);
