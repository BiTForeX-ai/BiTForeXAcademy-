/* script.js - Unified controller (Firebase-backed)
   - Expects firebase.js to have run and to expose window.auth & window.db.
   - Waits for 'fb-ready' event before using auth/db.
   - Keeps previous localStorage fallback and migrates old local users to Firestore on first run.
*/

/* ---------------- small helpers ---------------- */
const $ = id => document.getElementById(id);
const now = () => Date.now();
function safeJSON(k, fallback){ try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch(e){ return fallback; } }
function saveJSON(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ console.warn("save failed",k,e); } }

/* --------------- wait for firebase ready --------------- */
function onFirebaseReady(cb){
  if(window.fb && window.auth && window.db) return cb();
  document.addEventListener('fb-ready', (ev)=>{
    if(ev.detail && ev.detail.ok) cb();
    else console.error("Firebase failed to init", ev.detail && ev.detail.err);
  });
}

/* --------------- session helpers (local) --------------- */
function setSession(obj){
  obj.active = true;
  saveJSON('session', obj);
}
function getSession(){
  return safeJSON('session', null);
}
function clearSession(){
  localStorage.removeItem('session');
}

/* --------------- migration: localStorage users -> Firestore --------------- */
async function migrateLocalUsersToFirestore(){
  // only if Firestore has no users yet but localStorage has some
  const localUsers = safeJSON('users', []);
  if(!localUsers.length) return;
  const snap = await db.collection('users').limit(1).get();
  if(!snap.empty) return; // already have remote users
  // create docs
  for(const u of localUsers){
    try {
      // try to create a record keyed by email (document id encoded)
      const id = btoa(u.email).replace(/=/g,'');
      await db.collection('users').doc(id).set({
        name: u.name || u.username || u.email.split('@')[0],
        email: u.email,
        createdAt: u.created || now(),
        status: u.status || 'Inactive',
        username: u.username || (u.email.split('@')[0]),
        subscription: u.subscription || null,
        legacy: true
      });
    } catch(e){ console.warn("migrate user failed",u.email,e); }
  }
  console.log("migration complete");
}

/* --------------- auth actions using Firebase --------------- */
function attachAuthForms(){
  // login form
  const loginForm = $('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const email = ($('loginEmail').value || '').trim();
      const pw = ($('loginPassword').value || '').trim();
      if(!email || !pw) return alert('Enter email & password');

      try {
        const res = await auth.signInWithEmailAndPassword(email, pw);
        const uid = res.user.uid;
        // try to read profile in users collection by uid; if not, attempt to read doc by encoded email
        let doc = await db.collection('users').doc(uid).get();
        let profile = doc.exists ? doc.data() : null;
        if(!profile){
          const id = btoa(email).replace(/=/g,'');
          const doc2 = await db.collection('users').doc(id).get();
          if(doc2.exists) profile = doc2.data();
        }
        if(!profile){
          // fallback minimal profile
          profile = { name: email.split('@')[0], email };
          // create a doc keyed by uid
          await db.collection('users').doc(uid).set(profile);
        }
        setSession({ uid, email, name: profile.name || email.split('@')[0], role: (email === 'arthurebube8@gmail.com' ? 'admin' : 'user') });
        if(email === 'arthurebube8@gmail.com') window.location.href = 'admin.html';
        else window.location.href = 'chat.html';
      } catch(err){
        alert('Login error: ' + (err.message || err));
      }
    });
  }

  // register form
  const regForm = $('registerForm') || $('register-form') || $('register-form');
  if(regForm){
    regForm.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const name = ($('r-name').value || '').trim();
      const email = ($('r-email').value || '').trim();
      const pw = ($('r-password').value || '').trim();
      if(!email || !pw) return alert('Fill all fields');
      try{
        // create auth account
        const res = await auth.createUserWithEmailAndPassword(email, pw);
        const uid = res.user.uid;
        // create user doc
        const profile = { name: name || email.split('@')[0], email, createdAt: now(), status: 'Inactive' };
        await db.collection('users').doc(uid).set(profile);
        // notify admin (create notification)
        await db.collection('notifications').add({ title: 'New user', message: `${profile.name} registered (${email})`, userEmail: email, read: false, type:'new_user', createdAt: now() });
        alert('Account created. Please login.');
        window.location.href = 'login.html';
      } catch(err){
        alert('Register error: ' + (err.message || err));
      }
    });
  }

  // forgot password form (two behaviors: reveal legacy localStorage password for demo; otherwise Firebase reset)
  const forgotForm = $('forgotForm');
  if(forgotForm){
    forgotForm.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const email = ($('forgotEmail').value || '').trim().toLowerCase();
      if(!email) return alert('Enter your email');

      // check legacy localStorage users first (demo mode)
      const localUsers = safeJSON('users', []);
      const legacyUser = localUsers.find(u => (u.email || '').toLowerCase() === email);
      if(legacyUser){
        // demo reveal (ONLY for migrated/local accounts)
        if(confirm(`Account found for ${legacyUser.name || email}. Reveal password? (Demo)`)){
          alert(`Demo: password for ${email} is: ${legacyUser.password}`);
        }
        return;
      }

      // otherwise send firebase password reset
      try {
        await auth.sendPasswordResetEmail(email);
        alert('Password reset email sent if there is an account registered with that email.');
      } catch(err){
        alert('Reset error: ' + (err.message || err));
      }
    });
  }
}

