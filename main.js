import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuEYx4pTsnhRJE37mVX38jgBIi5GyZ4fQ",
  authDomain: "organizador-a8fa1.firebaseapp.com",
  projectId: "organizador-a8fa1",
  storageBucket: "organizador-a8fa1.firebasestorage.app",
  messagingSenderId: "813072238246",
  appId: "1:813072238246:web:5866f2684bade15f319667"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let allApps = [];
let userIsAdmin = false;
let isTyping = false;

let globalPassword = null;
let isLockEnabled = false;

let typedNum = "";
let typeTimer = null;

let activePassInput = null;

document.querySelectorAll('input[type="password"]').forEach(inp => {
    inp.addEventListener('focus', () => { activePassInput = inp; });
});

document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if(!activePassInput) return;
        const val = btn.dataset.val;
        if(val === 'clear') {
            activePassInput.value = '';
        } else if(val === 'del') {
            activePassInput.value = activePassInput.value.slice(0, -1);
        } else {
            activePassInput.value += val;
        }
    });
});

async function initSystem() {
  try {
    const passRef = doc(db, "config", "general");
    const passSnap = await getDoc(passRef);
    if(passSnap.exists()) {
      const data = passSnap.data();
      globalPassword = data.sitePassword || null;
      isLockEnabled = data.isLockEnabled === true;
    } else {
      globalPassword = null;
      isLockEnabled = false;
    }
    if(isLockEnabled && globalPassword) {
      document.getElementById('passwordLock').classList.remove('hidden');
      activePassInput = document.getElementById('inpLockPassword');
      document.getElementById('inpLockPassword').focus();
    } else {
      loadApps();
    }
  } catch(e) { loadApps(); }
}

document.getElementById('lockForm').onsubmit = (e) => {
  e.preventDefault();
  const p = document.getElementById('inpLockPassword').value;
  if(p === globalPassword) {
    document.getElementById('passwordLock').classList.add('hidden');
    loadApps();
  } else {
    document.getElementById('lockError').classList.remove('hidden');
    document.getElementById('inpLockPassword').value = '';
  }
};

function updateToggleButton() {
    const btn = document.getElementById('btnToggleLock');
    if(isLockEnabled) {
        btn.innerText = "BLOQUEO: ACTIVADO (Apagar)";
        btn.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
        btn.style.color = "#28a745";
        btn.style.borderColor = "#28a745";
    } else {
        btn.innerText = "BLOQUEO: APAGADO (Activar)";
        btn.style.backgroundColor = "rgba(220, 53, 69, 0.2)";
        btn.style.color = "#dc3545";
        btn.style.borderColor = "#dc3545";
    }
}

document.getElementById('btnToggleLock').onclick = async () => {
    const newState = !isLockEnabled;
    try {
        await setDoc(doc(db, "config", "general"), { isLockEnabled: newState }, { merge: true });
        isLockEnabled = newState;
        updateToggleButton();
        alert(newState ? "El bloqueo ha sido activado." : "El bloqueo ha sido apagado.");
    } catch(e) { alert("Error al cambiar estado: " + e.message); }
};

function openChangePassword() {
  document.getElementById('changePassModal').classList.remove('hidden');
  document.getElementById('changePassForm').reset();
  document.getElementById('changePassError').classList.add('hidden');
  
  updateToggleButton();
  
  const currentInp = document.getElementById('inpCurrentPass');
  activePassInput = currentInp;
  
  if(globalPassword) {
      currentInp.placeholder = "Contrasena actual";
  } else {
      currentInp.placeholder = "No hay contrasena (dejar vacio)";
  }
  setTimeout(() => currentInp.focus(), 100);
}

document.getElementById('closeChangePass').onclick = () => { document.getElementById('changePassModal').classList.add('hidden'); };

