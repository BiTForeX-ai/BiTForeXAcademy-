/* script.js - BiTForeX Academy unified controller
   Keys used:
   adminAccount, users, session, bf_messages, bf_pending_subs, subscriptionPlans
*/

/* ---------- Utilities ---------- */
function qs(id){ return document.getElementById(id); }
function bySel(sel){ return document.querySelector(sel); }
function now(){ return Date.now(); }

/* ---------- IMAGE COMPRESSION (simple) ---------- */
function compressImage(base64Str, quality = 0.35, callback){
  const img = new Image();
  img.onload = () => {
    const MAX_WIDTH = 600;
    const scale = Math.min(1, MAX_WIDTH / img.width);
    const cw = Math.round(img.width * scale);
    const ch = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    const compressed = canvas.toDataURL("image/jpeg", quality);
    callback(compressed);
  };
  img.onerror = () => callback(base64Str); // fallback to original
  img.src = base64Str;
}

/* ---------- Storage helpers ---------- */
function _getMessagesMap(){ return JSON.parse(localStorage.getItem('bf_messages') || '{}'); }
function _safeSaveMessagesMap(map){
  try {
    localStorage.setItem('bf_messages', JSON.stringify(map));
  } catch(err){
    // fallback cleanup strategy
    Object.keys(map).forEach(email=>{
      map[email] = (map[email] || []).filter(m => !(m.type === 'image' && String(m.content).length > 300000)).slice(-50);
    });
    try { localStorage.setItem('bf_messages', JSON.stringify(map)); }
    catch(e){ localStorage.setItem('bf_messages', JSON.stringify({})); }
  }
}
function _saveMessagesMap(m){ _safeSaveMessagesMap(m); }
function sendMessageTo(email, sender, type, content){
  const map = _getMessagesMap();
  if(!map[email]) map[email] = [];
  map[email].push({ sender,type,content,time: now() });
  _saveMessagesMap(map);
  localStorage.setItem('bf_messages_updated_at', now());
}

/* ---------- Init defaults ---------- */
(function init(){
  if(!localStorage.getItem('adminAccount')){
    localStorage.setItem('adminAccount', JSON.stringify({
      email: 'arthurebube8@gmail.com',
      password: 'Arthur9$',
      name: 'Administrator',
      role: 'admin'
    }));
  }
  if(!localStorage.getItem('users')) localStorage.setItem('users', JSON.stringify([]));
  if(!localStorage.getItem('bf_messages')) localStorage.setItem('bf_messages', JSON.stringify({}));
  if(!localStorage.getItem('bf_pending_subs')) localStorage.setItem('bf_pending_subs', JSON.stringify([]));
  if(!localStorage.getItem('subscriptionPlans')){
    const plans = [
      {id:'basic', name:'Basic', price:20, features:['Basic courses','Weekly Q&A']},
      {id:'pro', name:'Pro', price:50, features:['All courses','Mentorship','Signals']},
      {id:'vip', name:'VIP', price:100, features:['VIP mentorship','Priority support']}
    ];
    localStorage.setItem('subscriptionPlans', JSON.stringify(plans));
  }
})();

/* ---------- Session helpers ---------- */
function setSession(obj){ obj.active = true; localStorage.setItem('session', JSON.stringify(obj)); }
function getSession(){ return JSON.parse(localStorage.getItem('session') || 'null'); }
function logout(){
  const s = getSession() || {};
  s.active = false;
  localStorage.setItem('session', JSON.stringify(s));
  window.location.href = 'login.html';
}

/* ---------- Auth ---------- */
function registerUser(name,email,password){
  const users = JSON.parse(localStorage.getItem('users')||'[]');
  if(users.find(u=>u.email===email)){ alert("Account exists"); return false; }
  users.push({name,email,password,username: email.split('@')[0],plan:null,status:"Inactive",created: now()});
  localStorage.setItem('users', JSON.stringify(users));
  alert("Account created. Please login.");
  window.location.href = 'login.html';
  return true;
}
function loginUser(email,password){
  const admin = JSON.parse(localStorage.getItem('adminAccount') || '{}');
  if(email === admin.email && password === admin.password){
    setSession({email:admin.email,name:admin.name,role:'admin',active:true});
    window.location.href = 'admin.html'; return;
  }
  const users = JSON.parse(localStorage.getItem('users')||'[]');
  const u = users.find(x=>x.email===email && x.password===password);
  if(!u){ alert("Invalid credentials"); return; }
  setSession({email:u.email,name:u.name,role:'user',active:true});
  window.location.href = 'chat.html';
}

