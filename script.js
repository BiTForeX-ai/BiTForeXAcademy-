/* script.js */
if (!window.auth || !window.db) {
  console.warn("Firebase not loaded yet.");
}
// Helper
const $ = id => document.getElementById(id);

// NAVBAR HAMBURGER
document.addEventListener("DOMContentLoaded", () => {
  const toggle = $("menu-toggle");
  if (toggle) {
    toggle.onclick = () => {
      $("main-nav").classList.toggle("show");
    };
  }
});

/* ---------------- REGISTER ---------------- */
async function registerUser(name, email, pass) {
  try {
    const res = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = res.user.uid;

    await db.collection("users").doc(uid).set({
      uid,
      name,
      email,
      status: "Inactive",
      createdAt: Date.now()
    });

    alert("Account created successfully!");
    window.location = "login.html";

  } catch (err) {
    alert(err.message);
  }
}

/* ---------------- LOGIN ---------------- */
async function loginUser(email, pass) {
  try {
    const res = await auth.signInWithEmailAndPassword(email, pass);
    const uid = res.user.uid;

    const docSnap = await db.collection("users").doc(uid).get();
    const data = docSnap.data();

    localStorage.setItem("session", JSON.stringify({
      uid,
      email,
      name: data.name,
      role: email === "arthurebube8@gmail.com" ? "admin" : "user"
    }));

    if (email === "arthurebube8@gmail.com") {
      window.location = "admin.html";
    } else {
      window.location = "chat.html";
    }

  } catch (err) {
    alert(err.message);
  }
}

/* ---------------- RESET PASSWORD ---------------- */
async function resetPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    alert("Reset link sent! Check your email.");
  } catch (err) {
    alert(err.message);
  }
}

/* ---------------- FORM HANDLERS ---------------- */
document.addEventListener("DOMContentLoaded", () => {

  // LOGIN FORM
  const loginForm = $("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      loginUser($("loginEmail").value, $("loginPassword").value);
    });
  }

  // REGISTER FORM
  const regForm = $("registerForm");
  if (regForm) {
    regForm.addEventListener("submit", e => {
      e.preventDefault();
      registerUser(
        $("r-name").value,
        $("r-email").value,
        $("r-password").value
      );
    });
  }

  // FORGOT PASSWORD FORM
  const forgotForm = $("forgotForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async e => {
      e.preventDefault();
      await resetPassword($("forgotEmail").value);
    });
  }

});