document.getElementById('changePassForm').onsubmit = async (e) => {
  e.preventDefault();
  const current = document.getElementById('inpCurrentPass').value;
  const newP = document.getElementById('inpNewPass').value;
  const repP = document.getElementById('inpRepeatPass').value;
  const err = document.getElementById('changePassError');

  if(globalPassword !== null && current !== globalPassword) {
    err.innerText = "La contrasena actual es incorrecta.";
    err.classList.remove('hidden');
    return;
  }
  if(newP !== repP) {
    err.innerText = "Las contrasenas nuevas no coinciden.";
    err.classList.remove('hidden');
    return;
  }
  try {
    await setDoc(doc(db, "config", "general"), { sitePassword: newP, isLockEnabled: true }, { merge: true });
    globalPassword = newP;
    isLockEnabled = true;
    document.getElementById('changePassModal').classList.add('hidden');
    alert("Contrasena guardada y bloqueo activado correctamente.");
  } catch(error) {
    err.innerText = "Error al guardar: " + error.message;
    err.classList.remove('hidden');
  }
};

async function loadApps() {
  const g = document.getElementById('appsGrid');
  g.innerHTML = '<div class="loading-msg"><i class="fa-solid fa-spinner fa-spin"></i> CARGANDO...</div>';
  try {
    const q = query(collection(db, "apps"), orderBy("name"));
    const snap = await getDocs(q);
    allApps = [];
    const tags = new Set();
    snap.forEach(d => {
      const dt = d.data();
      allApps.push({id: d.id, ...dt});
      if(dt.tag) tags.add(dt.tag.toLowerCase().trim());
    });
    renderFilters([...tags]);
    renderApps(allApps);
  } catch(e) { g.innerHTML = '<div class="loading-msg" style="color:red">ERROR DE CONEXION</div>'; }
}

function renderApps(list) {
  const g = document.getElementById('appsGrid');
  g.innerHTML = '';
  if(list.length === 0) { g.innerHTML = '<div class="loading-msg">No hay resultados</div>'; return; }
  
  list.forEach((a, index) => {
    const num = index + 1;
    const div = document.createElement('div');
    div.className = 'app-box select-fx';
    div.tabIndex = 0;
    div.dataset.num = num; 
    div.innerHTML = `
        <div class="app-number">${num}</div>
        <img src="${a.image}" loading="lazy">
        <div class="app-overlay"><h3 class="app-title">${a.name}</h3></div>
    `;
    div.onclick = () => openDetails(a);
    div.onkeydown = (e) => { if(e.key === 'Enter') openDetails(a); };
    div.oncontextmenu = (e) => openContextMenu(e, a.id);
    g.appendChild(div);
  });
}

function renderFilters(tags) {
  const c = document.getElementById('filterContainer');
  c.innerHTML = ''; 
  const btnAll = document.createElement('button');
  btnAll.className = 'filter-btn active select-fx'; 
  btnAll.innerText = 'TODO';
  btnAll.dataset.tag = 'all';
  btnAll.tabIndex = 0;
  btnAll.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
    btnAll.classList.add('active');
    filterApps('all');
  };
  c.appendChild(btnAll);
  tags.forEach(t => {
    const b = document.createElement('button');
    b.className = 'filter-btn select-fx';
    b.innerText = t; 
    b.dataset.tag = t; 
    b.tabIndex = 0;
    b.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      filterApps(t);
    }
    c.appendChild(b);
  });
}

function filterApps(tag) {
  const term = document.getElementById('searchBar').value.toLowerCase();
  renderApps(allApps.filter(a => {
    return (tag === 'all' || (a.tag && a.tag.toLowerCase() === tag)) && a.name.toLowerCase().includes(term);
  }));
}

const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchBar');
searchContainer.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') {
    isTyping = true;
    searchContainer.classList.add('search-active');
    searchInput.readOnly = false;
    searchInput.focus();
    e.stopPropagation();
  }
});
searchInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowDown') {
    isTyping = false;
    searchContainer.classList.remove('search-active');
    searchInput.readOnly = true;
    searchContainer.focus();
    if(e.key === 'ArrowDown') document.querySelector('.filter-btn').focus();
    e.stopPropagation();
  }
});
searchInput.addEventListener('input', () => { filterApps(document.querySelector('.filter-btn.active')?.dataset.tag || 'all'); });

