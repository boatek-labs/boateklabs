// ============================================================
// BOATEK LABS — Shared site script
// ============================================================

// ---------- Theme: dark is the default until the user switches ----------
(function initTheme(){
  const saved = localStorage.getItem('boatek-theme');
  const theme = saved || 'dark'; // default dark regardless of system preference
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  document.addEventListener('DOMContentLoaded', () => {
    let toggle = document.getElementById('themeToggle');
    const headerInner = document.querySelector('header .header-inner');
    if (!toggle && headerInner) { toggle=document.createElement('button'); toggle.id='themeToggle'; toggle.type='button'; toggle.setAttribute('aria-label','Toggle colour theme'); headerInner.appendChild(toggle); }
    if (!toggle) return;
    if (headerInner && toggle.parentElement !== headerInner) headerInner.appendChild(toggle);
    toggle.classList.add('theme-toggle');
    toggle.setAttribute('type','button');
    updateToggleIcon(theme);
    toggle.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const next = isLight ? 'dark' : 'light';
      if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('boatek-theme', next);
      updateToggleIcon(next);
    });
  });
  function updateToggleIcon(theme){
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.innerHTML = theme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    toggle.setAttribute('aria-label',theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.title=theme === 'light' ? 'Dark mode' : 'Light mode';
  }
})();

// ---------- Mobile nav toggle ----------
function toggleMobileNav(force){
  const nav=document.getElementById('primaryNavigation');
  const button=document.querySelector('.mobile-nav-toggle');
  if(!nav||!button)return;
  const isOpen=typeof force==='boolean'?force:!nav.classList.contains('open');
  nav.classList.toggle('open',isOpen);
  button.setAttribute('aria-expanded',String(isOpen));
  button.setAttribute('aria-label',isOpen?'Close navigation':'Open navigation');
  const icon=button.querySelector('i');
  if(icon)icon.className=isOpen?'fas fa-xmark':'fas fa-bars';
  document.body.classList.toggle('navigation-open',isOpen);
}
function toggleMobileSubmenu(el){
  if(window.innerWidth>900)return;
  const wasOpen=el.classList.contains('open');
  document.querySelectorAll('nav.primary .nav-item.open').forEach(item=>item.classList.remove('open'));
  el.classList.toggle('open',!wasOpen);
}
document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.getElementById('primaryNavigation');
  const button=document.querySelector('.mobile-nav-toggle');
  if(!nav||!button)return;
  nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    if(window.innerWidth<=900)toggleMobileNav(false);
  }));
  document.addEventListener('click',event=>{
    if(window.innerWidth>900||!nav.classList.contains('open'))return;
    if(!nav.contains(event.target)&&!button.contains(event.target))toggleMobileNav(false);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')toggleMobileNav(false);});
  window.addEventListener('resize',()=>{if(window.innerWidth>900)toggleMobileNav(false);});
});

// ---------- Tabs (Services / What We Build / Case Studies) ----------
function showTab(name, el){
  const list = el.closest('.tabs-layout').querySelector('.tab-list');
  const panels = el.closest('.tabs-layout').querySelectorAll('.tab-content');
  panels.forEach(t=>t.classList.remove('active'));
  const target = el.closest('.tabs-layout').querySelector('.tab-content.'+name);
  if (target) target.classList.add('active');
  list.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
}

// ---------- Qualifying pills (used on both Start a Project and Collaborate forms) ----------
function selectQualify(el, targetId){
  targetId = targetId || 'projectType';
  const group = el.closest('.qualify-row');
  group.querySelectorAll('.qualify-pill').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  const hidden = document.getElementById(targetId);
  if (hidden) hidden.value = el.textContent.trim();
}

