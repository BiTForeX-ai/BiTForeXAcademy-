// firebase.js  (NO <script> TAGS, NO import)


// Load Firebase global namespace
const firebaseApp = document.createElement("script");
firebaseApp.src = "https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js";
document.head.appendChild(firebaseApp);

const firebaseAuth = document.createElement("script");
firebaseAuth.src = "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js";
document.head.appendChild(firebaseAuth);

const firebaseStore = document.createElement("script");
firebaseStore.src = "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js";
document.head.appendChild(firebaseStore);

// Wait for Firebase scripts to load
firebaseStore.onload = () => {
    
    const firebaseConfig = {
        apiKey: "AIzaSyBFfzetzI_sFXu58jSil1Sh2LnQrpgLNFE",
        authDomain: "bitforex-academy.firebaseapp.com",
        projectId: "bitforex-academy",
        storageBucket: "bitforex-academy.firebasestorage.app",
        messagingSenderId: "523261484934",
        appId: "1:523261484934:web:0370b1c43f8891035c9607"
    };

    firebase.initializeApp(firebaseConfig);

    // Global access
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    console.log("🔥 Firebase Loaded Successfully");
};