function openDetails(a) {
  document.getElementById('detailTitle').innerText = a.name;
  document.getElementById('detailImage').src = a.image;
  document.getElementById('detailTag').innerText = a.tag;
  document.getElementById('detailLink').href = a.downloadLink;
  document.getElementById('detailDesc').innerText = a.description || "Sin informacion adicional.";
  document.getElementById('detailsPage').classList.remove('hidden');
  setTimeout(() => document.getElementById('detailLink').focus(), 100);
}
document.getElementById('closeDetails').onclick = () => {
  document.getElementById('detailsPage').classList.add('hidden');
  document.getElementById('searchContainer').focus();
}

async function checkRole(u) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if(snap.exists()) {
    const d = snap.data();
    if(d.rol === 'admin' || d.role === 'admin') {
      userIsAdmin = true;
      document.getElementById('adminIndicator').classList.remove('hidden');
      document.getElementById('userStatus').innerText = "ADMINISTRADOR";
    } else {
      userIsAdmin = false;
      document.getElementById('adminIndicator').classList.add('hidden');
      document.getElementById('userStatus').innerText = "USUARIO";
    }
  } else {
    await setDoc(ref, { email: u.email, rol: 'usuario' });
    userIsAdmin = false;
    document.getElementById('userStatus').innerText = "NUEVO";
  }
  document.getElementById('loginPanel').classList.add('hidden');
  document.getElementById('logoutPanel').classList.remove('hidden');
}

onAuthStateChanged(auth, u => {
  if(u) checkRole(u);
  else {
    userIsAdmin = false;
    document.getElementById('adminIndicator').classList.add('hidden');
    document.getElementById('loginPanel').classList.remove('hidden');
    document.getElementById('logoutPanel').classList.add('hidden');
  }
});

document.getElementById('btnGoogle').onclick = () => signInWithPopup(auth, provider).then(() => document.getElementById('authModal').classList.add('hidden'));
document.getElementById('btnLogout').onclick = () => signOut(auth).then(() => location.reload());
document.addEventListener('keydown', e => { if(e.ctrlKey && e.altKey) document.getElementById('authModal').classList.remove('hidden'); });
document.getElementById('closeAuth').onclick = () => document.getElementById('authModal').classList.add('hidden');

function openContextMenu(e, id) {
  if(!userIsAdmin) return;
  e.preventDefault();
  const m = document.getElementById('contextMenu');
  if(id) {
    m.innerHTML = `<button class="ctx-item select-fx" id="cxEd">Editar</button><button class="ctx-item select-fx" id="cxDel" style="color:#ff6666">Borrar</button>`;
    setTimeout(() => {
      document.getElementById('cxEd').onclick = () => editApp(id);
      document.getElementById('cxDel').onclick = () => deleteApp(id);
      m.querySelector('button').focus();
    },0);
  } else {
    m.innerHTML = `<button class="ctx-item select-fx" id="cxAdd">Nueva App</button>
                   <button class="ctx-item select-fx" id="cxPass">Seguridad</button>`;
    setTimeout(() => {
        document.getElementById('cxAdd').onclick = openAdmin;
        document.getElementById('cxPass').onclick = openChangePassword;
        m.querySelector('button').focus();
    }, 0);
  }
  m.style.top = e.pageY + 'px'; m.style.left = e.pageX + 'px';
  m.classList.remove('hidden');
}
document.addEventListener('contextmenu', e => { if(userIsAdmin && !e.target.closest('.app-box')) openContextMenu(e, null); });
document.addEventListener('click', () => document.getElementById('contextMenu').classList.add('hidden'));

