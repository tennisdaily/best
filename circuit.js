/* Page circuit (ATP / WTA / ITF) : grille filtrée par catégorie, avec pagination.
   La constante CIRCUIT_CATEGORY est définie en inline juste avant ce script,
   dans chaque page atp.html / wta.html / itf.html. */

const CIRCUIT_PAGE_SIZE = 9;
let circuitOffset = 0;

function circuitArticleUrl(art) {
    return 'article.html?a=' + encodeURIComponent(slugify(art.title));
}

function circuitCardHTML(art) {
    const img = art.image
        ? `<img src="${art.image}" alt="${escapeHtml(art.title)}" style="object-position:${art.image_position || 'center center'}" loading="lazy">`
        : `<div class="w-full h-full flex items-center justify-center text-emerald-200"><span class="icon-svg text-5xl" data-icon="tennisBall"></span></div>`;
    const excerpt = cleanPreview(art.content).slice(0, 130);
    return `
    <a href="${circuitArticleUrl(art)}" class="article-card" style="text-decoration:none;color:inherit;">
        <div class="card-media">${img}</div>
        <div class="card-body">
            <span class="score-chip ${categoryChipClass(art.category)}"><span class="dot"></span>${art.category}</span>
            <h3 class="card-title">${escapeHtml(art.title)}</h3>
            <p class="card-excerpt">${excerpt}${excerpt.length >= 130 ? '…' : ''}</p>
            <p class="card-meta mt-3"><span class="icon-svg" data-icon="calendar"></span>${escapeHtml(art.date || '')}</p>
        </div>
    </a>`;
}

async function loadCircuit(isFirst) {
    const grid = document.getElementById('circuit-grid');
    const emptyMsg = document.getElementById('circuit-empty');
    const btn = document.getElementById('btn-load-more');

    const { data, error } = await _supabase.from('articles').select('*')
        .eq('category', CIRCUIT_CATEGORY)
        .order('id', { ascending: false })
        .range(circuitOffset, circuitOffset + CIRCUIT_PAGE_SIZE - 1);

    if (error) { console.error(error); return; }
    const items = data || [];

    if (isFirst && items.length === 0) {
        emptyMsg.classList.remove('hidden');
        btn.classList.add('hidden');
        return;
    }

    grid.insertAdjacentHTML('beforeend', items.map(circuitCardHTML).join(''));
    renderStaticIcons();
    circuitOffset += CIRCUIT_PAGE_SIZE;
    btn.classList.toggle('hidden', items.length < CIRCUIT_PAGE_SIZE);
}

bootChrome(CIRCUIT_PAGE_ID).then(() => loadCircuit(true));
