<!-- firebase.js -->
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>

<script>
  const firebaseConfig = {
    apiKey: "AIzaSyBFfzetzI_sFXu58jSil1Sh2LnQrpgLNFE",
    authDomain: "bitforex-academy.firebaseapp.com",
    projectId: "bitforex-academy",
    storageBucket: "bitforex-academy.firebasestorage.app",
    messagingSenderId: "523261484934",
    appId: "1:523261484934:web:0370b1c43f8891035c9607"
  };

  firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();
</script>
