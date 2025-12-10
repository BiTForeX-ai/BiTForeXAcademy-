# 🟩 BiTForeX Academy — Web App (LocalStorage Based)

BiTForeX Academy is a fully client-side learning and subscription platform built using **HTML, CSS, and JavaScript**, with complete functionality stored in **LocalStorage**.  
No backend or server is required — everything runs in the browser.

---

## 🚀 Features

### 🧑‍💻 User Features
- User registration & login  
- Automatic chat initialization  
- Private user → admin messaging  
- Image/file upload inside chat (compressed to reduce storage)  
- Subscription page with plans  
- Payment submission with proof upload  
- Payment pending status page  
- Active subscription activation after admin approval  
- Forgot Password (admin verified)

---

### 🛠 Admin Features
- Admin login  
- View list of all users  
- Approve or reject subscription payments  
- View pending payment proofs  
- Chat inbox with all users  
- Send text or image messages to users  
- Update payment settings (Bank & Crypto)  
- Manage subscription plans  
- View unread messages count  
- Dashboard analytics (users, active subs, pending payments)

---

## 📂 Project Structure
---

## 💾 Storage Keys Used (LocalStorage)

| Key | Description |
|-----|-------------|
| `adminAccount` | Admin login credentials |
| `users` | Registered users list |
| `session` | Active session (user/admin) |
| `bf_messages` | All chat messages |
| `bf_pending_subs` | Payment requests waiting for approval |
| `subscriptionPlans` | Subscription plan definitions |
| `bf_pwd_requests` | Forgot password requests |

---

## 🔧 Technologies Used
- **HTML5**
- **CSS3**
- **Vanilla JavaScript**
- **LocalStorage** (100% frontend database)

---

## 📌 Notes
- This platform **does not use a backend**.  
- All data is stored in the user’s browser (LocalStorage).  
- For production deployment, upgrading to a **database + backend** is recommended.

---

## 📝 License
This project is private and belongs to **BiTForeX Academy**.
