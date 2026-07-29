// Régénère sitemap.xml en incluant l'URL de chaque article publié sur Supabase.
// Ce script tourne côté serveur (Node), pas dans le navigateur.
//
// Utilisation locale :
//   npm install @supabase/supabase-js
//   node scripts/generate-sitemap.js
//
// En CI (voir .github/workflows/sitemap.yml), il est lancé automatiquement
// chaque jour et à chaque publication, puis le fichier sitemap.xml est commité.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SITE_URL = 'https://deucee.shop';
const SUPABASE_URL = 'https://wywfqdlrlncvqvxznshm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PZ56ks1RrEOtoOw14hb2jg_-3zaZA3b'; // clé publique (lecture seule)

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function toIsoDate(frenchDate) {
    const mois = {
        janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
        juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12'
    };
    const match = /^(\d{1,2})\s+([a-zéû]+)\s+(\d{4})$/i.exec((frenchDate || '').trim());
    if (match) {
        const [, day, moisNom, year] = match;
        const m = mois[moisNom.toLowerCase()];
        if (m) return `${year}-${m}-${day.padStart(2, '0')}`;
    }
    return new Date().toISOString().slice(0, 10);
}

async function main() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: articles, error } = await supabase
        .from('articles')
        .select('title, date')
        .order('id', { ascending: false });

    if (error) {
        console.error('Erreur lors de la récupération des articles :', error.message);
        process.exit(1);
    }

    const staticUrls = [
        { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
        { loc: `${SITE_URL}/atp.html`, changefreq: 'daily', priority: '0.8' },
        { loc: `${SITE_URL}/wta.html`, changefreq: 'daily', priority: '0.8' },
        { loc: `${SITE_URL}/itf.html`, changefreq: 'daily', priority: '0.8' },
        { loc: `${SITE_URL}/divers.html`, changefreq: 'daily', priority: '0.7' },
        { loc: `${SITE_URL}/a-propos.html`, changefreq: 'monthly', priority: '0.3' },
        { loc: `${SITE_URL}/contact.html`, changefreq: 'monthly', priority: '0.3' },
        { loc: `${SITE_URL}/confidentialite.html`, changefreq: 'yearly', priority: '0.2' },
        { loc: `${SITE_URL}/mentions-legales.html`, changefreq: 'yearly', priority: '0.2' }
    ];

    const articleUrls = (articles || []).map(art => ({
        loc: `${SITE_URL}/article.html?a=${slugify(art.title)}`,
        lastmod: toIsoDate(art.date),
        changefreq: 'weekly',
        priority: '0.6'
    }));

    const allUrls = [...staticUrls, ...articleUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls
        .map(u => {
            const lastmodTag = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
            return `  <url>\n    <loc>${u.loc}</loc>${lastmodTag}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
        })
        .join('\n')}\n</urlset>\n`;

    const outputPath = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`sitemap.xml généré avec ${allUrls.length} URLs (dont ${articleUrls.length} articles).`);
}

main();