// ---------- Shared submit helper: posts JSON, shows success/error, used by all four forms below ----------
async function submitInquiry({ form, endpoint, payload, requiredFields, requiredMessage }){
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorBox = document.getElementById('formError');
  const success = document.getElementById('formSuccess');
  if (errorBox) errorBox.style.display = 'none';

  const missing = requiredFields.some(f => !payload[f] || !String(payload[f]).trim());
  if (missing){
    if (errorBox){ errorBox.textContent = requiredMessage; errorBox.style.display = 'block'; }
    return false;
  }

  const originalLabel = submitBtn ? submitBtn.textContent : '';
  if (submitBtn){ submitBtn.textContent = 'Sending...'; submitBtn.style.pointerEvents = 'none'; submitBtn.style.opacity = '0.7'; }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    form.style.display = 'none';
    if (success) success.style.display = 'block';
  } catch (err) {
    if (errorBox){ errorBox.textContent = err.message; errorBox.style.display = 'block'; }
    if (submitBtn){ submitBtn.textContent = originalLabel; submitBtn.style.pointerEvents = 'auto'; submitBtn.style.opacity = '1'; }
  }
  return false;
}

// ---------- Start a Project ----------
function handleProjectSubmit(e){
  e.preventDefault();
  const form = e.target;
  return submitInquiry({
    form,
    endpoint: '/api/contact/project',
    payload: {
      projectType: form.projectType.value || 'Not specified',
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      brief: form.brief.value.trim(),
      budget: form.budget.value.trim(),
      timeline: form.timeline.value.trim(),
      website: form.website ? form.website.value : ''
    },
    requiredFields: ['name', 'email', 'brief'],
    requiredMessage: 'Please fill in your name, email, and a short project brief.'
  });
}

// ---------- Join the Team ----------
function handleCareersSubmit(e){
  e.preventDefault();
  const form = e.target;
  return submitInquiry({
    form,
    endpoint: '/api/contact/careers',
    payload: {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      roleInterest: form.roleInterest.value.trim(),
      portfolioUrl: form.portfolioUrl.value.trim(),
      message: form.message.value.trim(),
      website: form.website ? form.website.value : ''
    },
    requiredFields: ['name', 'email', 'roleInterest', 'message'],
    requiredMessage: 'Please fill in your name, email, role interest, and a short message.'
  });
}

// ---------- Partner With Us (Collaboration) ----------
function handleCollabSubmit(e){
  e.preventDefault();
  const form = e.target;
  return submitInquiry({
    form,
    endpoint: '/api/contact/collaborate',
    payload: {
      organization: form.organization.value.trim(),
      contactName: form.contactName.value.trim(),
      email: form.email.value.trim(),
      partnershipType: form.partnershipType.value || 'Not specified',
      message: form.message.value.trim(),
      website: form.website ? form.website.value : ''
    },
    requiredFields: ['contactName', 'email', 'message'],
    requiredMessage: 'Please fill in your name, email, and a short message about the partnership.'
  });
}

// ---------- General Inquiry ----------
function handleGeneralSubmit(e){
  e.preventDefault();
  const form = e.target;
  return submitInquiry({
    form,
    endpoint: '/api/contact/general',
    payload: {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      website: form.website ? form.website.value : ''
    },
    requiredFields: ['name', 'email', 'message'],
    requiredMessage: 'Please fill in your name, email, and a message.'
  });
}

// ---------- Newsletter form: real POST to /api/newsletter ----------
async function handleNewsletterSubmit(e){
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('input[type="email"]');
  const honeypot = form.querySelector('input[name="website"]');
  const msg = form.parentElement.querySelector('.newsletter-msg');
  const email = input.value.trim();
  if (!email) return false;

  try {
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, website: honeypot ? honeypot.value : '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not subscribe right now.');
    form.reset();
    if (msg){
      msg.style.display = 'block';
      msg.style.color = 'var(--cyan)';
      if (data.verificationRequired) {
        msg.innerHTML = `<span>${data.message || 'Check your inbox for a code.'}</span><div class="newsletter-verify" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input class="newsletter-otp" inputmode="numeric" maxlength="6" placeholder="6-digit code" aria-label="Email verification code" style="padding:9px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);max-width:150px"><button type="button" class="newsletter-verify-btn" style="padding:9px 14px;border-radius:6px;border:1px solid var(--cyan);background:transparent;color:var(--cyan);cursor:pointer">Verify</button></div>`;
        const verifyBtn=msg.querySelector('.newsletter-verify-btn');
        verifyBtn.addEventListener('click',async()=>{
          const code=msg.querySelector('.newsletter-otp').value.trim();
          verifyBtn.disabled=true; verifyBtn.textContent='Verifying...';
          try{
            const vr=await fetch('/api/newsletter/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp:code})});
            const vd=await vr.json(); if(!vr.ok) throw new Error(vd.error||'Verification failed.');
            msg.textContent='Email verified. Welcome to the list!';
          }catch(error){msg.querySelector('span').textContent=error.message;verifyBtn.disabled=false;verifyBtn.textContent='Verify';}
        });
      } else {
        msg.textContent = data.alreadySubscribed ? 'This email is already subscribed.' : 'You’re already on the list.';
      }
    }
  } catch (err) {
    if (msg){ msg.textContent = err.message; msg.style.color = 'var(--orange)'; msg.style.display = 'block'; }
  }
  return false;
}


