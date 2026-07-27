/* ==========================================================================
   Deuce Actu v2 — coeur partagé (Supabase, auth, header/footer injectés,
   utilitaires SEO). Chargé sur TOUTES les pages, avant le script propre à
   chaque page (home.js / circuit.js / article.js / contact.js / admin.js).
   ========================================================================== */

const SUPABASE_URL = "https://wywfqdlrlncvqvxznshm.supabase.co";
const SUPABASE_KEY = "sb_publishable_PZ56ks1RrEOtoOw14hb2jg_-3zaZA3b";
const SITE_URL = "https://deucee.shop";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isAdmin = false;
let currentUser = null; // { id, email, displayName, initials, color }

/* --- IDENTITÉ ADMIN --- */
const AVATAR_COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#db2777', '#4d7c0f'];

function getInitials(email) {
    if (!email) return '?';
    return email.split('@')[0].slice(0, 2).toUpperCase();
}
function getAvatarColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function buildCurrentUser(user) {
    if (!user) return null;
    const email = user.email || '';
    return {
        id: user.id,
        email,
        displayName: email.split('@')[0] || 'Admin',
        initials: getInitials(email),
        color: getAvatarColor(email || user.id)
    };
}

async function initAuthState() {
    const { data: { session } } = await _supabase.auth.getSession();
    isAdmin = !!session;
    currentUser = session ? buildCurrentUser(session.user) : null;
    applyAuthView();
}
_supabase.auth.onAuthStateChange((_event, session) => {
    isAdmin = !!session;
    currentUser = session ? buildCurrentUser(session.user) : null;
    applyAuthView();
    if (typeof onAuthChanged === 'function') onAuthChanged();
});

