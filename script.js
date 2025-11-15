// ========= Replace these placeholders (already filled with your config) =========
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB3mqBFNep6ZIHhNMrUKVV14L5j9oMgAfs",
  authDomain: "abhi-events-db7e8.firebaseapp.com",
  projectId: "abhi-events-db7e8",
  storageBucket: "abhi-events-db7e8.firebasestorage.app",
  messagingSenderId: "674616910948",
  appId: "1:674616910948:web:77345352a19f9037736b71",
  measurementId: "G-XX4H973WC8"
};
const OWNER_PHONE = "918548945231";
const CONTACT_EMAIL = "abhishekcsgowda736@gmail.com";
// ==============================================

// init firebase compat libs (script tags loaded on page)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

// helpers
function scrollToEl(sel){ const el = document.querySelector(sel); if(el) el.scrollIntoView({behavior:'smooth'}); }
if(document.getElementById('year')) document.getElementById('year').innerText = new Date().getFullYear();

// Set WhatsApp floating icon (icon-only)
const waFloat = document.getElementById('waFloat');
if(waFloat){
  waFloat.href = `https://wa.me/${OWNER_PHONE}`;
  waFloat.title = 'Message us on WhatsApp';
  waFloat.innerHTML = '💬'; // icon-only
}

// ---------- BOOKING ----------
const bookingForm = document.getElementById('bookingForm');
if(bookingForm){
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const type = document.getElementById('eventType').value.trim();
    const date = document.getElementById('eventDate').value || '';
    const notes = document.getElementById('eventNotes') ? document.getElementById('eventNotes').value.trim() : '';
    const statusEl = document.getElementById('bookingStatus');
    if(!name || !phone || !type){ alert('Please fill name, phone and event type'); return; }
    if(statusEl) statusEl.innerText = 'Saving...';
    try {
      const docRef = await db.collection('bookings').add({
        name, phone, type, date, notes,
        status: 'new',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if(statusEl) statusEl.innerText = 'Booked! Opening WhatsApp...';
      const message = encodeURIComponent(`New booking from ${name} (${phone})\nEvent: ${type}\nDate: ${date}\nNotes: ${notes}\nID:${docRef.id}`);
      window.open(`https://wa.me/${OWNER_PHONE}?text=${message}`, '_blank');
      bookingForm.reset();
      setTimeout(()=>{ if(statusEl) statusEl.innerText=''; }, 3000);
    } catch(err) {
      console.error('Booking error', err);
      if(statusEl) statusEl.innerText = 'Error saving booking. Try again.';
    }
  });
}

