/* Page article individuelle : lecture via ?a=slug-du-titre (ou ?a=ID). */

let articleData = null;

function getRequestedSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('a') || params.get('article') || '';
}

async function fetchArticle(slugOrId) {
    if (/^\d+$/.test(slugOrId)) {
        const { data } = await _supabase.from('articles').select('*').eq('id', Number(slugOrId)).limit(1);
        if (data && data[0]) return data[0];
    }
    const { data } = await _supabase.from('articles').select('*').order('id', { ascending: false });
    if (!data) return null;
    return data.find(a => slugify(a.title) === slugOrId) || null;
}

function renderOwnerActions() {
    const box = document.getElementById('owner-actions');
    if (!box) return;
    const owns = isAdmin && currentUser && articleData.author_id && articleData.author_id === currentUser.id;
    box.classList.toggle('hidden', !owns);
}

async function deleteThisArticle() {
    if (!confirm("Supprimer définitivement cet article ?")) return;
    const { error } = await _supabase.from('articles').delete().eq('id', articleData.id);
    if (error) { alert("Erreur lors de la suppression : " + error.message); return; }
    window.location.href = 'index.html';
}

function copyArticleLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        document.getElementById('copy-icon').innerHTML = ICONS.check;
        document.getElementById('copy-label').textContent = 'Copié !';
        setTimeout(() => {
            document.getElementById('copy-icon').innerHTML = ICONS.link;
            document.getElementById('copy-label').textContent = 'Copier le lien';
        }, 1800);
    });
}

async function loadRelated(art) {
    const { data } = await _supabase.from('articles').select('*').eq('category', art.category).neq('id', art.id).order('id', { ascending: false }).limit(3);
    if (!data || data.length === 0) return;
    const wrap = document.getElementById('related-wrap');
    const grid = document.getElementById('related-grid');
    grid.innerHTML = data.map(a => {
        const img = a.image ? `<img src="${a.image}" alt="${escapeHtml(a.title)}" style="object-position:${a.image_position || 'center center'}" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-emerald-200"><span class="icon-svg text-3xl" data-icon="tennisBall"></span></div>`;
        return `<a href="article.html?a=${encodeURIComponent(slugify(a.title))}" class="article-card" style="text-decoration:none;color:inherit;">
            <div class="card-media">${img}</div>
            <div class="card-body">
                <span class="score-chip ${categoryChipClass(a.category)}"><span class="dot"></span>${a.category}</span>
                <h3 class="card-title">${escapeHtml(a.title)}</h3>
            </div>
        </a>`;
    }).join('');
    wrap.classList.remove('hidden');
    renderStaticIcons();
}

async function loadArticle() {
    const slug = getRequestedSlug();
    if (!slug) { showNotFound(); return; }

    const art = await fetchArticle(slug);
    if (!art) { showNotFound(); return; }

    articleData = art;
    const url = 'https://deucee.shop/article.html?a=' + encodeURIComponent(slugify(art.title));
    const previewText = cleanPreview(art.content).slice(0, 160);

    document.getElementById('page-title').textContent = art.title + ' — Deuce Actu';
    setSEO({ title: art.title + ' — Deuce Actu', description: previewText, url, image: art.image || 'https://deucee.shop/rect1.svg' });
    setArticleJsonLd(art, url);

    document.getElementById('article-chip').className = 'score-chip ' + categoryChipClass(art.category);
    document.getElementById('article-chip').innerHTML = '<span class="dot"></span>' + art.category;
    document.getElementById('article-title').textContent = art.title;
    document.getElementById('article-date').textContent = art.date || '';
    document.getElementById('article-content').innerHTML = formatArticleContent(art.content).split('\n').map(l => l.trim() ? (l.startsWith('<h3>') ? l : `<p class="mb-4">${l}</p>`) : '').join('');

    const mediaBox = document.getElementById('article-media');
    if (art.image) {
        mediaBox.innerHTML = `<img src="${art.image}" alt="${escapeHtml(art.title)}" style="object-position:${art.image_position || 'center center'}">`;
    } else {
        mediaBox.classList.add('hidden');
    }

    renderOwnerActions();

    document.getElementById('article-loading').classList.add('hidden');
    document.getElementById('article-wrap').classList.remove('hidden');
    renderStaticIcons();

    loadRelated(art);
}

function showNotFound() {
    document.getElementById('article-loading').classList.add('hidden');
    document.getElementById('article-notfound').classList.remove('hidden');
}

function onAuthChanged() {
    if (articleData) renderOwnerActions();
}

bootChrome('article').then(loadArticle);