/* ---------- Pending subscriptions ---------- */
function addPendingRequest(obj){
  const arr = JSON.parse(localStorage.getItem('bf_pending_subs') || '[]');
  arr.push(obj);
  localStorage.setItem('bf_pending_subs', JSON.stringify(arr));
  localStorage.setItem('bf_pending_updated_at', now());
}

/* ---------- Global admin actions (exposed) ---------- */
function getUserFromURL(){
  const p = new URLSearchParams(window.location.search);
  return p.get('email');
}
function editUser(){ const email = getUserFromURL(); alert('Edit user coming soon: '+ email); }
function activatePlan(){
  const email = getUserFromURL();
  const users = JSON.parse(localStorage.getItem('users')||'[]');
  const u = users.find(x=>x.email===email);
  if(!u) return alert('User not found');
  u.status = 'Active'; u.subscription = {plan:'Admin Activated', started: now(), method:'admin'};
  localStorage.setItem('users', JSON.stringify(users));
  alert('User activated'); location.reload();
}
function expirePlan(){
  const email = getUserFromURL();
  const users = JSON.parse(localStorage.getItem('users')||'[]');
  const u = users.find(x=>x.email===email); if(!u) return alert('User not found');
  u.status = 'Expired'; u.subscription = null;
  localStorage.setItem('users', JSON.stringify(users)); alert('Plan expired'); location.reload();
}
function deleteUser(){ if(!confirm('Delete this user?')) return; const email=getUserFromURL();
  let users = JSON.parse(localStorage.getItem('users')||'[]'); users = users.filter(x=>x.email!==email);
  localStorage.setItem('users', JSON.stringify(users)); alert('Deleted'); window.location.href='admin-users.html';
}