// ---------- Paystack donation flow ----------
document.addEventListener('DOMContentLoaded', () => {
  const amount = document.getElementById('donationAmount');
  document.querySelectorAll('.donation-amounts button[data-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      if (amount) amount.value = button.dataset.amount;
      document.querySelectorAll('.donation-amounts button').forEach((b) => b.classList.toggle('selected', b === button));
    });
  });
});
async function handleDonation(e){
  e.preventDefault();
  const amount = Number(document.getElementById('donationAmount').value);
  const email = document.getElementById('donationEmail').value.trim();
  const msg = document.getElementById('donationMessage');
  const btn = e.target.querySelector('button[type="submit"]');
  if (!Number.isFinite(amount) || amount < 1 || amount > 5000) { msg.textContent='Enter an amount between GHS 1 and GHS 5,000.'; return false; }
  btn.disabled=true; msg.textContent='Preparing secure payment...';
  try{
    const response=await fetch('/api/payments/paystack/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,email})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Could not start payment.');
    window.location.href=data.authorizationUrl;
  }catch(error){msg.textContent=error.message;btn.disabled=false;}
  return false;
}

// ---------- Chat drawer: real POST to /api/message ----------
async function sendChatMessage(){
  const input = document.getElementById('chatInput');
  const thread = document.getElementById('chatThread');
  const text = input.value.trim();
  if (!text) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble';
  userBubble.style.marginLeft = 'auto';
  userBubble.style.background = 'var(--blue)';
  userBubble.style.color = '#fff';
  userBubble.textContent = text;
  thread.appendChild(userBubble);
  input.value = '';
  thread.scrollTop = thread.scrollHeight;

  try {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    const replyBubble = document.createElement('div');
    replyBubble.className = 'chat-bubble';
    replyBubble.textContent = data.reply || 'Thanks — we\'ll get back to you by email shortly.';
    thread.appendChild(replyBubble);
    thread.scrollTop = thread.scrollHeight;
  } catch (err) {
    const replyBubble = document.createElement('div');
    replyBubble.className = 'chat-bubble';
    replyBubble.textContent = 'Message received — we\'ll reply by email shortly.';
    thread.appendChild(replyBubble);
    thread.scrollTop = thread.scrollHeight;
  }
}