/* --- UTILITAIRES TEXTE --- */
function slugify(text) {
    return (text || '').toString().toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
        .replace(/^-+/, '').replace(/-+$/, '');
}
function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatArticleContent(content) {
    if (!content) return '';
    let formatted = escapeHtml(content).replace(/\*\*(.*?)\*\*/g, '<em>$1</em>');
    return formatted.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('##')) {
            return `<h3>${trimmed.replace(/^##\s*/, '')}</h3>`;
        }
        return line;
    }).join('\n');
}
function cleanPreview(content) {
    return escapeHtml((content || '').replace(/^##\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1'));
}
function categoryChipClass(cat) {
    return cat === 'ATP' ? 'chip-atp' : cat === 'WTA' ? 'chip-wta' : 'chip-itf';
}

/* --- CADRAGE DE PHOTO (grille 3x3) --- */
const FRAMING_POSITIONS = [
    { value: 'left top', label: 'Haut gauche' }, { value: 'center top', label: 'Haut centre' }, { value: 'right top', label: 'Haut droite' },
    { value: 'left center', label: 'Milieu gauche' }, { value: 'center center', label: 'Centre' }, { value: 'right center', label: 'Milieu droite' },
    { value: 'left bottom', label: 'Bas gauche' }, { value: 'center bottom', label: 'Bas centre' }, { value: 'right bottom', label: 'Bas droite' }
];
function buildFramingGrid(container, initialValue, onSelect, imageEl) {
    if (!container) return;
    container.innerHTML = '';
    FRAMING_POSITIONS.forEach(pos => {
        const cell = document.createElement('div');
        cell.className = 'framing-cell' + (pos.value === initialValue ? ' selected' : '');
        cell.title = pos.label;
        cell.innerHTML = '<span class="framing-dot"></span>';
        cell.onclick = function () {
            container.querySelectorAll('.framing-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            if (imageEl) imageEl.style.objectPosition = pos.value;
            if (typeof onSelect === 'function') onSelect(pos.value);
        };
        container.appendChild(cell);
    });
}

/* --- SEO (balises meta déclarées dans le <head> de chaque page) --- */
function setMetaContent(id, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('content', value);
}
function setSEO({ title, description, url, image }) {
    if (title) document.title = title;
    if (description) setMetaContent('meta-description', description);
    if (title) { setMetaContent('og-title', title); setMetaContent('twitter-title', title); }
    if (description) { setMetaContent('og-description', description); setMetaContent('twitter-description', description); }
    if (url) {
        setMetaContent('og-url', url);
        const canonical = document.getElementById('canonical-link');
        if (canonical) canonical.setAttribute('href', url);
    }
    if (image) { setMetaContent('og-image', image); setMetaContent('twitter-image', image); }
}
function setArticleJsonLd(art, url) {
    let script = document.getElementById('article-schema');
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'article-schema';
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": art.title,
        "image": [art.image],
        "datePublished": art.date,
        "author": { "@type": "Organization", "name": "Deuce Tennis" },
        "publisher": { "@type": "Organization", "name": "Deuce Actu" },
        "mainEntityOfPage": url,
        "articleSection": art.category,
        "description": cleanPreview(art.content).slice(0, 200)
    });
}

/* --- CHROME PARTAGÉ : header + footer + modales, injectés sur chaque page --- */
const NAV_LINKS = [
    { page: 'home', label: 'Accueil', href: 'index.html' },
    { page: 'about', label: 'À propos', href: 'a-propos.html' },
    { page: 'contact', label: 'Contact', href: 'contact.html' }
];
const CIRCUITS = [
    { page: 'atp', label: 'Circuit ATP', href: 'atp.html' },
    { page: 'wta', label: 'Circuit WTA', href: 'wta.html' },
    { page: 'itf', label: 'Circuit ITF', href: 'itf.html' }
];

function renderHeader(activePage) {
    const root = document.getElementById('site-header-root');
    if (!root) return;

    const isCircuit = CIRCUITS.some(c => c.page === activePage);

    root.innerHTML = `
    <nav class="bg-emerald-700 text-white shadow-lg">
        <div class="max-w-6xl mx-auto px-4 flex justify-between items-center h-16 gap-3">
            <a href="index.html" class="flex items-center space-x-2 shrink-0" style="text-decoration:none;color:inherit;">
                <span class="icon-svg text-yellow-300 text-2xl" data-icon="tennisBall"></span>
                <span class="font-bold text-xl tracking-wider">DEUCE <span class="text-yellow-300">ACTU</span></span>
            </a>

            <div class="hidden md:flex items-center gap-2 text-sm">
                <a href="index.html" class="nav-btn${activePage === 'home' ? ' nav-btn-active' : ''}" style="text-decoration:none;">Accueil</a>
                <div class="nav-dropdown" id="circuits-dropdown">
                    <button type="button" onclick="toggleCircuitsMenu(event)" id="nav-circuits" class="nav-btn flex items-center gap-1.5${isCircuit ? ' nav-btn-active' : ''}">
                        <span>Circuits</span>
                        <span class="icon-svg text-[10px]" data-icon="chevronDown"></span>
                    </button>
                    <div id="circuits-menu" class="nav-dropdown-menu hidden">
                        ${CIRCUITS.map(c => `<a href="${c.href}" class="${activePage === c.page ? 'nav-subitem-active' : ''}" style="text-decoration:none;">${c.label}</a>`).join('')}
                    </div>
                </div>
                <a href="a-propos.html" class="nav-btn${activePage === 'about' ? ' nav-btn-active' : ''}" style="text-decoration:none;">À propos</a>
                <a href="contact.html" class="nav-btn${activePage === 'contact' ? ' nav-btn-active' : ''}" style="text-decoration:none;">Contact</a>
            </div>

            <div class="flex items-center space-x-2 shrink-0">
                <a id="btn-write" href="admin.html" class="hidden bg-yellow-400 hover:bg-yellow-300 text-emerald-950 px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center space-x-1 shadow transition" style="text-decoration:none;">
                    <span class="icon-svg" data-icon="pen"></span><span class="hidden sm:inline">RÉDIGER</span>
                </a>
                <button id="btn-login-toggle" onclick="handleAuthAction()" class="bg-emerald-900 hover:bg-emerald-950 border border-emerald-500/50 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center space-x-1.5 shadow-sm transition">
                    <span class="icon-svg" data-icon="lock"></span><span class="hidden sm:inline">Admin</span>
                </button>
                <div id="admin-profile-chip" class="hidden relative">
                    <button onclick="handleAuthAction()" class="flex items-center gap-2 bg-emerald-900 hover:bg-emerald-950 border border-emerald-500/50 pl-1.5 pr-3 py-1.5 rounded-full shadow-sm transition">
                        <span id="profile-avatar" class="avatar-circle w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0"></span>
                        <span id="profile-name" class="text-xs font-bold text-white hidden sm:inline"></span>
                        <span class="icon-svg text-emerald-300 text-[10px]" data-icon="chevronDown"></span>
                    </button>
                    <div id="profile-menu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800 z-50">
                        <div class="p-4 flex items-center gap-3 border-b border-slate-100">
                            <span id="profile-menu-avatar" class="avatar-circle w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"></span>
                            <div class="min-w-0">
                                <p id="profile-menu-name" class="font-bold text-sm truncate"></p>
                                <p id="profile-menu-email" class="text-[11px] text-slate-400 truncate"></p>
                            </div>
                        </div>
                        <a href="admin.html" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 transition text-left" style="text-decoration:none;color:inherit;">
                            <span class="icon-svg text-emerald-600" data-icon="folderOpen"></span> Espace rédaction
                        </a>
                        <button onclick="logoutAdmin()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 transition text-left border-t border-slate-100 text-red-500 font-semibold">
                            <span class="icon-svg" data-icon="unlock"></span> Déconnexion
                        </button>
                    </div>
                </div>
                <button type="button" id="btn-hamburger" onclick="toggleMobileMenu()" class="hamburger-btn md:hidden" aria-label="Ouvrir le menu" aria-expanded="false">
                    <span class="icon-svg" id="hamburger-icon" data-icon="bars"></span>
                </button>
            </div>
        </div>
        <div id="mobile-menu" class="mobile-menu-panel md:hidden hidden">
            <a href="index.html" style="text-decoration:none;">Accueil</a>
            <a href="atp.html" style="text-decoration:none;">Circuit ATP</a>
            <a href="wta.html" style="text-decoration:none;">Circuit WTA</a>
            <a href="itf.html" style="text-decoration:none;">Circuit ITF</a>
            <a href="a-propos.html" style="text-decoration:none;">À propos</a>
            <a href="contact.html" style="text-decoration:none;">Contact</a>
        </div>
    </nav>

    <div id="login-modal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center hidden z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div class="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center">
                <h3 class="font-bold"><span class="icon-svg mr-2 text-yellow-300" data-icon="shield"></span>Connexion Admin</h3>
                <button onclick="toggleLoginModal()" class="text-white hover:text-yellow-300"><span class="icon-svg" data-icon="xmark"></span></button>
            </div>
            <form onsubmit="loginAdmin(event)" class="p-6 space-y-4">
                <div>
                    <label class="field-label">Adresse Email</label>
                    <input type="email" id="admin-email" placeholder="admin@deucetennis.com" class="field-input" required>
                </div>
                <div>
                    <label class="field-label">Mot de passe</label>
                    <input type="password" id="admin-password" placeholder="••••••••" class="field-input" required>
                    <p id="login-error" class="text-red-500 text-xs mt-1 hidden font-semibold">Identifiants incorrects !</p>
                </div>
                <button type="submit" class="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-lg font-bold text-sm transition shadow-md">Se connecter</button>
            </form>
        </div>
    </div>`;
}

function renderFooter() {
    const root = document.getElementById('site-footer-root');
    if (!root) return;
    root.innerHTML = `
    <div id="cookie-banner" class="fixed bottom-0 inset-x-0 bg-slate-900 text-white p-4 shadow-2xl border-t border-slate-700 z-50 hidden">
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <p class="leading-relaxed">
                Nous utilisons des cookies pour analyser notre trafic (Google Analytics) et personnaliser le contenu et les annonces (Google AdSense). En poursuivant votre navigation, vous acceptez notre utilisation des cookies.
                <a href="confidentialite.html" class="underline text-yellow-300">En savoir plus</a>.
            </p>
            <div class="flex gap-2 shrink-0">
                <button onclick="declineCookies()" class="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-800 transition font-semibold">Refuser</button>
                <button onclick="acceptCookies()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-semibold">Accepter</button>
            </div>
        </div>
    </div>

    <footer class="bg-slate-900 text-slate-300 pt-10 pb-6 text-sm border-t border-slate-800 mt-8">
        <div class="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
                <div class="flex items-center gap-2 mb-3">
                    <span class="icon-svg text-yellow-300 text-xl" data-icon="tennisBall"></span>
                    <span class="font-bold text-white tracking-wider">DEUCE <span class="text-yellow-300">ACTU</span></span>
                </div>
                <p class="text-xs text-slate-400 leading-relaxed">L'actualité indépendante des circuits ATP, WTA et ITF : analyses, résultats et portraits, publiés au fil de l'eau.</p>
            </div>
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Navigation</p>
                <ul class="space-y-2 text-xs">
                    <li><a href="index.html" class="hover:text-white transition">Accueil</a></li>
                    <li><a href="atp.html" class="hover:text-white transition">Circuit ATP</a></li>
                    <li><a href="wta.html" class="hover:text-white transition">Circuit WTA</a></li>
                    <li><a href="itf.html" class="hover:text-white transition">Circuit ITF</a></li>
                    <li><a href="a-propos.html" class="hover:text-white transition">À propos</a></li>
                </ul>
            </div>
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Informations</p>
                <ul class="space-y-2 text-xs">
                    <li><a href="contact.html" class="hover:text-white transition">Nous contacter</a></li>
                    <li><a href="confidentialite.html" class="hover:text-white transition">Politique de confidentialité</a></li>
                    <li><a href="mentions-legales.html" class="hover:text-white transition">Mentions légales</a></li>
                </ul>
            </div>
        </div>
        <div class="max-w-6xl mx-auto px-4 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
            &copy; 2026 Deuce Actu. Tous droits réservés.
        </div>
    </footer>`;
}

/* --- Menus (dropdown desktop + hamburger mobile + profil) --- */
function toggleCircuitsMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('circuits-menu');
    if (menu) menu.classList.toggle('hidden');
}
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('circuits-dropdown');
    const menu = document.getElementById('circuits-menu');
    if (dropdown && menu && !dropdown.contains(e.target)) menu.classList.add('hidden');
});
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('btn-hamburger');
    const iconWrap = document.getElementById('hamburger-icon');
    if (!menu || !btn) return;
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (iconWrap) iconWrap.innerHTML = ICONS[willOpen ? 'xmark' : 'bars'];
}
function toggleProfileMenu() {
    const menu = document.getElementById('profile-menu');
    if (menu) menu.classList.toggle('hidden');
}
function closeProfileMenu() {
    const menu = document.getElementById('profile-menu');
    if (menu) menu.classList.add('hidden');
}
document.addEventListener('click', function (e) {
    const chip = document.getElementById('admin-profile-chip');
    const menu = document.getElementById('profile-menu');
    if (chip && menu && !chip.contains(e.target)) menu.classList.add('hidden');
});

