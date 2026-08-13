let galleryData = [];
let activeCategory = 'all';
let searchQuery = '';

const $ = (sel) => document.querySelector(sel);

function showToast(msg = 'Copiat!') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}

function getName(path) {
    return path.split('/').pop();
}

async function downloadFile(file) {
    try {
        const resp = await fetch(file.path);
        if (!resp.ok) throw new Error(resp.status);
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = getName(file.path);
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Descarregat!');
    } catch {
        showToast("No s'ha pogut descarregar");
    }
}

async function copyLink(file) {
    const url = new URL(file.path, window.location.href).href;
    try {
        await navigator.clipboard.writeText(url);
        showToast('URL copiada!');
    } catch {
        showToast("No s'ha pogut copiar l'URL");
    }
}

async function copyImage(file) {
    if (!navigator.clipboard.write || !window.ClipboardItem) {
        showToast("Aquest navegador no suporta copiar imatges");
        return;
    }

    try {
        const resp = await fetch(file.path);
        if (!resp.ok) throw new Error(resp.status);
        const blob = await resp.blob();
        const pngBlob = await fileToPng(blob);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': Promise.resolve(pngBlob) })
        ]);
        showToast('Imatge copiada!');
    } catch {
        showToast("No s'ha pogut copiar la imatge");
    }
}

function fileToPng(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            c.toBlob(b => {
                URL.revokeObjectURL(img.src);
                b ? resolve(b) : reject(new Error('toBlob'));
            }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('load')); };
        img.src = URL.createObjectURL(blob);
    });
}

async function shareFile(file) {
    const name = getName(file.path);

    try {
        const resp = await fetch(file.path);
        if (!resp.ok) throw new Error(resp.status);
        const blob = await resp.blob();
        const f = new File([blob], name, { type: blob.type, lastModified: Date.now() });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [f] })) {
            await navigator.share({ files: [f] });
            showToast('Compartit!');
            return;
        }
    } catch (err) {
        if (err.name === 'AbortError') return;
    }

    showToast("Share no disponible en aquest navegador");
}

function isImageFile(file) {
    return file.type !== 'video' && !getName(file.path).toLowerCase().endsWith('.gif');
}

function actionsHtml(file, isLightbox) {
    const name = getName(file.path);
    const copyBtn = isImageFile(file)
        ? `<button class="action-btn copy-btn">&#128203;</button>`
        : '';
    const label = isLightbox
        ? `<span class="lightbox-name">${name}</span>`
        : `<span class="filename" title="${name}">${name}</span>`;
    const cls = isLightbox ? 'lightbox-actions' : 'card-actions';
    return `
        <div class="${cls}">
            ${label}
            <button class="action-btn download-btn">&#128190;</button>
            <button class="action-btn link-btn">&#128279;</button>
            ${copyBtn}
            <button class="action-btn share-btn">&#128260;</button>
        </div>`;
}

function attachActions(container, file) {
    container.querySelector('.download-btn').addEventListener('click', (e) => { e.stopPropagation(); downloadFile(file); });
    container.querySelector('.link-btn').addEventListener('click', (e) => { e.stopPropagation(); copyLink(file); });
    const cb = container.querySelector('.copy-btn');
    if (cb) cb.addEventListener('click', (e) => { e.stopPropagation(); copyImage(file); });
    container.querySelector('.share-btn').addEventListener('click', (e) => { e.stopPropagation(); shareFile(file); });
}

function makeCategoryItem(label, key, count) {
    const li = document.createElement('li');
    li.textContent = label + ' ';
    if (activeCategory === key) li.className = 'active';
    const span = document.createElement('span');
    span.className = 'count';
    span.textContent = count;
    li.appendChild(span);
    li.onclick = () => {
        activeCategory = key;
        searchQuery = '';
        $('#search').value = '';
        buildCategories();
        renderGallery();
    };
    return li;
}

function buildCategories() {
    const ul = $('#categories');
    ul.innerHTML = '';

    const total = galleryData.reduce((s, c) => s + c.files.length, 0);
    ul.appendChild(makeCategoryItem('Tot', 'all', total));

    for (const cat of galleryData) {
        ul.appendChild(makeCategoryItem(cat.name, cat.name, cat.files.length));
    }
}