/* --------------- chat + notifications behavior --------------- */
function attachChatBehavior(){
  // utility - render messages in a container for an email
  async function renderMessagesFor(containerEl, userEmail){
    if(!containerEl) return;
    containerEl.innerHTML = '';
    const q = db.collection('messages').where('userEmail','==', userEmail).orderBy('time','asc');
    const snap = await q.get();
    snap.forEach(doc=>{
      const m = doc.data();
      const div = document.createElement('div');
      div.className = 'msg ' + (m.sender === 'admin' ? 'received' : 'sent');
      if(m.type === 'image'){
        div.innerHTML = `<img class="chat-img" src="${m.content}" alt="img">`;
      } else {
        div.textContent = m.text || m.content || '';
      }
      containerEl.appendChild(div);
    });
    containerEl.scrollTop = containerEl.scrollHeight;
  }

  // USER CHAT page (chat.html)
  if(location.pathname.endsWith('chat.html') || location.pathname.endsWith('/chat.html')){
    const sess = getSession();
    if(!sess || sess.role !== 'user') return window.location.href = 'login.html';
    const messagesEl = $('messages');
    const input = $('messageInput');
    const sendBtn = $('sendBtn');
    const fileBtn = $('fileBtn');
    const fileInput = $('fileInput');

    // realtime listen
    db.collection('messages').where('userEmail','==', sess.email).orderBy('time','asc')
      .onSnapshot(snapshot=>{
        messagesEl.innerHTML = '';
        snapshot.forEach(doc=>{
          const m = doc.data();
          const d = document.createElement('div');
          d.className = 'msg ' + (m.sender === 'admin' ? 'received' : 'sent');
          if(m.type === 'image') d.innerHTML = `<img class="chat-img" src="${m.content}" alt="img">`;
          else d.textContent = m.text || m.content || '';
          messagesEl.appendChild(d);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });

    if(sendBtn){
      sendBtn.addEventListener('click', async ()=>{
        const txt = (input.value || '').trim();
        if(!txt) return;
        await db.collection('messages').add({ userEmail: sess.email, sender: 'user', text: txt, type:'text', time: now() });
        // notify admin
        await db.collection('notifications').add({ title: 'New message', message: `${sess.name} sent a message`, userEmail: sess.email, read: false, type:'message', createdAt: now() });
        input.value = '';
      });
    }

    if(fileBtn && fileInput){
      fileBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', async (e)=>{
        const file = e.target.files && e.target.files[0];
        if(!file) return;
        const r = new FileReader();
        r.onload = async ev=>{
          // store as base64 (ok for demo). In production use Firebase Storage.
          await db.collection('messages').add({ userEmail: sess.email, sender: 'user', content: ev.target.result, type:'image', time: now() });
          await db.collection('notifications').add({ title: 'New image', message: `${sess.name} sent an image`, userEmail: sess.email, read: false, type:'message', createdAt: now() });
        };
        r.readAsDataURL(file);
        fileInput.value = '';
      });
    }
  }

  // ADMIN CHAT page (admin-chat.html)
  if(location.pathname.endsWith('admin-chat.html') || location.pathname.endsWith('/admin-chat.html')){
    const sess = getSession();
    if(!sess || sess.role !== 'admin') return window.location.href = 'login.html';
    const usersListEl = $('usersList') || $('admin-contact-list') || $('adminUserList');
    const messagesEl = $('adminMessages');
    const input = $('adminMessageInput');
    const sendBtn = $('adminSendBtn') || $('adminSend');
    const fileBtn = $('adminFileBtn');
    const fileInput = $('adminFileInput');
    const titleEl = $('adminChatTitle');

    // load users list (real-time)
    db.collection('users').onSnapshot(snapshot=>{
      if(!usersListEl) return;
      usersListEl.innerHTML = '';
      snapshot.forEach(doc=>{
        const u = doc.data();
        const el = document.createElement('div');
        el.className = 'user-item';
        el.dataset.email = u.email;
        el.innerHTML = `<strong>${u.name||u.email.split('@')[0]}</strong><div class="muted">${u.email}</div>`;
        el.addEventListener('click', ()=> openChat(u.email, u.name));
        usersListEl.appendChild(el);
      });
    });

    let active = null;
    function openChat(email, name){
      active = email;
      if(titleEl) titleEl.textContent = name || email;
      // realtime messages
      db.collection('messages').where('userEmail','==', email).orderBy('time','asc')
        .onSnapshot(snapshot=>{
          messagesEl.innerHTML = '';
          snapshot.forEach(doc=>{
            const m = doc.data();
            const d = document.createElement('div');
            d.className = 'msg ' + (m.sender === 'user' ? 'received' : 'admin');
            if(m.type === 'image') d.innerHTML = `<img class="chat-img" src="${m.content}" alt="img">`;
            else d.textContent = m.text || m.content || '';
            messagesEl.appendChild(d);
          });
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }

    if(sendBtn){
      sendBtn.addEventListener('click', async ()=>{
        if(!active) return alert('Select a user to reply');
        const txt = (input.value || '').trim(); if(!txt) return;
        await db.collection('messages').add({ userEmail: active, sender: 'admin', text: txt, type:'text', time: now() });
        await db.collection('notifications').add({ title: 'Admin replied', message: `Admin replied to ${active}`, userEmail: active, read: false, type:'message', createdAt: now() });
        input.value = '';
      });
    }
    if(fileBtn && fileInput){
      fileBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', async e=>{
        if(!active) return alert('Select a user first');
        const f = e.target.files && e.target.files[0]; if(!f) return;
        const r = new FileReader();
        r.onload = async ev=>{
          await db.collection('messages').add({ userEmail: active, sender:'admin', content: ev.target.result, type:'image', time: now() });
          await db.collection('notifications').add({ title: 'Admin image', message: `Admin sent an image to ${active}`, userEmail: active, read:false, type:'message', createdAt: now() });
        };
        r.readAsDataURL(f);
        fileInput.value = '';
      });
    }
  }

  // Notifications wiring (admin dashboard & user chat)
  if(location.pathname.endsWith('admin.html') || location.pathname.endsWith('/admin.html')){
    const sess = getSession();
    if(!sess || sess.role !== 'admin') return;
    const bell = $('notifBell');
    const count = $('notifCount');
    const panel = $('notifPanel');
    const list = $('notifList');

    if(bell) bell.addEventListener('click', ()=> panel.classList.toggle('hidden'));

    // admin sees all unread notifications
    db.collection('notifications').where('read','==', false).orderBy('createdAt','desc')
      .onSnapshot(snapshot=>{
        const c = snapshot.size;
        if(count) {
          if(c > 0){ count.classList.remove('hidden'); count.textContent = c; }
          else { count.classList.add('hidden'); }
        }
        if(list) {
          list.innerHTML = '';
          snapshot.forEach(doc=>{
            const n = doc.data();
            const p = document.createElement('p');
            p.className = 'notif-item unread';
            p.innerHTML = `<strong>${n.title}</strong><div class="muted">${n.message}</div>`;
            p.addEventListener('click', ()=> {
              doc.ref.update({ read:true });
              p.classList.remove('unread');
            });
            list.appendChild(p);
          });
        }
      });
  }

  // user notifications in chat page (listens to notifications addressed to them)
  if(location.pathname.endsWith('chat.html')){
    const sess = getSession();
    if(!sess || sess.role !== 'user') return;
    // show alert for unread notifications for this user
    db.collection('notifications').where('userEmail','==', sess.email).where('read','==', false)
      .onSnapshot(snapshot=>{
        snapshot.forEach(doc=>{
          const n = doc.data();
          alert(`🔔 ${n.title}\n\n${n.message}`);
          doc.ref.update({ read: true });
        });
      });
  }

}

