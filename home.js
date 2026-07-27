/* Page d'accueil : article à la une, grille des derniers articles (pagination),
   puis un aperçu de chaque circuit (ATP / WTA / ITF). */

const PAGE_SIZE = 9;
let homeOffset = 0;
let featuredId = null;

function articleUrl(art) {
    return 'article.html?a=' + encodeURIComponent(slugify(art.title));
}

function cardHTML(art) {
    const img = art.image
        ? `<img src="${art.image}" alt="${escapeHtml(art.title)}" style="object-position:${art.image_position || 'center center'}" loading="lazy">`
        : `<div class="w-full h-full flex items-center justify-center text-emerald-200"><span class="icon-svg text-5xl" data-icon="tennisBall"></span></div>`;
    const excerpt = cleanPreview(art.content).slice(0, 130);
    return `
    <a href="${articleUrl(art)}" class="article-card" style="text-decoration:none;color:inherit;">
        <div class="card-media">${img}</div>
        <div class="card-body">
            <span class="score-chip ${categoryChipClass(art.category)}"><span class="dot"></span>${art.category}</span>
            <h3 class="card-title">${escapeHtml(art.title)}</h3>
            <p class="card-excerpt">${excerpt}${excerpt.length >= 130 ? '…' : ''}</p>
            <p class="card-meta mt-3"><span class="icon-svg" data-icon="calendar"></span>${escapeHtml(art.date || '')}</p>
        </div>
    </a>`;
}

function featuredHTML(art) {
    const img = art.image ? `<img src="${art.image}" alt="${escapeHtml(art.title)}" style="object-position:${art.image_position || 'center center'}">` : '';
    const excerpt = cleanPreview(art.content).slice(0, 180);
    return `
    <a href="${articleUrl(art)}" class="feature-card" style="text-decoration:none;">
        ${img}
        <div class="feature-overlay">
            <span class="score-chip ${categoryChipClass(art.category)}"><span class="dot"></span>À LA UNE • ${art.category}</span>
            <h2 class="feature-title mt-3">${escapeHtml(art.title)}</h2>
            <p class="text-emerald-100 text-sm mt-2 max-w-2xl hidden md:block">${excerpt}${excerpt.length >= 180 ? '…' : ''}</p>
        </div>
    </a>`;
}

async function loadHome() {
    const { data: featuredList } = await _supabase.from('articles').select('*').order('id', { ascending: false }).limit(1);
    const featured = (featuredList && featuredList[0]) || null;
    const featuredSlot = document.getElementById('featured-slot');

    if (featured) {
        featuredId = featured.id;
        featuredSlot.innerHTML = featuredHTML(featured);
        renderStaticIcons();
    } else {
        featuredSlot.innerHTML = '';
    }

    await loadMoreArticles(true);
    await loadCircuitPreviews();
}

async function loadMoreArticles(isFirst) {
    const grid = document.getElementById('latest-grid');
    const emptyMsg = document.getElementById('latest-empty');
    const btn = document.getElementById('btn-load-more');

    let query = _supabase.from('articles').select('*').order('id', { ascending: false }).range(homeOffset, homeOffset + PAGE_SIZE - 1 + (isFirst ? 1 : 0));
    const { data, error } = await query;
    if (error) { console.error(error); return; }

    let items = data || [];
    if (isFirst) items = items.filter(a => a.id !== featuredId).slice(0, PAGE_SIZE);
    else items = items;

    if (isFirst && items.length === 0) {
        emptyMsg.classList.remove('hidden');
        btn.classList.add('hidden');
        return;
    }

    grid.insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
    renderStaticIcons();
    homeOffset += (isFirst ? PAGE_SIZE + 1 : PAGE_SIZE);
    btn.classList.toggle('hidden', items.length < PAGE_SIZE);
}

async function loadCircuitPreviews() {
    const container = document.getElementById('circuit-previews');
    const circuits = [
        { cat: 'ATP', label: 'Circuit ATP', href: 'atp.html' },
        { cat: 'WTA', label: 'Circuit WTA', href: 'wta.html' },
        { cat: 'ITF', label: 'Circuit ITF', href: 'itf.html' }
    ];
    let html = '';
    for (const c of circuits) {
        const { data } = await _supabase.from('articles').select('*').eq('category', c.cat).order('id', { ascending: false }).limit(3);
        if (!data || data.length === 0) continue;
        html += `
        <div>
            <div class="flex items-center justify-between mb-5">
                <h2 class="text-xl md:text-2xl font-bold text-emerald-950">${c.label}</h2>
                <a href="${c.href}" class="text-emerald-700 font-bold text-sm flex items-center gap-1 hover:text-emerald-900" style="text-decoration:none;">Tout voir <span class="icon-svg" data-icon="arrowRight"></span></a>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${data.map(cardHTML).join('')}</div>
        </div>`;
    }
    container.innerHTML = html;
    renderStaticIcons();
}

bootChrome('home').then(loadHome);