function getFilteredFiles() {
    let files;

    if (searchQuery || activeCategory === 'all') {
        files = galleryData.flatMap(cat => cat.files.map(f => ({ ...f, category: cat.name })));
    } else {
        const cat = galleryData.find(c => c.name === activeCategory);
        files = cat ? cat.files.map(f => ({ ...f, category: cat.name })) : [];
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        files = files.filter(f => getName(f.path).toLowerCase().includes(q));
    }

    files.sort((a, b) => getName(a.path).localeCompare(getName(b.path)));

    return files;
}

function renderGallery() {
    const gallery = $('#gallery');
    const files = getFilteredFiles();

    if (files.length === 0) {
        gallery.innerHTML = '<div class="empty">No hi ha resultats</div>';
        return;
    }

    gallery.innerHTML = '';

    for (const file of files) {
        const card = document.createElement('div');
        card.className = 'card';
        const media = file.type === 'video'
            ? `<video src="${file.path}" muted loop preload="metadata"
                onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0;"></video>`
            : `<img src="${file.path}" alt="${getName(file.path)}" loading="lazy">`;

        card.innerHTML = `${media}<div class="info">${actionsHtml(file, false)}</div>`;
        attachActions(card, file);
        card.addEventListener('click', () => openLightbox(file));
        gallery.appendChild(card);
    }
}

let lightboxState = null;

function openLightbox(file) {
    const files = getFilteredFiles();
    const currentIndex = files.findIndex(f => f.path === file.path);
    if (currentIndex === -1) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';

    const card = document.createElement('div');
    card.className = 'lightbox-card';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'lightbox-nav lightbox-prev';
    prevBtn.innerHTML = '&#8249;';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'lightbox-nav lightbox-next';
    nextBtn.innerHTML = '&#8250;';

    lightboxState = { overlay, card, prevBtn, nextBtn, files, currentIndex };

    function showSlide(idx) {
        if (idx < 0 || idx >= lightboxState.files.length) return;
        lightboxState.currentIndex = idx;
        const f = lightboxState.files[idx];
        const media = f.type === 'video'
            ? `<video src="${f.path}" controls autoplay loop class="lightbox-media"></video>`
            : `<img src="${f.path}" alt="${getName(f.path)}" class="lightbox-media">`;

        card.innerHTML = `${media}${actionsHtml(f, true)}`;
        attachActions(card, f);

        lightboxState.prevBtn.style.display = idx === 0 ? 'none' : 'flex';
        lightboxState.nextBtn.style.display = idx === lightboxState.files.length - 1 ? 'none' : 'flex';
    }

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(lightboxState.currentIndex - 1);
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(lightboxState.currentIndex + 1);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeLightbox();
    });

    function closeLightbox() {
        overlay.remove();
        document.removeEventListener('keydown', keyHandler);
        lightboxState = null;
    }

    function keyHandler(e) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') showSlide(lightboxState.currentIndex - 1);
        else if (e.key === 'ArrowRight') showSlide(lightboxState.currentIndex + 1);
    }
    document.addEventListener('keydown', keyHandler);

    let touchStartX = 0;
    overlay.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) showSlide(lightboxState.currentIndex + 1);
            else showSlide(lightboxState.currentIndex - 1);
        }
    });

    overlay.appendChild(prevBtn);
    overlay.appendChild(card);
    overlay.appendChild(nextBtn);
    document.body.appendChild(overlay);
    showSlide(currentIndex);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const resp = await fetch('gallery.json');
        galleryData = (await resp.json()).categories || [];
    } catch {
        galleryData = [];
    }

    buildCategories();
    renderGallery();

    $('#search').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderGallery();
    });

    $('#hamburger').addEventListener('click', () => {
        $('#sidebar').classList.toggle('open');
    });

    document.querySelector('.logo').addEventListener('click', () => {
        activeCategory = 'pics';
        searchQuery = '';
        $('#search').value = '';
        buildCategories();
        renderGallery();
    });

    document.addEventListener('click', (e) => {
        const sidebar = $('#sidebar');
        const hamburger = $('#hamburger');
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== hamburger) {
            sidebar.classList.remove('open');
        }
    });
});
