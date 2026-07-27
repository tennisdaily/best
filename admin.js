/* Espace rédaction : écrire un nouvel article, le modifier ou le supprimer. */

let uploadedImageFile = null;
let currentImagePosition = 'center center';
let editingArticle = null; // article en cours de modification (null = création)

function updateGuardView() {
    const guard = document.getElementById('admin-guard');
    const shell = document.getElementById('admin-shell');
    if (isAdmin) {
        guard.classList.add('hidden');
        shell.classList.remove('hidden');
        loadMyArticles();
        maybeLoadEditTarget();
    } else {
        guard.classList.remove('hidden');
        shell.classList.add('hidden');
    }
}
function onAuthChanged() { updateGuardView(); }

function switchAdminTab(tab) {
    document.getElementById('tab-write').classList.toggle('active', tab === 'write');
    document.getElementById('tab-mine').classList.toggle('active', tab === 'mine');
    document.getElementById('panel-write').classList.toggle('hidden', tab !== 'write');
    document.getElementById('panel-mine').classList.toggle('hidden', tab !== 'mine');
    if (tab === 'mine') loadMyArticles();
}

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    uploadedImageFile = file;
    const url = URL.createObjectURL(file);
    document.getElementById('image-preview').src = url;
    document.getElementById('upload-placeholder').classList.add('hidden');
    document.getElementById('framing-picker-wrap').classList.remove('hidden');
    currentImagePosition = 'center center';
    document.getElementById('article-image-position').value = currentImagePosition;
    buildFramingGrid(document.getElementById('framing-grid'), currentImagePosition, (pos) => {
        currentImagePosition = pos;
        document.getElementById('article-image-position').value = pos;
    }, document.getElementById('image-preview'));
}

function resetArticleForm() {
    editingArticle = null;
    uploadedImageFile = null;
    currentImagePosition = 'center center';
    document.getElementById('article-form').reset();
    document.getElementById('editing-article-id').value = '';
    document.getElementById('upload-placeholder').classList.remove('hidden');
    document.getElementById('framing-picker-wrap').classList.add('hidden');
    document.getElementById('submit-article-label').textContent = "Publier l'article";
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('form-error').classList.add('hidden');
    history.replaceState(null, '', 'admin.html');
}