/* --------------- payments / subscriptions / admin pages --------------- */
function attachAdminPagesBehavior(){
  // admin payments page: approve/reject pending payments
  if(location.pathname.endsWith('admin-payments.html') || location.pathname.endsWith('/admin-payments.html')){
    const wrap = $('adminPendingWrap') || $('payments-tbody');
    if(!wrap) return;
    // listen for pending
    db.collection('bf_pending_subs').orderBy('created','desc').onSnapshot(snapshot=>{
      // re-render
      (async ()=>{
        wrap.innerHTML = '';
        const arr = await db.collection('bf_pending_subs').get();
        arr.forEach(doc=>{
          const it = doc.data();
          if(it.status !== 'pending') return;
          if(wrap.tagName && wrap.tagName.toLowerCase() === 'tbody'){
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${it.userName}</td><td>${it.plan}</td><td>$${it.price}</td>
              <td><img src="${it.proof}" style="max-width:120px;border-radius:6px"></td>
              <td>
                <button data-id="${doc.id}" class="approve">Approve</button>
                <button data-id="${doc.id}" class="reject">Reject</button>
              </td>`;
            wrap.appendChild(tr);
          } else {
            const div = document.createElement('div');
            div.className = 'panel';
            div.innerHTML = `<h4>${it.userName}</h4><div class="muted">${it.userEmail}</div>
              <p>Plan: ${it.plan} — $${it.price}</p><img src="${it.proof}" style="max-width:260px">
              <div><button data-id="${doc.id}" class="approve">Approve</button> <button data-id="${doc.id}" class="reject">Reject</button></div>`;
            wrap.appendChild(div);
          }
        });
        // attach handlers
        wrap.querySelectorAll('button.approve, button.reject').forEach(b=>{
          b.onclick = async ()=>{
            const id = b.dataset.id;
            const action = b.classList.contains('approve') ? 'approved' : 'rejected';
            await db.collection('bf_pending_subs').doc(id).update({ status: action, updatedAt: now() });
            // if approved, update user record
            if(action === 'approved'){
              const doc = await db.collection('bf_pending_subs').doc(id).get();
              const it = doc.data();
              // find user doc by encoded email or uid
              const q = await db.collection('users').where('email','==', it.userEmail).get();
              if(!q.empty){
                q.forEach(async ud => {
                  await ud.ref.update({ subscription: { plan: it.plan, started: now() }, status: 'Active' });
                });
              }
              // notify user about approval
              await db.collection('notifications').add({ title: 'Payment Approved', message: `Your payment for ${it.plan} is approved.`, userEmail: it.userEmail, read: false, type:'payment', createdAt: now() });
            }
          };
        });
      })();
    });
  }

  // admin users list page count update on admin dashboard
  if(location.pathname.endsWith('admin.html')){
    // counts for dashboard
    db.collection('users').get().then(snap=>{
      const total = snap.size;
      const active = snap.docs.filter(d => (d.data().status || '').toLowerCase() === 'active').length;
      const pending = safeJSON('bf_pending_subs', []).length; // local fallback
      const unreadMessages = 0; // advanced: calculate cross-collection
      if($('count-users')) $('count-users').textContent = total;
      if($('count-active')) $('count-active').textContent = active;
      if($('count-pending')) $('count-pending').textContent = pending;
      if($('count-messages')) $('count-messages').textContent = unreadMessages;
    });
  }

}

/* --------------- init sequence --------------- */
onFirebaseReady(async ()=>{
  try {
    // try migration once
    await migrateLocalUsersToFirestore();
  } catch(e){ console.warn("migration err",e); }

  // connect forms & pages
  attachAuthForms();
  attachChatBehavior();
  attachAdminPagesBehavior();

  // basic navbar toggle (makes nav vertical dropdown on small screens via CSS show class)
  const toggle = $('menu-toggle') || $('hamburger');
  if(toggle){
    toggle.addEventListener('click', ()=> $('main-nav')?.classList.toggle('show'));
  }
});