// ---------- Search overlay ----------
function openSearch(){
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  const input = document.getElementById('searchInput');
  setTimeout(() => input && input.focus(), 50);
  document.body.style.overflow = 'hidden';
  buildSearchIndex();
}
function closeSearch(){
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

let searchIndexCache = null;
let searchIndexPromise = null;
async function buildSearchIndex(){
  if (searchIndexCache) return searchIndexCache;
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = (async () => {
    const [projects, team, journal] = await Promise.all([
      fetch('/api/projects').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/team').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/journal').then(r => r.ok ? r.json() : []).catch(() => [])
    ]);

    const projectEntries = projects.map(p => ({
      title: p.title,
      type: p.category === 'games' ? 'Game' : p.category === 'software' ? 'Software' : 'Project',
      url: `project.html?id=${encodeURIComponent(p.id)}`,
      desc: p.description
    }));

    const teamEntries = team.filter(m => !m.hiring).map(m => ({
      title: m.name, type: 'Team', url: 'team.html#meet', desc: m.role
    }));
    const hiringEntry = team.find(m => m.hiring);
    if (hiringEntry) {
      teamEntries.push({ title: `We're Hiring: ${hiringEntry.name}`, type: 'Team', url: 'team.html#hiring', desc: hiringEntry.role });
    }

    const journalEntries = journal.map(p => ({
      title: p.title, type: 'Journal', url: `journal-post.html?slug=${encodeURIComponent(p.slug)}`, desc: p.excerpt
    }));

    const staticEntries = [
      { title: 'Start a Project', type: 'Contact', url: 'start-a-project.html', desc: "Tell us what you're building — we'll tell you how we'd build it." },
      { title: 'Join the Team', type: 'Contact', url: 'join-the-team.html', desc: 'Apply to work with Boatek Labs — current openings and general applications.' },
      { title: 'Partner With Us', type: 'Contact', url: 'collaborate.html', desc: 'Propose a collaboration, sponsorship, or partnership with Boatek Labs.' },
      { title: 'General Inquiry', type: 'Contact', url: 'general-inquiry.html', desc: 'Send a general question to Boatek Labs.' },
      { title: 'Studio Values', type: 'Studio', url: 'team.html#values', desc: 'Engineered. Composable. Restrained.' },
      { title: 'How We Work', type: 'Studio', url: 'team.html#process', desc: 'Our four-step process: review, scope, build, ship.' }
    ];

    searchIndexCache = [...projectEntries, ...teamEntries, ...journalEntries, ...staticEntries];
    return searchIndexCache;
  })();

  return searchIndexPromise;
}

async function runSiteSearch(query){
  const resultsBox = document.getElementById('searchResults');
  if (!resultsBox) return;
  const q = query.trim().toLowerCase();

  if (!q){
    resultsBox.innerHTML = '';
    return;
  }

  const index = await buildSearchIndex();
  const matches = index.filter(item =>
    item.title.toLowerCase().includes(q) ||
    (item.desc || '').toLowerCase().includes(q) ||
    item.type.toLowerCase().includes(q)
  );

  if (matches.length === 0){
    resultsBox.innerHTML = '<div class="search-empty">No results for "' + escapeHtml(query) + '". Try Games, Software, or Team.</div>';
    return;
  }

  resultsBox.innerHTML = matches.map(item => `
    <a class="search-result-item" href="${item.url}">
      <h5>${escapeHtml(item.title)} <span style="color:var(--cyan); font-size:11px; font-family:'JetBrains Mono',monospace; margin-left:8px;">${escapeHtml(item.type)}</span></h5>
      <p>${escapeHtml(item.desc || '')}</p>
    </a>
  `).join('');
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSearch();
});

// ---------- Privacy-respecting pageview beacon (no cookies) ----------
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || null })
  }).catch(() => {});
});

// ---------- Site config (status ticker, social links) ----------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const config = await res.json();

    const tickerEl = document.getElementById('statusMessageText');
    if (tickerEl && config.statusMessage) tickerEl.textContent = config.statusMessage;

    const linkedin = document.getElementById('socialLinkedin');
    const x = document.getElementById('socialX');
    const github = document.getElementById('socialGithub');
    if (linkedin && config.social && config.social.linkedin) linkedin.href = config.social.linkedin;
    if (x && config.social && config.social.x) x.href = config.social.x;
    if (github && config.social && config.social.github) github.href = config.social.github;
  } catch (err) {
    console.warn('[config] could not load site config:', err);
  }
});

