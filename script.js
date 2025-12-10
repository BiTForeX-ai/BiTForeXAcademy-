/* script.js - BiTForeX Academy (compat mode, preserves IDs and original behavior)
   - keys used: adminAccount, users, session, bf_messages, bf_pending_subs, subscriptionPlans, bf_pwd_requests
   - safe with localStorage quota, supports admin & user chat, subscriptions, payments, forgot password demo reveal
*/

/* ---------- Small helpers ---------- */
function qs(id){ return document.getElementById(id); } // id-only helper (keeps your HTML IDs)
function now(){ return Date.now(); }
function safeJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch(e){ return fallback; }
}
function saveJSON(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch(e){ console.warn("saveJSON failed for", key, e); }
}

/* ---------- Image compression helper (client-side) ---------- */
function compressImage(base64Str, quality = 0.45, cb){
  const img = new Image();
  img.onload = () => {
    const MAX = 800;
    const scale = Math.min(1, MAX / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const out = canvas.toDataURL('image/jpeg', quality);
      cb(out);
    } catch(err){
      cb(base64Str);
    }
  };
  img.onerror = () => cb(base64Str);
  img.src = base64Str;
}

/* ---------- Messages storage with quota-protection ---------- */
function _getMessagesMap(){ return safeJSON('bf_messages', {}); }
function _saveMessagesMap(map){
  try {
    localStorage.setItem('bf_messages', JSON.stringify(map));
  } catch(e){
    // cleanup strategy: remove very large images and keep last 50 messages per user
    Object.keys(map).forEach(email=>{
      let msgs = map[email] || [];
      msgs = msgs.filter(m => !(m.type === 'image' && String(m.content).length > 300000)); // drop very large images
      if(msgs.length > 50) msgs = msgs.slice(-50);
      map[email] = msgs;
    });
    try { localStorage.setItem('bf_messages', JSON.stringify(map)); }
    catch(err){
      console.error("Failed to save messages after cleanup", err);
      localStorage.setItem('bf_messages', JSON.stringify({}));
    }
  }
  // notify other tabs
  localStorage.setItem('bf_messages_updated_at', now());
}
function sendMessageTo(email, sender, type, content){
  if(!email) { console.warn("sendMessageTo: missing email"); return; }
  const map = _getMessagesMap();
  if(!map[email]) map[email] = [];
  map[email].push({ sender, type, content, time: now() });
  _saveMessagesMap(map);
}

/* ---------- Pending subscriptions ---------- */
function addPendingRequest(obj){
  const arr = safeJSON('bf_pending_subs', []);
  arr.push(obj);
  saveJSON('bf_pending_subs', arr);
  localStorage.setItem('bf_pending_updated_at', now());
}

/* ---------- Password reset requests (admin review flow) ---------- */
function requestPasswordReset(email, note){
  const arr = safeJSON('bf_pwd_requests', []);
  arr.push({ id: 'PWD-' + now(), email, note: note || '', status: 'pending', created: now() });
  saveJSON('bf_pwd_requests', arr);
  localStorage.setItem('bf_pwd_requests_updated_at', now());
}

/* ---------- Storage init defaults ---------- */
(function initStorageDefaults(){
  if(!localStorage.getItem('adminAccount')){
    saveJSON('adminAccount', { email: 'arthurebube8@gmail.com', password: 'Arthur9$', name: 'Administrator', role: 'admin' });
  }
  if(!localStorage.getItem('users')) saveJSON('users', []);
  if(!localStorage.getItem('bf_messages')) saveJSON('bf_messages', {});
  if(!localStorage.getItem('bf_pending_subs')) saveJSON('bf_pending_subs', []);
  if(!localStorage.getItem('subscriptionPlans')){
    saveJSON('subscriptionPlans', [
      {id:'basic', name:'Basic', price:20, features:['basic courses','weekly Q&A']},
      {id:'pro', name:'Pro', price:50, features:['all courses','mentorship','signals']},
      {id:'vip', name:'VIP', price:100, features:['VIP mentorship','priority support']}
    ]);
  }
  if(!localStorage.getItem('bf_pwd_requests')) saveJSON('bf_pwd_requests', []);
})();

/* ---------- Session helpers ---------- */
function setSession(obj){ obj.active = true; saveJSON('session', obj); }
function getSession(){ return safeJSON('session', null); }
function logout(){
  localStorage.removeItem('session');
  try { window.location.href = 'login.html'; } catch(e){}
}