function loadArticleIntoForm(art) {
    editingArticle = art;
    document.getElementById('editing-article-id').value = art.id;
    document.getElementById('article-title').value = art.title;
    document.getElementById('article-category').value = art.category;
    document.getElementById('article-content').value = art.content;
    document.getElementById('submit-article-label').textContent = "Enregistrer les modifications";
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    if (art.image) {
        document.getElementById('image-preview').src = art.image;
        currentImagePosition = art.image_position || 'center center';
        document.getElementById('article-image-position').value = currentImagePosition;
        document.getElementById('upload-placeholder').classList.add('hidden');
        document.getElementById('framing-picker-wrap').classList.remove('hidden');
        buildFramingGrid(document.getElementById('framing-grid'), currentImagePosition, (pos) => {
            currentImagePosition = pos;
            document.getElementById('article-image-position').value = pos;
        }, document.getElementById('image-preview'));
    }
    switchAdminTab('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function maybeLoadEditTarget() {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (!editId) return;
    const { data } = await _supabase.from('articles').select('*').eq('id', Number(editId)).limit(1);
    const art = data && data[0];
    if (art && currentUser && art.author_id === currentUser.id) {
        loadArticleIntoForm(art);
    }
}

async function submitArticleForm(event) {
    event.preventDefault();
    const errorBox = document.getElementById('form-error');
    errorBox.classList.add('hidden');

    if (!isAdmin) { alert("Action non autorisée."); return; }

    const title = document.getElementById('article-title').value;
    const category = document.getElementById('article-category').value;
    const content = document.getElementById('article-content').value;
    const btn = document.getElementById('submit-article-btn');
    btn.disabled = true;

    try {
        let imageUrl = editingArticle ? editingArticle.image : null;

        if (uploadedImageFile) {
            const fileExt = uploadedImageFile.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const { error: uploadError } = await _supabase.storage.from('article-images').upload(fileName, uploadedImageFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = _supabase.storage.from('article-images').getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
        }

        if (!imageUrl) { throw new Error("Veuillez sélectionner une photo de couverture."); }

        if (editingArticle) {
            const updatePayload = {
                title, category, content,
                image: imageUrl,
                image_position: currentImagePosition
            };
            let { error } = await _supabase.from('articles').update(updatePayload).eq('id', editingArticle.id);
            if (error && /image_position/i.test(error.message || '')) {
                delete updatePayload.image_position;
                ({ error } = await _supabase.from('articles').update(updatePayload).eq('id', editingArticle.id));
            }
            if (error) throw error;
            window.location.href = 'article.html?a=' + encodeURIComponent(slugify(title));
            return;
        }

        const newArticle = {
            title, category, content,
            image: imageUrl,
            image_position: currentImagePosition,
            date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
            author_id: currentUser ? currentUser.id : null,
            author_name: currentUser ? currentUser.displayName : null
        };

        let { error: insertError } = await _supabase.from('articles').insert([newArticle]);

        if (insertError && /image_position/i.test(insertError.message || '')) {
            delete newArticle.image_position;
            ({ error: insertError } = await _supabase.from('articles').insert([newArticle]));
        }
        if (insertError && /author_id|author_name/i.test(insertError.message || '')) {
            throw new Error("La table 'articles' de Supabase ne contient pas (encore) les colonnes author_id / author_name. Ajoute-les avant de publier, sinon cet article ne pourra jamais être modifié ou supprimé. Détail : " + insertError.message);
        }
        if (insertError) throw insertError;

        window.location.href = 'article.html?a=' + encodeURIComponent(slugify(title));

    } catch (err) {
        errorBox.textContent = "Erreur : " + err.message;
        errorBox.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
}

async function loadMyArticles() {
    if (!currentUser) return;
    const list = document.getElementById('my-articles-list');
    const empty = document.getElementById('my-articles-empty');
    const { data, error } = await _supabase.from('articles').select('*').eq('author_id', currentUser.id).order('id', { ascending: false });

    if (error || !data || data.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    list.innerHTML = data.map(art => {
        const img = art.image ? `<img src="${art.image}" alt="${escapeHtml(art.title)}" class="w-14 h-14 rounded-lg object-cover shrink-0" style="object-position:${art.image_position || 'center center'};">` : `<div class="w-14 h-14 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><span class="icon-svg text-emerald-300" data-icon="tennisBall"></span></div>`;
        return `
        <div class="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            ${img}
            <div class="min-w-0 flex-1">
                <span class="score-chip ${categoryChipClass(art.category)} mb-1"><span class="dot"></span>${art.category}</span>
                <p class="font-bold text-sm truncate">${escapeHtml(art.title)}</p>
                <p class="text-xs text-slate-400">${escapeHtml(art.date || '')}</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
                <a href="article.html?a=${encodeURIComponent(slugify(art.title))}" class="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Voir" style="text-decoration:none;"><span class="icon-svg" data-icon="arrowRight"></span></a>
                <button onclick='loadArticleIntoForm(${JSON.stringify(art).replace(/'/g, "&#39;")})' class="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Modifier"><span class="icon-svg" data-icon="pen"></span></button>
                <button onclick="deleteMyArticle(${art.id})" class="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Supprimer"><span class="icon-svg" data-icon="trash"></span></button>
            </div>
        </div>`;
    }).join('');
    renderStaticIcons();
}

async function deleteMyArticle(id) {
    if (!confirm("Supprimer définitivement cet article ?")) return;
    const { error } = await _supabase.from('articles').delete().eq('id', id).eq('author_id', currentUser.id);
    if (error) { alert("Erreur lors de la suppression : " + error.message); return; }
    loadMyArticles();
}

bootChrome('admin').then(updateGuardView);