// ---------- Dynamic team rendering (source of truth: /api/team, editable via admin) ----------
async function renderTeamGrid(containerId, options){
  options = options || {};
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const res = await fetch('/api/team');
    let members = await res.json();
    if (options.featuredOnly) members = members.filter(m => m.featured);
    if (options.excludeHiring) members = members.filter(m => !m.hiring);

    container.innerHTML = members.map(m => {
      if (m.hiring) {
        return `
          <div class="team-card hiring">
            <div style="font-size:20px; margin-bottom:8px; color:var(--orange);"><i class="fas fa-plus"></i></div>
            <h4>${escapeHtmlShared(m.name)}</h4>
            <div class="role">${escapeHtmlShared(m.role)}</div>
          </div>`;
      }
      const tags = (m.tags || []).map(t => `<span class="discipline-tag">${escapeHtmlShared(t)}</span>`).join('');
      return `
        <div class="team-card">
          <div class="avatar"></div>
          <h4>${escapeHtmlShared(m.name)}</h4>
          <div class="role">${escapeHtmlShared(m.role)}</div>
          <div>${tags}</div>
        </div>`;
    }).join('');
  } catch (err) {
    console.warn('[team] could not load team data:', err);
  }
}
function escapeHtmlShared(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}
document.addEventListener('DOMContentLoaded', () => {
  renderTeamGrid('teamGridHome', { featuredOnly: true });
  renderTeamGrid('teamGridFull', { excludeHiring: true });
});

// ---------- Dynamic project rendering (source of truth: /api/projects, editable via admin) ----------
const THUMB_GRADIENTS = {
  a: 'linear-gradient(135deg, #1a2744, #3B82F6)',
  b: 'linear-gradient(135deg, #241a44, #8B5CF6)',
  c: 'linear-gradient(135deg, #0f2a2e, #22D3EE)'
};

async function renderProjectGrid(containerId, options){
  options = options || {};
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const params = new URLSearchParams();
    if (options.category) params.set('category', options.category);
    if (options.featuredOnly) params.set('featured', 'true');
    const res = await fetch('/api/projects' + (params.toString() ? '?' + params.toString() : ''));
    let projects = await res.json();
    if (options.limit) projects = projects.slice(0, options.limit);
    renderProjectCardsInto(container, projects);
  } catch (err) {
    console.warn('[projects] could not load project data:', err);
  }
}

function renderProjectCardsInto(container, projects){
  if (projects.length === 0) {
    container.innerHTML = '<div style="color:var(--muted); font-size:14px;">More coming soon.</div>';
    return;
  }

  container.innerHTML = projects.map(p => {
    const thumbStyle = p.thumbnailUrl
      ? `background-image:url('${escapeAttrShared(p.thumbnailUrl)}'); background-size:cover; background-position:center;`
      : `background:${THUMB_GRADIENTS[p.thumbnailVariant] || THUMB_GRADIENTS.a};`;
    const tags = (p.techStack || []).map(t => `<span class="tag-chip">${escapeHtmlShared(t)}</span>`).join('');
    const portalBadge = p.hasClientPortal
      ? `<span class="tag-chip" style="border-color:var(--orange); color:var(--orange);"><i class="fas fa-lock"></i> Client Portal</span>`
      : '';
    const cardInner = `
      <div class="work-thumb" style="${thumbStyle}"></div>
      <div class="work-body">
        <h4>${escapeHtmlShared(p.title)}</h4>
        <p>${escapeHtmlShared(p.description)}</p>
        <div class="tags">${tags}${portalBadge}</div>
        ${p.githubOrg ? `<div class="github-stat-badge" data-org="${escapeAttrShared(p.githubOrg)}" style="margin-top:10px; font-size:12px; color:var(--muted);"><i class="fab fa-github"></i> Loading GitHub stats...</div>` : ''}
      </div>`;
    return `<a class="work-card" href="project.html?id=${encodeURIComponent(p.id)}" style="text-decoration:none; display:block;">${cardInner}</a>`;
  }).join('');

  container.querySelectorAll('.github-stat-badge').forEach(async (badge) => {
    const org = badge.dataset.org;
    try {
      const statsRes = await fetch('/api/github-stats?org=' + encodeURIComponent(org));
      const stats = await statsRes.json();
      if (stats.ok) {
        badge.innerHTML = `<i class="fab fa-github"></i> ${stats.publicRepos} repos &middot; ${stats.totalStars} &#9733; stars`;
      } else {
        badge.innerHTML = `<i class="fab fa-github"></i> GitHub stats unavailable right now`;
      }
    } catch {
      badge.innerHTML = `<i class="fab fa-github"></i> GitHub stats unavailable right now`;
    }
  });
}

