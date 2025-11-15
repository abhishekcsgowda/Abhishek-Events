// ========= Replace these placeholders =========
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB3mqBFNep6ZIHhNMrUKVV14L5j9oMgAfs",
  authDomain: "abhi-events-db7e8.firebaseapp.com",
  projectId: "abhi-events-db7e8",
  storageBucket: "abhi-events-db7e8.firebasestorage.app",
  messagingSenderId: "674616910948",
  appId: "1:674616910948:web:77345352a19f9037736b71",
  measurementId: "G-XX4H973WC8"
};
const OWNER_PHONE = "918548945231"; // e.g. 918765432100
const CONTACT_EMAIL = "abhishekcsgowda736@gmail.com";
// ==============================================

// Initialize Firebase (compat libs loaded in index.html)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

// Utility
function scrollToEl(sel){document.querySelector(sel).scrollIntoView({behavior:'smooth'})}
document.getElementById('year').innerText = new Date().getFullYear();

// Set WhatsApp floating link
const waFloat = document.getElementById('waFloat');
waFloat.href = `https://wa.me/${OWNER_PHONE}`;
waFloat.innerHTML = '📲 Message Us';

// ---- Booking form handling ----
const bookingForm = document.getElementById('bookingForm');
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const type = document.getElementById('eventType').value.trim();
  const date = document.getElementById('eventDate').value;
  const notes = document.getElementById('eventNotes').value.trim();
  const statusEl = document.getElementById('bookingStatus');
  statusEl.innerText = 'Saving...';
  try {
    await db.collection('bookings').add({
      name, phone, type, date, notes,
      status: 'new',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    statusEl.innerText = 'Booked! We will contact you soon. Opening WhatsApp...';
    // open WhatsApp with prefilled message to OWNER
    const message = encodeURIComponent(`New booking from ${name} (${phone})\nType: ${type}\nDate: ${date}\nNotes: ${notes}`);
    window.open(`https://wa.me/${OWNER_PHONE}?text=${message}`, '_blank');
    bookingForm.reset();
    setTimeout(()=>statusEl.innerText='',3000);
  } catch(err) {
    console.error(err);
    statusEl.innerText = 'Error saving booking. Try again.';
  }
});

// ---- Reviews: submit and render ----
document.getElementById('submitReview').addEventListener('click', async () => {
  const name = document.getElementById('reviewName').value.trim() || 'Anonymous';
  const phone = document.getElementById('reviewPhone').value.trim() || '';
  const text = document.getElementById('reviewText').value.trim();
  if (!text) { alert('Please write a review'); return; }
  try {
    await db.collection('reviews').add({
      name, phone, text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('reviewText').value = '';
  } catch(err) {
    console.error(err); alert('Could not submit review');
  }
});

// Render reviews live
const reviewsContainer = document.getElementById('reviews');
db.collection('reviews').orderBy('createdAt','desc').onSnapshot(snapshot => {
  reviewsContainer.innerHTML = '';
  snapshot.forEach(doc => {
    const r = doc.data();
    const div = document.createElement('div');
    div.className = 'review';
    div.dataset.id = doc.id;
    const meta = document.createElement('div'); meta.className='meta';
    const left = document.createElement('div'); left.textContent = r.name + (r.phone ? ' • ' + r.phone : '');
    const right = document.createElement('div'); right.textContent = (r.createdAt && r.createdAt.toDate) ? new Date(r.createdAt.toDate()).toLocaleString() : '';
    meta.appendChild(left); meta.appendChild(right);
    const text = document.createElement('div'); text.textContent = r.text;
    div.appendChild(meta); div.appendChild(text);
    reviewsContainer.appendChild(div);
  });
  attachAdminControls();
});

// ---- Admin auth & controls ----
const adminLogin = document.getElementById('adminLogin');
const adminSignOut = document.getElementById('adminSignOut');
const adminEmail = document.getElementById('adminEmail');
const adminPass = document.getElementById('adminPass');
const adminUser = document.getElementById('adminUser');

adminLogin.addEventListener('click', async () => {
  const email = adminEmail.value.trim(); const pass = adminPass.value;
  if (!email || !pass) { alert('Enter admin email and password'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(err) {
    if (err.code === 'auth/user-not-found') {
      // create admin if not exists
      try { await auth.createUserWithEmailAndPassword(email, pass); alert('Admin account created and signed in'); }
      catch(e){ alert(e.message); }
    } else alert(err.message);
  }
});
adminSignOut.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
  adminUser.textContent = user ? user.email : 'Not signed in';
  if (user) enableAdminMode(user); else disableAdminMode();
});

// Add Edit/Delete buttons to reviews (visible to signed-in admins)
async function attachAdminControls() {
  const signedInUser = auth.currentUser;
  const reviewDivs = document.querySelectorAll('.review');
  reviewDivs.forEach(div => {
    const existing = div.querySelector('.admin-controls'); if (existing) existing.remove();
    if (signedInUser) {
      const ctrl = document.createElement('div'); ctrl.className='admin-controls'; ctrl.style.marginTop='8px';
      const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.style.padding='6px 8px';
      const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.style.padding='6px 8px'; del.style.background='#d9534f';
      ctrl.appendChild(edit); ctrl.appendChild(del);
      div.appendChild(ctrl);
      edit.addEventListener('click', async () => {
        const newText = prompt('Edit review text', div.querySelector('div:nth-child(2)').textContent);
        if (newText !== null) {
          const id = div.dataset.id;
          await db.collection('reviews').doc(id).update({ text: newText, editedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
      });
      del.addEventListener('click', async () => {
        if (confirm('Delete this review?')) {
          const id = div.dataset.id;
          await db.collection('reviews').doc(id).delete();
        }
      });
    }
  });
}

// Admin booking manager button (appended to admin panel when signed in)
function enableAdminMode(user) {
  if (document.getElementById('manageBookings')) return;
  const btn = document.createElement('button'); btn.id='manageBookings'; btn.className='btn'; btn.style.marginTop='12px'; btn.textContent='Manage Bookings';
  btn.addEventListener('click', async () => {
    const s = await db.collection('bookings').orderBy('createdAt','desc').limit(50).get();
    let out = 'Recent bookings:\\n\\n';
    s.forEach(doc => { const d = doc.data(); out += `ID:${doc.id} | ${d.name} | ${d.phone} | ${d.type} | ${d.date} | status:${d.status}\\n`; });
    alert(out);
    const id = prompt('Enter Booking ID to update status (or cancel)');
    if (id) {
      const status = prompt('New status (handled / in-progress /cancelled)');
      if (status) await db.collection('bookings').doc(id).update({ status });
    }
  });
  document.querySelector('.admin-panel').appendChild(btn);
}
function disableAdminMode() {
  const btn = document.getElementById('manageBookings'); if (btn) btn.remove();
  attachAdminControls();
}
