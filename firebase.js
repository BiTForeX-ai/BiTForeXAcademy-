<!-- firebase.js
  - Drop this file in your site and include it BEFORE script.js:
    <script src="firebase.js"></script>
    <script src="script.js"></script>
-->
<script>
// firebase.js: dynamically load firebase compat SDKs, init Firestore & Auth, expose auth/db and fire "fb-ready"
(function(){
  // Replace this config if you later switch projects
  const firebaseConfig = {
    apiKey: "AIzaSyBFfzetzI_sFXu58jSil1Sh2LnQrpgLNFE",
    authDomain: "bitforex-academy.firebaseapp.com",
    projectId: "bitforex-academy",
    storageBucket: "bitforex-academy.firebasestorage.app",
    messagingSenderId: "523261484934",
    appId: "1:523261484934:web:0370b1c43f8891035c9607"
  };

  const libs = [
    "https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"
  ];

  let loaded = 0;
  function loader(url, cb){
    const s = document.createElement('script');
    s.src = url;
    s.onload = cb;
    s.onerror = ()=>{ console.error("Failed to load", url); cb(); };
    document.head.appendChild(s);
  }

  function initFirebase(){
    if(!window.firebase) {
      console.error("Firebase global missing");
      document.dispatchEvent(new CustomEvent('fb-ready', {detail:{ok:false}}));
      return;
    }
    try {
      firebase.initializeApp(firebaseConfig);
      window.fb = firebase;
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      // small Firestore rule: enable timestamps in snapshots if needed
      document.dispatchEvent(new CustomEvent('fb-ready', {detail:{ok:true}}));
      console.log("Firebase initialized");
    } catch(e){
      console.error("Firebase init error", e);
      document.dispatchEvent(new CustomEvent('fb-ready', {detail:{ok:false,err:e}}));
    }
  }

  // load sequentially
  (function loadAll(i){
    if(i >= libs.length){ initFirebase(); return; }
    loader(libs[i], ()=> loadAll(i+1));
  })(0);

})();
</script>