// ---------- Interactive category + tag filtering (Work page) ----------
async function initWorkPageFilters(){
  const chipsContainer = document.getElementById('workFilterChips');
  const grid = document.getElementById('projectGridWork');
  if (!chipsContainer || !grid) return;

  try {
    const res = await fetch('/api/projects');
    const allProjects = await res.json();

    const categories = ['all', ...new Set(allProjects.map(p => p.category))];
    const categoryLabels = { all: 'All', software: 'Software', games: 'Games', experiences: 'Experiences' };
    const allTags = [...new Set(allProjects.flatMap(p => p.techStack || []))].sort();

    let activeCategory = 'all';
    let activeTag = null;

    function applyFilters(){
      let filtered = allProjects;
      if (activeCategory !== 'all') filtered = filtered.filter(p => p.category === activeCategory);
      if (activeTag) filtered = filtered.filter(p => (p.techStack || []).includes(activeTag));
      renderProjectCardsInto(grid, filtered);
    }

    function renderChips(){
      const categoryChips = categories.map(c =>
        `<div class="qualify-pill ${c === activeCategory ? 'selected' : ''}" data-cat="${escapeAttrShared(c)}">${categoryLabels[c] || c}</div>`
      ).join('');
      const tagChips = allTags.map(t =>
        `<div class="qualify-pill ${t === activeTag ? 'selected' : ''}" data-tag="${escapeAttrShared(t)}" style="font-family:'JetBrains Mono',monospace; font-size:12px;">${escapeHtmlShared(t)}</div>`
      ).join('');
      chipsContainer.innerHTML = categoryChips + (allTags.length ? '<div style="width:1px; background:var(--line); margin:0 6px;"></div>' + tagChips : '');

      chipsContainer.querySelectorAll('[data-cat]').forEach(el => {
        el.addEventListener('click', () => { activeCategory = el.dataset.cat; renderChips(); applyFilters(); });
      });
      chipsContainer.querySelectorAll('[data-tag]').forEach(el => {
        el.addEventListener('click', () => {
          activeTag = (activeTag === el.dataset.tag) ? null : el.dataset.tag;
          renderChips(); applyFilters();
        });
      });
    }

    renderChips();
    applyFilters();
  } catch (err) {
    console.warn('[work-filters] could not load projects for filtering:', err);
  }
}
function escapeAttrShared(str){
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
document.addEventListener('DOMContentLoaded', () => {
  renderProjectGrid('projectGridHome', { featuredOnly: true });
  initWorkPageFilters();
  renderProjectGrid('projectGridGames', { category: 'games' });
  renderProjectGrid('projectGridSoftware', { category: 'software' });
});

// ---------- Dynamic journal rendering (source of truth: /api/journal, editable via admin) ----------
async function renderJournalGrid(containerId, options){
  options = options || {};
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const params = new URLSearchParams();
    if (options.featuredOnly) params.set('featured', 'true');
    const res = await fetch('/api/journal' + (params.toString() ? '?' + params.toString() : ''));
    let posts = await res.json();
    if (options.limit) posts = posts.slice(0, options.limit);

    if (posts.length === 0) {
      container.innerHTML = '<div style="color:var(--muted); font-size:14px;">No posts yet — check back soon.</div>';
      return;
    }

    container.innerHTML = posts.map((p, i) => {
      const variant = ['a', 'b', 'c'][i % 3];
      const tags = (p.tags || []).map(t => `<span class="tag-chip">${escapeHtmlShared(t)}</span>`).join('');
      return `
        <a class="work-card" href="journal-post.html?slug=${encodeURIComponent(p.slug)}" style="text-decoration:none; display:block;">
          <div class="work-thumb" style="background:${THUMB_GRADIENTS[variant]};">Devlog</div>
          <div class="work-body">
            <h4>${escapeHtmlShared(p.title)}</h4>
            <p>${escapeHtmlShared(p.excerpt)}</p>
            <div class="tags">${tags}</div>
          </div>
        </a>`;
    }).join('');
  } catch (err) {
    console.warn('[journal] could not load journal data:', err);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  renderJournalGrid('journalGridHome', { limit: 3 });
  renderJournalGrid('journalGridFull', {});
});