/* ---------- Auth: register + login (keeps original behavior) ---------- */
function registerUser(name,email,password){
  const users = safeJSON('users', []);
  if(users.find(u=>u.email === email)){
    alert('Account exists with this email');
    return false;
  }
  const user = {
    name: name || email.split('@')[0],
    email,
    password,
    username: email.split('@')[0],
    plan: null,
    status: 'Inactive',
    created: now()
  };
  users.push(user);
  saveJSON('users', users);

  // create empty message inbox for the new user if not present
  const map = _getMessagesMap();
  if(!map[email]) map[email] = [];
  _saveMessagesMap(map);

  alert('Account created. Please login.');
  window.location.href = 'login.html';
  return true;
}

function loginUser(email,password){
  const admin = safeJSON('adminAccount', {});
  if(email === admin.email && password === admin.password){
    setSession({ email: admin.email, name: admin.name || 'Administrator', role: 'admin' });
    window.location.href = 'admin.html';
    return true;
  }
  const users = safeJSON('users', []);
  const u = users.find(x=>x.email === email && x.password === password);
  if(!u){ alert('Invalid credentials'); return false; }
  setSession({ email: u.email, name: u.name, role: 'user' });
  window.location.href = 'chat.html';
  return true;
}

/* ---------- DOMContentLoaded: wire up pages (safe checks for all IDs) ---------- */
document.addEventListener('DOMContentLoaded', ()=>{

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const sess = getSession();

  // common menu toggle (handle multiple possible IDs used in your HTML)
  const menuToggle = qs('menu-toggle') || qs('hamburger');
  if(menuToggle){
    menuToggle.addEventListener('click', ()=>{
      const nav = qs('main-nav');
      if(nav) nav.classList.toggle('show');
    });
  }

  // update nav-auth / logout where present
  const navAuth = qs('nav-auth');
  const logoutBtn = qs('logout-btn') || qs('logout-admin');
  if(sess && sess.active){
    if(navAuth) { navAuth.textContent = sess.name || (sess.email || '').split('@')[0]; navAuth.href = sess.role === 'admin' ? 'admin.html' : 'chat.html'; }
    if(logoutBtn) { logoutBtn.classList.remove('hidden'); logoutBtn.addEventListener('click', logout); }
  } else {
    if(navAuth) { navAuth.textContent = 'Sign In'; navAuth.href = 'login.html'; }
    if(logoutBtn) logoutBtn.classList.add('hidden');
  }

  /* ---------------- INDEX ---------------- */
  if(path === '' || path === 'index.html'){
    const e = qs('yr');
    if(e) e.textContent = new Date().getFullYear();
  }

  /* ---------------- LOGIN (login.html) ---------------- */
  if(path === 'login.html'){
    const form = qs('loginForm');
    if(form){
      form.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const email = (qs('loginEmail')?.value || '').trim();
        const pw = (qs('loginPassword')?.value || '');
        loginUser(email,pw);
      });
    }
  }

  /* ---------------- REGISTER (register.html) ---------------- */
  if(path === 'register.html'){
    const form = qs('register-form') || qs('registerForm');
    if(form){
      form.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const name = (qs('r-name')?.value || '').trim();
        const email = (qs('r-email')?.value || '').trim();
        const pw = (qs('r-password')?.value || '');
        registerUser(name,email,pw);
      });
    }
  }

  /* ---------------- FORGOT PASSWORD (forgot password page) ----------------
     Behavior: when user provides email, we show their account name + reveal button (demo).
     This preserves the 'old pattern' but includes the account name to be sure it's the right account.
  */
  if(path === 'forgot-password.html' || path === 'forgot.html' || path === 'forgot-password' || path === 'forgot.html'){
    const form = qs('forgotForm') || qs('forgot-form');
    const out = qs('forgotResult') || qs('forgot-result');
    if(form && out){
      form.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const email = (qs('forgotEmail')?.value || '').trim().toLowerCase();
        const admin = safeJSON('adminAccount', {});
        if(admin && admin.email && admin.email.toLowerCase() === email){
          out.innerHTML = `<div class="muted">Admin account detected: <strong>${admin.name || admin.email}</strong>.</div>
            <div style="margin-top:8px"><button id="revealBtn" class="btn small">Show password (demo)</button></div>`;
          qs('revealBtn').addEventListener('click', ()=> alert('Demo: admin password is: ' + admin.password));
          return;
        }
        const users = safeJSON('users', []);
        const u = users.find(x=> (x.email||'').toLowerCase() === email);
        if(!u){ out.innerHTML = `<div class="muted">No account found for that email.</div>`; return; }
        out.innerHTML = `<div class="muted">Account found for <strong>${u.name || u.email}</strong>.</div>
          <div style="margin-top:8px"><button id="revealBtn" class="btn small">Show password (demo)</button></div>`;
        qs('revealBtn').addEventListener('click', ()=> alert('Demo: password for ' + u.email + ' is: ' + u.password));
      });
    }
  }

  /* ---------------- USER CHAT (chat.html) ---------------- */
  if(path === 'chat.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ alert('Please sign in as user.'); window.location.href = 'login.html'; return; }
    const messagesEl = qs('messages');
    const input = qs('messageInput');
    const fileBtn = qs('fileBtn');
    const fileInput = qs('fileInput');
    const sendBtn = qs('sendBtn');

    function renderMessages(){
      if(!messagesEl) return;
      messagesEl.innerHTML = '';
      const list = _getMessagesMap()[sess.email] || [];
      list.forEach(m=>{
        const div = document.createElement('div');
        div.className = 'msg ' + (m.sender === 'admin' ? 'received' : 'sent');
        if(m.type === 'image'){
          div.innerHTML = `<img class="chat-img" src="${m.content}" alt="image">`;
        } else {
          div.textContent = m.content;
        }
        messagesEl.appendChild(div);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // send welcome once if first time
    const welcomeKey = 'welcome_shown_' + sess.email;
    if(!localStorage.getItem(welcomeKey)){
      sendMessageTo(sess.email, 'admin', 'text', 'Welcome! How can I assist you today?');
      localStorage.setItem(welcomeKey, '1');
      renderMessages();
    }

    renderMessages();
    window.addEventListener('storage', (e) => {
      if(e.key === 'bf_messages_updated_at' || e.key === 'bf_messages') renderMessages();
    });

    if(fileBtn && fileInput){
      fileBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', (ev)=>{
        const f = ev.target.files && ev.target.files[0];
        if(!f) return;
        const reader = new FileReader();
        reader.onload = (r)=> compressImage(r.target.result, 0.45, (compressed)=>{
          sendMessageTo(sess.email, 'user', 'image', compressed);
          renderMessages();
        });
        reader.readAsDataURL(f);
        fileInput.value = '';
      });
    }

    if(sendBtn){
      sendBtn.addEventListener('click', ()=>{
        const v = (input?.value || '').trim();
        if(!v) return;
        sendMessageTo(sess.email, 'user', 'text', v);
        input.value = '';
        renderMessages();
      });
    }
  }

  /* ---------------- ADMIN CHAT (admin-chat.html) ---------------- */
  if(path === 'admin-chat.html'){
    if(!sess || sess.role !== 'admin' || !sess.active){ alert('Please sign in as admin.'); window.location.href = 'login.html'; return; }

    // try several ID variations your pages used
    const usersListEl = qs('usersList') || qs('admin-contact-list') || qs('adminUserList');
    const messagesEl = qs('adminMessages');
    const adminInput = qs('adminMessageInput');
    const adminSendBtn = qs('adminSendBtn');
    const adminFileBtn = qs('adminFileBtn');
    const adminFileInput = qs('adminFileInput');
    const adminTitle = qs('adminChatTitle');

    function loadUsers(){
      if(!usersListEl) return;
      usersListEl.innerHTML = '';
      const map = _getMessagesMap();
      const storedUsers = safeJSON('users', []);
      const set = new Set([ ...Object.keys(map), ...storedUsers.map(u=>u.email) ]);
      const arr = Array.from(set).map(email=>{
        const user = storedUsers.find(u=>u.email === email);
        const name = user ? user.name : email.split('@')[0];
        const msgs = map[email] || [];
        const last = msgs.length ? msgs[msgs.length-1].time : 0;
        return { email, name, last };
      }).sort((a,b)=> b.last - a.last);

      arr.forEach(u=>{
        const el = document.createElement('div');
        el.className = 'user-item';
        el.dataset.email = u.email;
        el.innerHTML = `<strong>${u.name}</strong><div class="muted" style="font-size:12px">${u.email}</div>`;
        el.addEventListener('click', ()=>{
          Array.from(usersListEl.children).forEach(c => c.classList.remove('active'));
          el.classList.add('active');
          openChatFor(u.email);
        });
        usersListEl.appendChild(el);
      });
    }

    let activeUser = null;
    function openChatFor(email){
      activeUser = email;
      if(adminTitle) adminTitle.textContent = email;
      if(adminInput) adminInput.disabled = false;
      if(adminSendBtn) adminSendBtn.disabled = false;
      if(adminFileBtn) adminFileBtn.disabled = false;

      if(!messagesEl) return;
      messagesEl.innerHTML = '';
      const list = _getMessagesMap()[email] || [];
      list.forEach(m=>{
        const d = document.createElement('div');
        d.className = 'msg ' + (m.sender === 'user' ? 'received' : 'admin');
        if(m.type === 'image') d.innerHTML = `<img class="chat-img" src="${m.content}" alt="image">`;
        else d.textContent = m.content;
        messagesEl.appendChild(d);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    if(adminSendBtn){
      adminSendBtn.addEventListener('click', ()=>{
        if(!activeUser) return alert('Select a user to reply');
        const txt = (adminInput?.value || '').trim();
        if(!txt) return;
        sendMessageTo(activeUser, 'admin', 'text', txt);
        if(adminInput) adminInput.value = '';
        openChatFor(activeUser);
      });
    }

    if(adminFileBtn && adminFileInput){
      adminFileBtn.addEventListener('click', ()=> adminFileInput.click());
      adminFileInput.addEventListener('change', (ev)=>{
        if(!activeUser) return alert('Select a user to send image');
        const f = ev.target.files && ev.target.files[0];
        if(!f) return;
        const r = new FileReader();
        r.onload = () => compressImage(r.result || r.target.result, 0.45, (compressed)=>{
          sendMessageTo(activeUser, 'admin', 'image', compressed);
          openChatFor(activeUser);
        });
        r.readAsDataURL(f);
        adminFileInput.value = '';
      });
    }

    // keep users & chat updated across tabs
    window.addEventListener('storage', (e)=>{
      if(e.key === 'bf_messages_updated_at' || e.key === 'bf_messages'){
        loadUsers();
        if(activeUser) openChatFor(activeUser);
      }
    });

    loadUsers();
  }

  /* ---------------- SUBSCRIPTION (subscription.html) ---------------- */
  if(path === 'subscription.html'){
    const wrap = qs('plansWrap');
    if(!wrap) return;
    const plans = safeJSON('subscriptionPlans', []);
    wrap.innerHTML = '';
    plans.forEach(p=>{
      const art = document.createElement('article');
      art.className = 'plan';
      art.innerHTML = `<h3>${p.name}</h3><p class="price">$${p.price}</p><ul>${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
        <button class="btn primary choosePlanBtn" data-id="${p.id}" data-price="${p.price}">Subscribe (${p.name})</button>`;
      wrap.appendChild(art);
    });
    Array.from(wrap.getElementsByClassName('choosePlanBtn')).forEach(b=>{
      b.addEventListener('click', (ev)=>{
        const chosen = { plan: ev.currentTarget.dataset.id, price: ev.currentTarget.dataset.price };
        const s = getSession();
        if(!s || s.role !== 'user' || !s.active){ alert('Please sign in to subscribe.'); window.location.href='login.html'; return; }
        sessionStorage.setItem('selectedPlan', JSON.stringify(chosen));
        window.location.href = 'payment.html';
      });
    });
  }

  /* ---------------- PAYMENT PAGE (payment.html) ---------------- */
  if(path === 'payment.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ alert('Please sign in'); window.location.href='login.html'; return; }
    const selected = JSON.parse(sessionStorage.getItem('selectedPlan') || '{}');
    if(!selected.plan){ alert('Pick a plan first'); window.location.href='subscription.html'; return; }
    const submitBtn = qs('submitPaymentBtn');
    if(submitBtn){
      submitBtn.addEventListener('click', ()=>{
        const file = qs('proof-file')?.files && qs('proof-file').files[0];
        const desc = (qs('paymentDescription')?.value || '').trim();
        if(!file) return alert('Upload payment proof.');
        const reader = new FileReader();
        reader.onload = (r)=>{
          compressImage(r.target.result, 0.5, (compressed)=>{
            const pending = {
              id: 'SUB-'+now(),
              userEmail: sess.email,
              userName: sess.name,
              plan: selected.plan,
              price: selected.price,
              description: desc,
              proof: compressed,
              status: 'pending',
              created: now()
            };
            addPendingRequest(pending);
            alert('Payment submitted. Await admin approval.');
            window.location.href = 'user-pending.html';
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ---------------- USER PENDING (user-pending.html) ---------------- */
  if(path === 'user-pending.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ window.location.href='login.html'; return; }
    const box = qs('pendingBox') || qs('pending-box') || qs('pay-result');
    function poll(){
      const arr = safeJSON('bf_pending_subs', []);
      const req = arr.find(x => x.userEmail === sess.email && x.status === 'pending');
      if(req && box) box.innerHTML = `<h2>Pending</h2><p class="muted">Your payment is being reviewed</p>`;
      else {
        const approved = arr.find(x => x.userEmail === sess.email && x.status === 'approved');
        if(approved && box) { box.innerHTML = `<h2>Payment Approved</h2><div class="big-check">✔</div><p>Your subscription is active.</p>`; setTimeout(()=> window.location.href='chat.html', 2000); return; }
        if(box) box.innerHTML = `<p class="muted">No pending request</p>`;
      }
    }
    poll();
    setInterval(poll, 3000);
  }

  /* ---------------- ADMIN PAYMENTS (admin-payments.html) ---------------- */
  if(path === 'admin-payments.html'){
    if(!sess || sess.role !== 'admin' || !sess.active){ window.location.href='login.html'; return; }
    const wrap = qs('adminPendingWrap') || qs('payments-tbody');
    if(!wrap) return;
    function render(){
      const all = safeJSON('bf_pending_subs', []);
      const pending = all.filter(x => x.status === 'pending');
      wrap.innerHTML = '';
      if(!pending.length){
        if(wrap.tagName && wrap.tagName.toLowerCase() === 'tbody'){
          wrap.innerHTML = '<tr><td colspan="5">No pending payments</td></tr>';
        } else {
          wrap.innerHTML = '<p class="muted">No pending payments</p>';
        }
        return;
      }
      pending.forEach(it=>{
        if(wrap.tagName && wrap.tagName.toLowerCase() === 'tbody'){
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${it.userName || it.userEmail}</td><td>${it.plan}</td><td>$${it.price}</td>
            <td><img src="${it.proof}" style="max-width:120px;border-radius:6px"></td>
            <td>
              <button class="btn" data-id="${it.id}" data-act="approve">Approve</button>
              <button class="btn ghost" data-id="${it.id}" data-act="reject">Reject</button>
            </td>`;
          wrap.appendChild(tr);
        } else {
          const div = document.createElement('div');
          div.className = 'panel';
          div.innerHTML = `<h4>${it.userName}</h4><div class="muted">${it.userEmail}</div>
            <p>Plan: <strong>${it.plan}</strong> — $${it.price}</p>
            <div style="margin-top:8px"><img src="${it.proof}" style="max-width:260px;border-radius:8px"></div>
            <div style="margin-top:8px"><button class="btn" data-id="${it.id}" data-act="approve">Approve</button> <button class="btn ghost" data-id="${it.id}" data-act="reject">Reject</button></div>`;
          wrap.appendChild(div);
        }
      });

      // attach handlers
      Array.from(wrap.querySelectorAll('button')).forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const id = btn.dataset.id; const action = btn.dataset.act;
          const arr = safeJSON('bf_pending_subs', []);
          const newArr = arr.map(it=>{
            if(it.id === id){
              it.status = (action === 'approve') ? 'approved' : 'rejected';
              it.updatedAt = now();
              if(action === 'approve'){
                const users = safeJSON('users', []);
                const idx = users.findIndex(u=>u.email === it.userEmail);
                if(idx > -1){
                  users[idx].subscription = { plan: it.plan, started: now(), method: it.method || 'bank' };
                  users[idx].status = 'Active';
                  saveJSON('users', users);
                }
              }
            }
            return it;
          });
          saveJSON('bf_pending_subs', newArr);
          localStorage.setItem('bf_pending_updated_at', now());
          render();
        });
      });
    }
    render();
    window.addEventListener('storage', (e)=>{ if(e.key === 'bf_pending_updated_at') render(); });
  }

  /* ---------------- ADMIN USERS (admin-users.html) - card list with filter ---------------- */
  if(path === 'admin-users.html'){
    const box = qs('adminUsersTable');
    if(!box) return;
    const filterBtns = document.querySelectorAll('.filter-btn');
    function loadUsers(filter='all'){
      const users = safeJSON('users', []);
      box.innerHTML = '';
      if(!users.length){ box.innerHTML = '<p class="muted">No users found.</p>'; return; }
      users.filter(u=>{
        if(filter === 'all') return true;
        return (u.status || 'Inactive') === filter;
      }).forEach(u=>{
        const statusClass = (u.status === 'Active') ? 'badge-active' : 'badge-inactive';
        const sub = u.subscription ? u.subscription.plan : 'None';
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `<h3>${u.name}</h3><div class="muted">${u.email}</div>
          <p><strong>Plan:</strong> ${sub}</p>
          <span class="user-badge ${statusClass}">${u.status || 'Inactive'}</span>
          <br><br>
          <a class="btn small" href="admin-view-user.html?email=${encodeURIComponent(u.email)}">View User</a>`;
        box.appendChild(card);
      });
    }
    loadUsers();
    if(filterBtns) filterBtns.forEach(b=>{
      b.addEventListener('click', ()=>{
        filterBtns.forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        loadUsers(b.dataset.filter || 'all');
      });
    });
  }

  /* ---------------- ADMIN VIEW USER (admin-view-user.html) ---------------- */
  if(path === 'admin-view-user.html'){
    const email = (new URLSearchParams(window.location.search)).get('email');
    if(!email) return;
    const users = safeJSON('users', []);
    const u = users.find(x=>x.email === email);
    if(!u) return alert('User not found.');
    if(qs('user-name')) qs('user-name').textContent = u.name || '';
    if(qs('user-email')) qs('user-email').textContent = u.email || '';
    if(qs('user-username')) qs('user-username').textContent = u.username || '';
    if(qs('user-plan')) qs('user-plan').textContent = u.subscription?.plan || 'None';
    if(qs('user-status')) qs('user-status').textContent = u.status || 'Inactive';
  }

  /* ---------------- ADMIN PROFILE (admin-profile.html) ---------------- */
  if(path === 'admin-profile.html'){
    const admin = safeJSON('adminAccount', {});
    if(qs('adminNameInput')) qs('adminNameInput').value = admin.name || '';
    if(qs('adminEmailInput')) qs('adminEmailInput').value = admin.email || '';
    if(qs('saveAdminProfile')){
      qs('saveAdminProfile').addEventListener('click', ()=>{
        const n = (qs('adminNameInput')?.value || '').trim();
        const e = (qs('adminEmailInput')?.value || '').trim();
        const p = (qs('adminPasswordInput')?.value || '').trim();
        if(!n || !e) return alert('Name and email required.');
        admin.name = n; admin.email = e;
        if(p) admin.password = p;
        saveJSON('adminAccount', admin);
        alert('Admin profile updated.');
        if(qs('adminPasswordInput')) qs('adminPasswordInput').value = '';
      });
    }
  }
/* ---------------- COURSES (courses.html) - course -> chat "card pass" behavior ---------------- */
  if(path === 'courses.html'){
    const wrap = qs('coursesWrap') || qs('courses-wrap') || document.querySelector('.cards');
    // if you don't have courses stored, ensure default ones are available (keeps original content)
    const defaultCourses = [
      { title: 'Forex Foundation', description: 'Basics: order types, chart reading, risk management.' },
      { title: 'Smart Money Concepts (SMC)', description: 'Market structure, liquidity zones, entry/exit workflows.' },
      { title: 'Price Action & Setups', description: 'Pattern recognition, confirmations, trade plans.' }
    ];
    const courses = safeJSON('courses', defaultCourses);
    // render only if container exists and if you set coursesWrap id intentionally
    if(wrap){
      // if a dynamic container exists that expects course cards (but will not break your static HTML)
      if(wrap.children.length === 0){
        courses.forEach(c=>{
          const art = document.createElement('article');
          art.className = 'panel';
          art.innerHTML = `<h3>${c.title}</h3><p class="muted">${c.description}</p>
            <button class="btn primary view-course-btn" data-title="${c.title}" data-desc="${c.description}">View</button>`;
          wrap.appendChild(art);
        });
      }
      Array.from(wrap.getElementsByClassName('view-course-btn')).forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const s = getSession();
          if(!s || s.role !== 'user'){ alert('Please sign in to continue.'); window.location.href = 'login.html'; return; }
          const title = btn.dataset.title, desc = btn.dataset.desc;
          const text = `📘 Course Request\n${title}\n${desc}`;
          sendMessageTo(s.email, 'user', 'text', text);
          window.location.href = 'chat.html';
        });
      });
    }
  }

  /* ------------- FIN ------------- */
}); // end DOMContentLoaded