/* ---------- DOM Ready: single place ---------- */
document.addEventListener('DOMContentLoaded', ()=>{

  const path = window.location.pathname.split('/').pop();
  const sess = getSession();

  // menu toggle if exists
  const menuToggle = qs('menu-toggle');
  if(menuToggle) menuToggle.addEventListener('click', ()=> qs('main-nav')?.classList.toggle('show'));

  // nav-auth and logout button wiring (many pages have nav-auth id)
  const navAuth = qs('nav-auth');
  const logoutBtn = qs('logout-btn');
  if(sess && sess.active){
    if(navAuth){ navAuth.textContent = sess.name || sess.email.split('@')[0]; navAuth.href = sess.role === 'admin' ? 'admin.html' : 'chat.html'; }
    if(logoutBtn){ logoutBtn.classList.remove('hidden'); logoutBtn.addEventListener('click', logout); }
  } else {
    if(navAuth){ navAuth.textContent = 'Sign In'; navAuth.href = 'login.html'; }
    if(logoutBtn) logoutBtn.classList.add('hidden');
  }

  /* ------------------ INDEX ------------------ */
  if(path === '' || path === 'index.html'){
    const y = qs('yr'); if(y) y.textContent = new Date().getFullYear();
  }

/* ------------------ ADMIN SETTINGS → CLIENT LIST (CARD STYLE) ------------------ */

if (path === "admin-settings.html") {
  const body = qs("clients-table-body");
  if (!body) return;

  let users = JSON.parse(localStorage.getItem("users") || "[]");

  if (!users.length) {
    body.innerHTML = `<tr><td><p class="muted">No clients found.</p></td></tr>`;
    return;
  }

  // Convert table rows into card layout
  body.innerHTML = "";

  users.forEach(user => {
    const plan = user.subscription?.plan || "None";
    const status = user.status || "Inactive";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td colspan="5">
        <div class="client-card">
          <h3>${user.name}</h3>
          <p class="muted">${user.email}</p>

          <p><strong>Plan:</strong> ${plan}</p>

          <span class="badge ${status === "Active" ? "badge-active" : "badge-inactive"}">
            ${status}
          </span>

          <div>
            <a href="admin-view-user.html?email=${user.email}" class="btn btn-view primary">
              View User
            </a>
          </div>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

/* ---------------- ADMIN SUBSCRIPTION SETTINGS (FULL CRUD) ---------------- */

if (path === "admin-subscription-settings.html") {

  const wrap = qs("plans-body");
  const addBtn = qs("add-plan-btn");

  function loadPlans() {
    wrap.innerHTML = "";
    const plans = JSON.parse(localStorage.getItem("subscriptionPlans") || "[]");

    plans.forEach((p, index) => {
      const card = document.createElement("div");
      card.className = "plan-card";

      card.innerHTML = `
        <div class="view-mode">
          <h3>${p.name}</h3>
          <div class="price">$${p.price}</div>

          <ul>
            ${p.features.map(f => `<li>${f}</li>`).join("")}
          </ul>

          <button class="btn primary" data-index="${index}" data-act="edit">Edit</button>
          <button class="btn ghost" data-index="${index}" data-act="delete">Delete</button>
        </div>

        <div class="edit-mode" style="display:none;">
          <input class="edit-input" id="edit-name-${index}" value="${p.name}">
          <input class="edit-input" id="edit-price-${index}" type="number" value="${p.price}">
          <textarea class="edit-input" id="edit-features-${index}">${p.features.join("\n")}</textarea>

          <button class="btn primary" data-index="${index}" data-act="save">Save</button>
          <button class="btn ghost" data-index="${index}" data-act="cancel">Cancel</button>
        </div>
      `;

      wrap.appendChild(card);
    });


    /* ALL BUTTON HANDLERS */
    wrap.querySelectorAll("button").forEach(btn => {
      const idx = btn.dataset.index;
      const action = btn.dataset.act;

      btn.onclick = () => {
        const plans = JSON.parse(localStorage.getItem("subscriptionPlans") || "[]");

        if (action === "edit") {
          const card = btn.closest(".plan-card");
          card.querySelector(".view-mode").style.display = "none";
          card.querySelector(".edit-mode").style.display = "block";
        }

        if (action === "cancel") {
          const card = btn.closest(".plan-card");
          card.querySelector(".view-mode").style.display = "block";
          card.querySelector(".edit-mode").style.display = "none";
        }

        if (action === "delete") {
          if (!confirm("Delete this plan?")) return;
          plans.splice(idx, 1);
          localStorage.setItem("subscriptionPlans", JSON.stringify(plans));
          loadPlans();
        }

        if (action === "save") {
          const name = qs(`edit-name-${idx}`).value.trim();
          const price = qs(`edit-price-${idx}`).value.trim();
          const feats = qs(`edit-features-${idx}`).value.trim().split("\n");

          plans[idx].name = name;
          plans[idx].price = price;
          plans[idx].features = feats;

          localStorage.setItem("subscriptionPlans", JSON.stringify(plans));
          loadPlans();
        }
      };
    });
  }


  /* ADD NEW PLAN */
  addBtn.onclick = () => {
    const name = qs("new-name").value.trim();
    const price = qs("new-price").value.trim();
    const feats = qs("new-features").value.trim().split("\n");

    if (!name || !price) return alert("Fill all fields");

    const plans = JSON.parse(localStorage.getItem("subscriptionPlans") || "[]");

    plans.push({
      id: name.toLowerCase(),
      name,
      price,
      features: feats
    });

    localStorage.setItem("subscriptionPlans", JSON.stringify(plans));

    qs("new-name").value = "";
    qs("new-price").value = "";
    qs("new-features").value = "";

    loadPlans();
  };


  loadPlans();
}
/* ----- COURSE CLICK → SEND TO CHAT ----- */
if (path === "courses.html") {
  const sess = getSession();
  const wrap = qs("coursesWrap");

  wrap.innerHTML = "";
  const courses = JSON.parse(localStorage.getItem("courses") || "[]");

  courses.forEach(c => {
    const card = document.createElement("article");
    card.className = "panel course-card";

    card.innerHTML = `
      <h3>${c.title}</h3>
      <p class="muted">${c.description}</p>
      <button class="btn primary view-course" 
              data-title="${c.title}" 
              data-desc="${c.description}">
        View
      </button>
    `;

    wrap.appendChild(card);
  });

  document.querySelectorAll(".view-course").forEach(btn => {
    btn.onclick = () => {
      if (!sess || sess.role !== "user") {
        alert("Please sign in.");
        window.location.href = "login.html";
        return;
      }

      const title = btn.dataset.title;
      const desc = btn.dataset.desc;

      const text = `📘 *Course Request*\n*${title}*\n${desc}`;

      sendMessageTo(sess.email, "user", "text", text);

      window.location.href = "chat.html";
    };
  });
}
/* ------------------ ADMIN PROFILE PAGE ------------------ */
if (path === "admin-profile.html") {

  const admin = JSON.parse(localStorage.getItem("adminAccount") || "{}");

  const nameInput = qs("adminNameInput");
  const emailInput = qs("adminEmailInput");
  const passInput = qs("adminPasswordInput");
  const saveBtn = qs("saveAdminProfile");

  // Load current values
  if (nameInput) nameInput.value = admin.name || "";
  if (emailInput) emailInput.value = admin.email || "";

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const newName = nameInput.value.trim();
      const newEmail = emailInput.value.trim();
      const newPass = passInput.value.trim();

      if (!newName || !newEmail) {
        alert("Name and email cannot be empty.");
        return;
      }

      // Update admin account
      admin.name = newName;
      admin.email = newEmail;
      if (newPass !== "") admin.password = newPass;

      localStorage.setItem("adminAccount", JSON.stringify(admin));
      alert("Profile updated successfully!");
      passInput.value = "";
    });
  }
}
/* ---------------- ADMIN COURSE MANAGER (CRUD) ---------------- */

if (path === "admin-courses.html") {

  const wrap = qs("courses-body");
  const addBtn = qs("add-course-btn");

  function loadCourses() {
    wrap.innerHTML = "";
    const courses = JSON.parse(localStorage.getItem("courses") || "[]");

    courses.forEach((c, index) => {

      const card = document.createElement("div");
      card.className = "course-card";

      card.innerHTML = `
        <div class="view-mode">
          <h3>${c.title}</h3>
          <p class="muted">${c.description}</p>

          <button class="btn primary" data-act="edit" data-index="${index}">Edit</button>
          <button class="btn ghost" data-act="delete" data-index="${index}">Delete</button>
        </div>

        <div class="edit-mode" style="display:none;">
          <input class="edit-input" id="course-title-${index}" value="${c.title}">
          <textarea class="edit-input" id="course-desc-${index}">${c.description}</textarea>

          <button class="btn primary" data-act="save" data-index="${index}">Save</button>
          <button class="btn ghost" data-act="cancel" data-index="${index}">Cancel</button>
        </div>
      `;

      wrap.appendChild(card);
    });

    // ACTION BUTTONS
    wrap.querySelectorAll("button").forEach(btn => {
      const idx = btn.dataset.index;
      const action = btn.dataset.act;

      let courses = JSON.parse(localStorage.getItem("courses") || "[]");

      btn.onclick = () => {

        if (action === "edit") {
          const card = btn.closest(".course-card");
          card.querySelector(".view-mode").style.display = "none";
          card.querySelector(".edit-mode").style.display = "block";
        }

        if (action === "cancel") {
          const card = btn.closest(".course-card");
          card.querySelector(".view-mode").style.display = "block";
          card.querySelector(".edit-mode").style.display = "none";
        }

        if (action === "delete") {
          if (!confirm("Delete this course?")) return;
          courses.splice(idx, 1);
          localStorage.setItem("courses", JSON.stringify(courses));
          loadCourses();
        }

        if (action === "save") {
          const newTitle = qs(`course-title-${idx}`).value.trim();
          const newDesc = qs(`course-desc-${idx}`).value.trim();

          if (!newTitle || !newDesc) return alert("All fields required.");

          courses[idx].title = newTitle;
          courses[idx].description = newDesc;

          localStorage.setItem("courses", JSON.stringify(courses));
          loadCourses();
        }
      };
    });
  }

  /* ADD NEW COURSE */
  addBtn.onclick = () => {
    const title = qs("new-course-name").value.trim();
    const desc = qs("new-course-desc").value.trim();

    if (!title || !desc) return alert("All fields required.");

    const courses = JSON.parse(localStorage.getItem("courses") || "[]");

    courses.push({ title, description: desc });

    localStorage.setItem("courses", JSON.stringify(courses));

    qs("new-course-name").value = "";
    qs("new-course-desc").value = "";

    loadCourses();
  };

  loadCourses();
}

  /* ------------------ LOGIN ------------------ */
  if(path === 'login.html'){
    const form = qs('loginForm');
    if(form) form.addEventListener('submit', e=>{ e.preventDefault(); loginUser(qs('loginEmail').value.trim(), qs('loginPassword').value); });
  }

  /* ------------------ REGISTER ------------------ */
  if(path === 'register.html'){
    const form = qs('register-form');
    if(form) form.addEventListener('submit', e=>{ e.preventDefault();
      registerUser(qs('r-name').value.trim(), qs('r-email').value.trim(), qs('r-password').value);
    });
  }

  /* ------------------ USER CHAT ------------------ */
  if(path === 'chat.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ alert('Please sign in as user.'); window.location.href='login.html'; return; }
    const messagesEl = qs('messages'), input = qs('messageInput'), fileInput = qs('fileInput'), fileBtn = qs('fileBtn'), sendBtn = qs('sendBtn');
    const welcomeKey = 'welcome_'+sess.email;
    if(!localStorage.getItem(welcomeKey)){ sendMessageTo(sess.email,'admin','text','Welcome! How can I assist you today?'); localStorage.setItem(welcomeKey,'1'); }

    function render(){
      messagesEl.innerHTML = '';
      const list = _getMessagesMap()[sess.email] || [];
      list.forEach(m=>{
        const d = document.createElement('div'); d.className = 'msg ' + (m.sender === 'admin' ? 'received' : 'sent');
        if(m.type === 'image'){ d.innerHTML = `<img class="chat-img" src="${m.content}">`; } else { d.textContent = m.content; }
        messagesEl.appendChild(d);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    render();
    window.addEventListener('storage', e=>{ if(e.key === 'bf_messages_updated_at') render(); });

    if(fileBtn && fileInput){
      fileBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', e=>{
        const f = e.target.files[0]; if(!f) return;
        const reader = new FileReader();
        reader.onload = ev => compressImage(ev.target.result, 0.35, compressed=>{
          sendMessageTo(sess.email,'user','image',compressed); render();
        });
        reader.readAsDataURL(f); fileInput.value = '';
      });
    }
    if(sendBtn){
      sendBtn.addEventListener('click', ()=>{
        const v = (input.value||'').trim(); if(!v) return;
        sendMessageTo(sess.email,'user','text',v); input.value=''; render();
      });
    }
  }

  /* ------------------ ADMIN CHAT ------------------ */
  if(path === 'admin-chat.html'){
    if(!sess || sess.role !== 'admin' || !sess.active){ alert('Please sign in as admin.'); window.location.href='login.html'; return; }
    const usersListEl = qs('usersList'), messagesEl = qs('adminMessages'), input = qs('adminMessageInput'), sendBtn = qs('adminSendBtn'), fileBtn = qs('adminFileBtn'), fileInput = qs('adminFileInput'), titleEl = qs('adminChatTitle');
    let activeUser = null;

    function loadUsers(){
      usersListEl.innerHTML = '';
      const map = _getMessagesMap();
      const stored = JSON.parse(localStorage.getItem('users')||'[]');
      const emails = Array.from(new Set([ ...Object.keys(map), ...stored.map(u=>u.email) ]));
      const arr = emails.map(email=>{
        const user = stored.find(u=>u.email===email);
        const name = user ? user.name : email.split('@')[0];
        const msgs = map[email] || []; const last = msgs.length ? msgs[msgs.length-1].time : 0;
        return {email,name,last};
      }).sort((a,b)=>b.last - a.last);
      arr.forEach(u=>{
        const div = document.createElement('div'); div.className = 'user-item'; div.dataset.email = u.email;
        div.innerHTML = `<strong>${u.name}</strong><div class="muted">${u.email}</div>`;
        div.onclick = ()=>{ [...usersListEl.children].forEach(c=>c.classList.remove('active')); div.classList.add('active'); loadChatFor(u.email); };
        usersListEl.appendChild(div);
      });
    }

    function loadChatFor(email){
      activeUser = email; titleEl.textContent = email;
      input.disabled = false; sendBtn.disabled = false; fileBtn.disabled = false;
      messagesEl.innerHTML = '';
      const list = _getMessagesMap()[email] || [];
      list.forEach(m=>{
        const d = document.createElement('div'); d.className = 'msg ' + (m.sender === 'user' ? 'received' : 'admin');
        if(m.type === 'image') d.innerHTML = `<img class="chat-img" src="${m.content}">`; else d.textContent = m.content;
        messagesEl.appendChild(d);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    sendBtn.onclick = ()=>{ if(!activeUser) return alert('Select a user'); const t = (input.value||'').trim(); if(!t) return; sendMessageTo(activeUser,'admin','text',t); input.value=''; loadChatFor(activeUser); };

    fileBtn.onclick = ()=> fileInput.click();
    fileInput.onchange = e=>{
      if(!activeUser) return alert('Select a user first');
      const f = e.target.files[0]; if(!f) return;
      const r = new FileReader();
      r.onload = ev => compressImage(ev.target.result, 0.35, compressed=>{ sendMessageTo(activeUser,'admin','image',compressed); loadChatFor(activeUser); });
      r.readAsDataURL(f); fileInput.value = '';
    };

    window.addEventListener('storage', e=>{ if(e.key === 'bf_messages_updated_at'){ loadUsers(); if(activeUser) loadChatFor(activeUser); } });
    loadUsers();
  }

  /* ------------------ SUBSCRIPTION (user) ------------------ */
  if(path === 'subscription.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ alert('Please login first'); window.location.href='login.html'; return; }
    const wrap = qs('plansWrap');
    const plans = JSON.parse(localStorage.getItem('subscriptionPlans')||'[]');
    wrap.innerHTML = '';
    plans.forEach(p=>{
      const art = document.createElement('article'); art.className = 'plan';
      art.innerHTML = `<h3>${p.name}</h3><p class="price">$${p.price}</p><ul>${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
        <button class="btn primary choosePlanBtn" data-id="${p.id}" data-price="${p.price}">Select ${p.name}</button>`;
      wrap.appendChild(art);
    });
    document.querySelectorAll('.choosePlanBtn').forEach(b => b.addEventListener('click', e=>{
      const plan = e.currentTarget.dataset.id, price = e.currentTarget.dataset.price;
      sessionStorage.setItem('selectedPlan', JSON.stringify({plan,price}));
      window.location.href = 'payment.html';
    }));
  }

  /* ------------------ PAYMENT (user) ------------------ */
  if(path === 'payment.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ alert('Please login first'); window.location.href='login.html'; return; }
    const sel = JSON.parse(sessionStorage.getItem('selectedPlan') || '{}');
    if(!sel.plan){ alert('Pick a plan'); window.location.href='subscription.html'; return; }
    const submit = qs('submitPaymentBtn');
    if(submit) submit.addEventListener('click', ()=>{
      const file = qs('proof-file').files[0]; const desc = (qs('paymentDescription')?.value||'').trim();
      if(!file) return alert('Upload payment proof.');
      const reader = new FileReader();
      reader.onload = ev=>{
        compressImage(ev.target.result, 0.5, compressed=>{
          const pay = { id: 'SUB-'+now(), userEmail: sess.email, userName: sess.name, plan: sel.plan, price: sel.price, description: desc, proof: compressed, status:'pending', created:now() };
          addPendingRequest(pay);
          alert('Payment submitted. Await admin approval.');
          window.location.href = 'user-pending.html';
        });
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------ USER PENDING (live check) ------------------ */
  if(path === 'user-pending.html'){
    if(!sess || sess.role !== 'user' || !sess.active){ window.location.href='login.html'; return; }
    const box = qs('pendingBox');
    function poll(){
      const arr = JSON.parse(localStorage.getItem('bf_pending_subs')||'[]');
      const req = arr.find(x=>x.userEmail===sess.email && x.status!=='resolved');
      if(!req){ box.innerHTML = '<p>No pending request</p>'; return; }
      if(req.status === 'approved'){ box.innerHTML = `<h2>Payment Approved</h2><div class="big-check">✔</div><p>Your subscription is now active.</p>`; setTimeout(()=>window.location.href='chat.html',2000); }
      else if(req.status === 'rejected'){ box.innerHTML = `<h2>Payment Rejected</h2><p>Please contact admin.</p>`; }
      else { box.innerHTML = `<h2>Pending</h2><p>Your payment is being reviewed.</p>`; }
    }
    poll(); setInterval(poll,3000);
  }

  /* ------------------ ADMIN PAYMENTS ------------------ */
  if(path === 'admin-payments.html'){
    if(!sess || sess.role !== 'admin' || !sess.active){ window.location.href='login.html'; return; }
    const wrap = qs('adminPendingWrap');
    function render(){
      wrap.innerHTML = ''; const arr = JSON.parse(localStorage.getItem('bf_pending_subs')||'[]');
      const pending = arr.filter(x=>x.status==='pending');
      if(!pending.length) wrap.innerHTML = '<p class="muted">No pending payments</p>';
      pending.forEach(item=>{
        const div = document.createElement('div'); div.className = 'panel';
        div.innerHTML = `<h4>${item.userName}</h4><div class="muted">${item.userEmail}</div><p>Plan: ${item.plan} — $${item.price}</p><p>${item.description||''}</p>
          <div style="margin-top:8px"><img src="${item.proof}" style="max-width:260px;border-radius:8px"></div>
          <div style="margin-top:8px"><button class="btn" data-id="${item.id}" data-act="approve">Approve</button> <button class="btn ghost" data-id="${item.id}" data-act="reject">Reject</button></div>`;
        wrap.appendChild(div);
      });
      wrap.querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>{
        const id = b.dataset.id, act = b.dataset.act;
        const arr2 = JSON.parse(localStorage.getItem('bf_pending_subs')||'[]');
        const updated = arr2.map(it=>{
          if(it.id === id){ it.status = act === 'approve' ? 'approved' : 'rejected'; it.updatedAt = now();
            if(act === 'approve'){ // update user's subscription record
              const users = JSON.parse(localStorage.getItem('users')||'[]');
              const idx = users.findIndex(u => u.email === it.userEmail);
              if(idx > -1){ users[idx].subscription = {plan:it.plan, started: now(), method: it.method || 'bank'}; users[idx].status = 'Active'; localStorage.setItem('users', JSON.stringify(users)); }
            }
          }
          return it;
        });
        localStorage.setItem('bf_pending_subs', JSON.stringify(updated));
        localStorage.setItem('bf_pending_updated_at', now());
        render();
      }));
    }
    render();
    window.addEventListener('storage', e=>{ if(e.key === 'bf_pending_updated_at') render(); });
  }

  /* ------------------ ADMIN USERS PAGE ------------------ */
if (path === "admin-users.html") {

    const box = document.getElementById("adminUsersTable");
    if (!box) return;  // <--- fixes the null error forever

    const users = JSON.parse(localStorage.getItem("users") || "[]");

    if (!users.length) {
        box.innerHTML = `<p class="muted">No users found.</p>`;
        return;
    }

    box.innerHTML = "";

    users.forEach(u => {
        const sub = u.subscription ? u.subscription.plan.toUpperCase() : "None";
        const status = u.status === "Active" ? "badge-active" : "badge-inactive";

        const card = document.createElement("div");
        card.className = "user-card";

        card.innerHTML = `
            <h3>${u.name}</h3>
            <div class="muted">${u.email}</div>

            <p><strong>Plan:</strong> ${sub}</p>
            <span class="user-badge ${status}">
              ${u.status || "Inactive"}
            </span>

            <br><br>
            <a href="admin-view-user.html?email=${u.email}" class="btn small">
              View User
            </a>
        `;

        box.appendChild(card);
    });
}

  /* ------------------ ADMIN VIEW USER PAGE POPULATION ------------------ */
  if(path === 'admin-view-user.html'){
    const email = getUserFromURL();
    if(!email) return alert('No user email provided in URL');
    const users = JSON.parse(localStorage.getItem('users')||'[]');
    const u = users.find(x=>x.email === email);
    if(!u) return alert('User not found');
    qs('user-name').textContent = u.name || '';
    qs('user-email').textContent = u.email || '';
    qs('user-username').textContent = u.username || '';
    qs('user-plan').textContent = u.subscription?.plan || 'None';
    qs('user-status').textContent = u.status || 'Inactive';
  }

}); // DOMContentLoaded end