document.addEventListener('DOMContentLoaded', () => {
  const railBadge = document.getElementById('railBadge');
  const railTrack = document.querySelector('.scroll-rail');
  const railSections = Array.from(document.querySelectorAll('[data-rail]'));
  const siteHeader = document.querySelector('header');
  let lastScrollY = window.scrollY;

  function updateRail(){
    if (!railBadge || !railTrack || railSections.length === 0) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(Math.max(scrollTop/docHeight,0),1) : 0;
    const trackHeight = railTrack.clientHeight - railBadge.clientHeight;
    railBadge.style.top = (pct*trackHeight)+'px';

    let current = railSections[0];
    railSections.forEach(s=>{
      const rect = s.getBoundingClientRect();
      if(rect.top <= window.innerHeight*0.4) current = s;
    });
    railBadge.innerHTML = '<i class="fas fa-'+current.dataset.icon+'"></i>';
  }

  window.addEventListener('scroll', () => {
    updateRail();
    const currentY = window.scrollY;
    if (siteHeader){
      if(currentY > lastScrollY && currentY > 140){
        siteHeader.classList.add('header-hidden');
      } else {
        siteHeader.classList.remove('header-hidden');
      }
    }
    lastScrollY = currentY;
  });
  window.addEventListener('resize', updateRail);
  updateRail();

  // Chat drawer
  const openBtn = document.getElementById('openChat');
  const closeBtn = document.getElementById('closeChat');
  const drawer = document.getElementById('chatDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (openBtn && drawer && backdrop){
    openBtn.addEventListener('click', ()=>{ drawer.classList.add('open'); backdrop.classList.add('open'); });
    closeBtn.addEventListener('click', ()=>{ drawer.classList.remove('open'); backdrop.classList.remove('open'); });
    backdrop.addEventListener('click', ()=>{ drawer.classList.remove('open'); backdrop.classList.remove('open'); });
  }

  // Capsule scroll shrink
  const capsule = document.querySelector('.signal-capsule');
  if (capsule){
    let capsuleTimer;
    window.addEventListener('scroll', ()=>{
      capsule.style.transform = 'translateX(-50%) scale(0.94)'; capsule.style.opacity = '0.85';
      clearTimeout(capsuleTimer);
      capsuleTimer = setTimeout(()=>{ capsule.style.transform = 'translateX(-50%) scale(1)'; capsule.style.opacity = '1'; }, 200);
    });
  }
});

// ---------- PWA service worker registration ----------
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}


// Customer account identity in the shared navigation
document.addEventListener('DOMContentLoaded', async () => {
 const nav=document.getElementById('primaryNavigation');if(!nav)return;
 let control=nav.querySelector('.account-nav-link');
 if(!control){control=document.createElement('a');control.href='/account.html';control.className='account-nav-link';control.innerHTML='<i class="fas fa-user-circle"></i><span>Account</span>';const item=document.createElement('div');item.className='nav-item account-nav-item';item.appendChild(control);nav.appendChild(item);}
 control.classList.add('nav-account-control');
 try{const r=await fetch('/api/auth/session',{credentials:'same-origin',headers:{Accept:'application/json'}});if(!r.ok)return;const d=await r.json();if(!d.authenticated||!d.user)return;
 const u=d.user,label=u.name||u.email||'Account';control.href='/account.html';control.setAttribute('aria-label','Open account dashboard for '+label);control.title='Account: '+label;control.innerHTML='';
 if(u.authProvider==='google'&&u.avatarUrl){const img=document.createElement('img');img.src=u.avatarUrl;img.alt='';img.referrerPolicy='no-referrer';img.className='nav-account-photo';control.appendChild(img);}
 else{const badge=document.createElement('span');badge.className='nav-account-initials';badge.textContent=label.trim().split(/\\s+/).slice(0,2).map(s=>s.charAt(0)).join('').toUpperCase();control.appendChild(badge);}
 const name=document.createElement('span');name.className='nav-account-label';name.textContent=label.split(/\\s+/)[0];control.appendChild(name);
 }catch(e){console.warn('[account-nav] session lookup failed',e);}
});
