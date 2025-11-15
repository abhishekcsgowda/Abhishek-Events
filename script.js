// ========== Firebase config (your values kept) ==========
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
// =======================================================

// Initialize Firebase compat libs (script tags in HTML)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Utilities
function scrollToEl(sel){ const el = document.querySelector(sel); if(el) el.scrollIntoView({behavior:'smooth'}); }
if(document.getElementById('year')) document.getElementById('year').innerText = new Date().getFullYear();

// WhatsApp floating icon (icon only)
const waFloat = document.getElementById('waFloat');
if(waFloat){
  waFloat.href = `https://wa.me/${OWNER_PHONE}`;
  waFloat.title = 'Message us on WhatsApp';
  waFloat.innerHTML = '💬';
}

// HERO safeguard: nothing else needed (height set in CSS)

// ---------- Load gallery & services ----------
const galleryGrid = document.getElementById('galleryGrid');
const worksGrid = document.getElementById('worksGrid');

async function loadGallery(){
  // fetch gallery docs
  const snap = await db.collection('gallery').orderBy('createdAt','desc').get();
  const docs = snap.docs;
  galleryGrid.innerHTML = '';
  worksGrid.innerHTML = '';
  if(docs.length === 0){
    // show default sample images (these match your earlier design)
    const samples = [
      {url:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=60',caption:'Wedding Decoration'},
      {url:'https://images.unsplash.com/photo-1604014237800-1c3c4f1bd5e5?auto=format&fit=crop&w=1400&q=60',caption:'Mantapa Decoration'},
      {url:'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=1400&q=60',caption:'Stage Decoration'}
    ];
    samples.forEach(s=>{
      const fig = document.createElement('figure');
      fig.innerHTML = `<img src="${s.url}" alt="${s.caption}"><figcaption>${s.caption}</figcaption>`;
      galleryGrid.appendChild(fig);
      const item = document.createElement('div'); item.className='service-item'; item.innerHTML = `<img src="${s.url}" alt="${s.caption}"><strong>${s.caption}</strong>`;
      worksGrid.appendChild(item);
    });
    return;
  }
  docs.forEach(d=>{
    const data = d.data();
    const fig = document.createElement('figure');
    fig.innerHTML = `<img src="${data.url}" alt="${data.caption || ''}"><figcaption>${data.caption || ''}</figcaption>`;
    galleryGrid.appendChild(fig);
    const item = document.createElement('div'); item.className='service-item';
    item.innerHTML = `<img src="${data.url}" alt="${data.caption || ''}"><strong>${data.caption || ''}</strong>`;
    worksGrid.appendChild(item);
  });
}
loadGallery().catch(err=>console.error('loadGallery',err));

// ---------- Submit booking ----------
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

// ---------- Submit review (with optional photo) ----------
const submitReviewBtn = document.getElementById('submitReview');
if(submitReviewBtn) submitReviewBtn.addEventListener('click', submitReviewHandler);

async function submitReviewHandler(){
  const name = (document.getElementById('reviewName')?.value || 'Anonymous').trim();
  const phone = (document.getElementById('reviewPhone')?.value || '').trim();
  const rating = parseInt(document.getElementById('reviewRating')?.value || '5', 10);
  const text = (document.getElementById('reviewText')?.value || '').trim();
  const photoInput = document.getElementById('reviewPhoto');
  if(!text){ alert('Please write a review'); return; }
  try{
    let photoUrl = '';
    if(photoInput && photoInput.files && photoInput.files[0]){
      const file = photoInput.files[0];
      const path = `reviews/${Date.now()}_${file.name}`;
      const ref = storage.ref().child(path);
      await ref.put(file);
      photoUrl = await ref.getDownloadURL();
    }
    await db.collection('reviews').add({
      name, phone, rating, text, photoUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if(document.getElementById('reviewText')) document.getElementById('reviewText').value = '';
    if(photoInput) photoInput.value = '';
    alert('Thank you — your review was submitted.');
  }catch(err){ console.error('Review submit error', err); alert('Could not submit review'); }
}

// ---------- Live render reviews & average ----------
const reviewsContainer = document.getElementById('reviews');
function renderReviewsList(docs){
  if(!reviewsContainer) return;
  if(docs.length === 0) return; // keep sample until firestore has data
  reviewsContainer.innerHTML = '';
  let sum = 0;
  docs.forEach(d=>{
    const r = d.data();
    sum += (r.rating || 5);
    const div = document.createElement('div'); div.className='review'; div.dataset.id = d.id;
    const left = document.createElement('div');
    left.innerHTML = `<strong>${r.name || 'Anonymous'}</strong><div class="muted">${r.phone || ''} • ${ (r.createdAt && r.createdAt.toDate) ? new Date(r.createdAt.toDate()).toLocaleDateString() : '' }</div>`;
    const right = document.createElement('div');
    right.innerHTML = `${'★'.repeat(Math.round(r.rating || 5))}`;
    const text = document.createElement('div'); text.textContent = r.text || '';
    // photo column
    const photo = document.createElement('div');
    if(r.photoUrl) photo.innerHTML = `<img src="${r.photoUrl}" alt="review photo">`;
    div.appendChild(left);
    div.appendChild(right);
    div.appendChild(photo);
    div.appendChild(text);
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

// subscribe to reviews
db.collection('reviews').orderBy('createdAt','desc').onSnapshot(snapshot=>{
  const docs = []; snapshot.forEach(doc => docs.push(doc));
  if(docs.length === 0) return; // keep default sample content until data appears
  renderReviewsList(docs);
  attachAdminControls();
});

// ---------- ADMIN UI (toggle & auth) ----------
const adminIcon = document.getElementById('adminIcon');
const adminPanel = document.getElementById('adminPanel');
const closeAdmin = document.getElementById('closeAdmin');
if(adminIcon){
  adminIcon.addEventListener('click', ()=>{ if(adminPanel) adminPanel.style.display = 'block'; window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'}); });
}
if(closeAdmin){
  closeAdmin.addEventListener('click', ()=>{ if(adminPanel) adminPanel.style.display = 'none'; });
}

const adminLogin = document.getElementById('adminLogin');
const adminSignOut = document.getElementById('adminSignOut');
const adminEmail = document.getElementById('adminEmail');
const adminPass = document.getElementById('adminPass');
const adminUser = document.getElementById('adminUser');

if(adminLogin) adminLogin.addEventListener('click', async ()=>{
  const email = (adminEmail.value || '').trim(); const pass = adminPass.value || '';
  if(!email || !pass){ alert('Enter admin email & password'); return; }
  try{ await auth.signInWithEmailAndPassword(email, pass); }
  catch(err){
    if(err.code === 'auth/user-not-found'){
      try{ await auth.createUserWithEmailAndPassword(email, pass); alert('Admin created & signed in'); }
      catch(e){ alert(e.message); }
    } else alert(err.message);
  }
});
if(adminSignOut) adminSignOut.addEventListener('click', ()=> auth.signOut());

auth.onAuthStateChanged(user=>{
  adminUser.textContent = user ? user.email : 'Not signed in';
  if(user) enableAdminMode(user); else disableAdminMode();
});

// upload gallery image (admin)
const uploadGalleryBtn = document.getElementById('uploadGalleryBtn');
if(uploadGalleryBtn){
  uploadGalleryBtn.addEventListener('click', async ()=>{
    const fileEl = document.getElementById('galleryFile');
    const caption = (document.getElementById('galleryCaption')?.value || '').trim();
    if(!fileEl || !fileEl.files[0]) return alert('Choose an image');
    const file = fileEl.files[0];
    const path = `gallery/${Date.now()}_${file.name}`;
    const ref = storage.ref().child(path);
    try{
      await ref.put(file);
      const url = await ref.getDownloadURL();
      await db.collection('gallery').add({ url, caption, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      alert('Gallery image uploaded');
      fileEl.value=''; if(document.getElementById('galleryCaption')) document.getElementById('galleryCaption').value='';
      loadGallery();
    }catch(err){console.error(err); alert('Upload failed');}
  });
}

// upload service image (admin)
const uploadServiceBtn = document.getElementById('uploadServiceBtn');
if(uploadServiceBtn){
  uploadServiceBtn.addEventListener('click', async ()=>{
    const fileEl = document.getElementById('serviceFile');
    const title = (document.getElementById('serviceTitle')?.value || '').trim();
    if(!fileEl || !fileEl.files[0]) return alert('Choose an image');
    const file = fileEl.files[0];
    const path = `services/${Date.now()}_${file.name}`;
    const ref = storage.ref().child(path);
    try{
      await ref.put(file);
      const url = await ref.getDownloadURL();
      await db.collection('services').add({ url, title, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      alert('Service image uploaded');
      fileEl.value=''; if(document.getElementById('serviceTitle')) document.getElementById('serviceTitle').value='';
      loadGallery();
    }catch(err){console.error(err); alert('Upload failed');}
  });
}

// Attach admin controls to reviews (edit/delete) - visible only for signed admin
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
        const newText = prompt('Edit review text', div.querySelector('div:nth-child(4)') ? div.querySelector('div:nth-child(4)').textContent : '');
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

// Admin booking manager button (appended when signed in)
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
                                                          