// ---------- REVIEWS ----------
const submitReviewBtn = document.getElementById('submitReview');
async function submitReviewHandler(){
  const name = (document.getElementById('reviewName')?.value || 'Anonymous').trim();
  const phone = (document.getElementById('reviewPhone')?.value || '').trim();
  const rating = parseInt(document.getElementById('reviewRating')?.value || '5', 10);
  const text = (document.getElementById('reviewText')?.value || '').trim();
  if(!text){ alert('Please write a review'); return; }
  try{
    await db.collection('reviews').add({
      name, phone, rating, text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if(document.getElementById('reviewText')) document.getElementById('reviewText').value = '';
    alert('Thank you — your review was submitted.');
  }catch(err){ console.error('Review submit error', err); alert('Could not submit review'); }
}
if(submitReviewBtn) submitReviewBtn.addEventListener('click', submitReviewHandler);

// live render reviews and compute average
const reviewsContainer = document.getElementById('reviews');
function renderReviewsList(docs){
  // if there are no docs, keep default sample reviews (do nothing)
  if(!reviewsContainer) return;
  if(docs.length === 0) return;
  reviewsContainer.innerHTML = '';
  let sum = 0;
  docs.forEach(d=>{
    const r = d.data();
    sum += (r.rating || 5);
    const div = document.createElement('div');
    div.className = 'review';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const left = document.createElement('div');
    left.textContent = (r.name || 'Anonymous') + (r.phone ? ' • ' + r.phone : '');
    const right = document.createElement('div');
    right.textContent = (r.createdAt && r.createdAt.toDate) ? new Date(r.createdAt.toDate()).toLocaleString() : '';
    meta.appendChild(left); meta.appendChild(right);
    const text = document.createElement('div');
    text.textContent = r.text || '';
    const rating = document.createElement('div');
    rating.innerHTML = 'Rating: ' + '★'.repeat(Math.round(r.rating || 5));
    div.appendChild(meta); div.appendChild(rating); div.appendChild(text);
    div.dataset.id = d.id;
    reviewsContainer.appendChild(div);
  });
  const avg = (sum / docs.length) || 5;
  const avgRatingEl = document.getElementById('avgRating');
  const avgStarsEl = document.getElementById('avgStars');
  const reviewsCountEl = document.getElementById('reviewsCount');
  if(avgRatingEl) avgRatingEl.textContent = avg.toFixed(1);
  if(avgStarsEl) avgStarsEl.textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
  if(reviewsCountEl) reviewsCountEl.textContent = `(${docs.length} reviews)`;
}

// subscribe to Firestore reviews
db.collection('reviews').orderBy('createdAt','desc').onSnapshot(snapshot=>{
  // convert snapshot to array of docs
  const docs = [];
  snapshot.forEach(doc => docs.push(doc));
  // if no docs, keep sample content (do not wipe)
  if(docs.length === 0) return;
  renderReviewsList(docs);
  attachAdminControls(); // attach admin buttons if admin signed in
});

// ---------- ADMIN (hidden panel, toggled by icon) ----------
const adminIcon = document.getElementById('adminIcon');
const adminPanel = document.getElementById('adminPanel');
const closeAdmin = document.getElementById('closeAdmin');
if(adminIcon){
  adminIcon.addEventListener('click', ()=>{ if(adminPanel) adminPanel.style.display = 'block'; window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'}); });
}
if(closeAdmin){
  closeAdmin.addEventListener('click', ()=>{ if(adminPanel) adminPanel.style.display = 'none'; });
}

// Admin auth & controls
const adminLogin = document.getElementById('adminLogin');
const adminSignOut = document.getElementById('adminSignOut');
const adminEmail = document.getElementById('adminEmail');
const adminPass = document.getElementById('adminPass');
const adminUser = document.getElementById('adminUser');

if(adminLogin) adminLogin.addEventListener('click', async ()=>{
  const email = adminEmail.value.trim(); const pass = adminPass.value;
  if(!email || !pass) { alert('Enter admin email and password'); return; }
  try{ await auth.signInWithEmailAndPassword(email, pass); }
  catch(err){
    if(err.code === 'auth/user-not-found'){
      try{ await auth.createUserWithEmailAndPassword(email, pass); alert('Admin account created and signed in'); }
      catch(e){ alert(e.message); }
    } else alert(err.message);
  }
});
if(adminSignOut) adminSignOut.addEventListener('click', ()=> auth.signOut());

auth.onAuthStateChanged(user=>{
  if(adminUser) adminUser.textContent = user ? user.email : 'Not signed in';
  if(user) enableAdminMode(user); else disableAdminMode();
});

// Add Edit/Delete buttons to reviews (visible to signed-in admins)
function attachAdminControls(){
  const signedInUser = auth.currentUser;
  const reviewDivs = document.querySelectorAll('.review');
  reviewDivs.forEach(div=>{
    const existing = div.querySelector('.admin-controls'); if(existing) existing.remove();
    if(signedInUser){
      const ctrl = document.createElement('div'); ctrl.className='admin-controls'; ctrl.style.marginTop='8px';
      const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.style.padding='6px 8px';
      const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.style.padding='6px 8px'; del.style.background='#d9534f';
      ctrl.appendChild(edit); ctrl.appendChild(del);
      div.appendChild(ctrl);
      edit.addEventListener('click', async ()=>{
        const textEl = div.querySelector('div:nth-child(3)');
        const newText = prompt('Edit review text', textEl ? textEl.textContent : '');
        if(newText !== null){
          const id = div.dataset.id;
          await db.collection('reviews').doc(id).update({ text: newText, editedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
      });
      del.addEventListener('click', async ()=>{
        if(confirm('Delete this review?')){
          const id = div.dataset.id;
          await db.collection('reviews').doc(id).delete();
        }
      });
    }
  });
}

// Admin booking manager button (appended to admin panel when signed in)
function enableAdminMode(user){
  if(document.getElementById('manageBookings')) return;
  const btn = document.createElement('button'); btn.id='manageBookings'; btn.className='btn'; btn.style.marginTop='12px'; btn.textContent='Manage Bookings';
  btn.addEventListener('click', async ()=>{
    const s = await db.collection('bookings').orderBy('createdAt','desc').limit(50).get();
    let out = 'Recent bookings:\\n\\n';
    s.forEach(doc => { const d = doc.data(); out += `ID:${doc.id} | ${d.name} | ${d.phone} | ${d.type} | ${d.date} | status:${d.status}\\n`; });
    alert(out);
    const id = prompt('Enter Booking ID to update status (or cancel)');
    if(id){
      const status = prompt('New status (handled / in-progress /cancelled)');
      if(status) await db.collection('bookings').doc(id).update({ status });
    }
  });
  document.getElementById('adminControls').appendChild(btn);
}
function disableAdminMode(){
  const btn = document.getElementById('manageBookings'); if(btn) btn.remove();
  attachAdminControls();
      }