function openAdmin() {
  document.getElementById('adminModal').classList.remove('hidden');
  document.getElementById('appForm').reset();
  document.getElementById('modalTitle').innerText = "AGREGAR";
  document.getElementById('editId').value = "";
}
function editApp(id) {
  const a = allApps.find(x => x.id === id);
  if(!a) return;
  openAdmin();
  document.getElementById('modalTitle').innerText = "EDITAR";
  document.getElementById('editId').value = id;
  document.getElementById('inpName').value = a.name;
  document.getElementById('inpImage').value = a.image;
  document.getElementById('inpLink').value = a.downloadLink;
  document.getElementById('inpTag').value = a.tag;
  document.getElementById('inpDesc').value = a.description || "";
}
async function deleteApp(id) {
  if(confirm("Borrar?")) { await deleteDoc(doc(db, "apps", id)); loadApps(); }
}
document.getElementById('appForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const d = {
    name: document.getElementById('inpName').value,
    image: document.getElementById('inpImage').value,
    downloadLink: document.getElementById('inpLink').value,
    tag: document.getElementById('inpTag').value,
    description: document.getElementById('inpDesc').value
  };
  try {
    if(id) await updateDoc(doc(db, "apps", id), d);
    else await addDoc(collection(db, "apps"), d);
    document.getElementById('adminModal').classList.add('hidden');
    loadApps();
  } catch(e) { alert("ERROR DE PERMISOS: " + e.message); }
};
document.getElementById('closeAdmin').onclick = () => document.getElementById('adminModal').classList.add('hidden');

document.addEventListener('keydown', e => {
  const activeEl = document.activeElement;
  
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !activeEl.readOnly) {
    return;
  }
  if(isTyping) return;

  const isLockOpen = !document.getElementById('passwordLock').classList.contains('hidden');
  const isChangePassOpen = !document.getElementById('changePassModal').classList.contains('hidden');

  if (/^[0-9]$/.test(e.key)) {
    if(isLockOpen || isChangePassOpen) {
        if(activePassInput) activePassInput.value += e.key;
        return;
    }

    typedNum += e.key;
    const overlay = document.getElementById('numberOverlay');
    overlay.innerText = typedNum;
    overlay.classList.remove('hidden');
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      const numToFind = parseInt(typedNum);
      const appBoxes = document.querySelectorAll('.app-box');
      appBoxes.forEach(box => { if(parseInt(box.dataset.num) === numToFind) box.click(); });
      typedNum = "";
      overlay.classList.add('hidden');
    }, 1200);
    return; 
  }
  
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    let container = document.querySelector('.modal-overlay:not(.hidden)') || document.body;
    let selectors = '.select-fx, .app-box, .filter-btn, .ctx-item, .search-wrapper, .num-btn';
    const focusables = Array.from(container.querySelectorAll(selectors)).filter(el => el.offsetParent !== null);
    
    if(focusables.length === 0) return;
    
    let current = document.activeElement;
    if(!focusables.includes(current)) {
      focusables[0].focus();
      return;
    }

    let cRect = current.getBoundingClientRect();
    let best = null;
    let minDist = Infinity;

    focusables.forEach(el => {
      if(el === current) return;
      let r = el.getBoundingClientRect();
      let cx1 = cRect.left + cRect.width / 2;
      let cy1 = cRect.top + cRect.height / 2;
      let cx2 = r.left + r.width / 2;
      let cy2 = r.top + r.height / 2;
      let dx = cx2 - cx1;
      let dy = cy2 - cy1;
      let dist = Math.sqrt(dx*dx + dy*dy);
      let valid = false;

      if(e.key === 'ArrowRight' && dx > 0 && Math.abs(dy) < r.height) valid = true;
      if(e.key === 'ArrowLeft' && dx < 0 && Math.abs(dy) < r.height) valid = true;
      if(e.key === 'ArrowDown' && dy > 0 && Math.abs(dx) < r.width * 0.8) valid = true;
      if(e.key === 'ArrowUp' && dy < 0 && Math.abs(dx) < r.width * 0.8) valid = true;

      if (!valid && container !== document.body) {
         if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && dy >= 0 && dx >= 0) valid = true;
         if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && dy <= 0 && dx <= 0) valid = true;
      }

      if(valid && dist < minDist) {
        minDist = dist;
        best = el;
      }
    });

    if(best) {
      best.focus();
      best.scrollIntoView({block:'center', behavior:'smooth'});
    }
  }
  
  if(e.key === 'Enter' && document.activeElement && !isTyping) {
      if(document.activeElement.id !== 'searchContainer') document.activeElement.click();
  }
});

initSystem();