/* --- AUTHENTIFICATION --- */
function handleAuthAction() {
    if (isAdmin) toggleProfileMenu();
    else toggleLoginModal();
}
function toggleLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.toggle('hidden');
    const err = document.getElementById('login-error');
    if (err) err.classList.add('hidden');
    const emailInput = document.getElementById('admin-email');
    const passInput = document.getElementById('admin-password');
    if (emailInput) emailInput.value = "";
    if (passInput) passInput.value = "";
}
async function loginAdmin(event) {
    event.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (!error) {
        isAdmin = true;
        currentUser = buildCurrentUser(data.user);
        applyAuthView();
        toggleLoginModal();
        if (typeof onAuthChanged === 'function') onAuthChanged();
    } else {
        const err = document.getElementById('login-error');
        if (err) err.classList.remove('hidden');
    }
}
async function logoutAdmin() {
    await _supabase.auth.signOut();
    closeProfileMenu();
    window.location.href = 'index.html';
}
function applyAuthView() {
    const btnWrite = document.getElementById('btn-write');
    const loginBtn = document.getElementById('btn-login-toggle');
    const profileChip = document.getElementById('admin-profile-chip');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const menuAvatar = document.getElementById('profile-menu-avatar');
    const menuName = document.getElementById('profile-menu-name');
    const menuEmail = document.getElementById('profile-menu-email');

    if (isAdmin && currentUser) {
        if (btnWrite) btnWrite.classList.remove('hidden');
        if (loginBtn) loginBtn.classList.add('hidden');
        if (profileChip) profileChip.classList.remove('hidden');
        [profileAvatar, menuAvatar].forEach(el => { if (!el) return; el.textContent = currentUser.initials; el.style.backgroundColor = currentUser.color; });
        if (profileName) profileName.textContent = currentUser.displayName;
        if (menuName) menuName.textContent = currentUser.displayName;
        if (menuEmail) menuEmail.textContent = currentUser.email;
    } else {
        if (btnWrite) btnWrite.classList.add('hidden');
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (profileChip) profileChip.classList.add('hidden');
        closeProfileMenu();
    }
}

/* --- COOKIES --- */
function checkCookieConsent() {
    const consent = localStorage.getItem('deuce_cookie_consent');
    const banner = document.getElementById('cookie-banner');
    if (!consent && banner) banner.classList.remove('hidden');
}
function acceptCookies() {
    localStorage.setItem('deuce_cookie_consent', 'accepted');
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.add('hidden');
}
function declineCookies() {
    localStorage.setItem('deuce_cookie_consent', 'declined');
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.add('hidden');
}

/* --- DÉMARRAGE COMMUN : à appeler par chaque page une fois son propre
       contenu prêt, avec la page active pour l'état du menu --- */
async function bootChrome(activePage) {
    renderHeader(activePage);
    renderFooter();
    await initAuthState();
    checkCookieConsent();
}
