import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  requireAuth,
  handleFirestoreError,
  OperationType,
  uploadImageAsset,
  deleteStorageAsset,
  generateId,
  escapeHtml,
  showToast,
  initIcons,
} from './firebase-config.js';

let currentUser = null;
let allItems = [];
let activeCategory = 'All';
let selectedFile = null;
let editingItemId = null;

const CATEGORIES = [
  'Shirts',
  'T-Shirts',
  'Jeans',
  'Trousers',
  'Shorts',
  'Jackets',
  'Hoodies',
  'Shoes',
  'Watches',
  'Accessories',
];

function openGarmentModal(item = null) {
  const modal = document.getElementById('garment-modal');
  const titleEl = document.getElementById('garment-modal-title');
  const submitBtn = document.getElementById('garment-submit-btn');
  const form = document.getElementById('garment-form');
  const preview = document.getElementById('garment-image-preview');
  const placeholder = document.getElementById('upload-placeholder');

  form.reset();
  selectedFile = null;
  editingItemId = item ? item.itemId : null;

  if (item) {
    titleEl.textContent = 'Edit Wardrobe Item';
    submitBtn.textContent = 'Save Changes';
    document.getElementById('item-name').value = item.itemName;
    document.getElementById('item-category').value = item.category;
    document.getElementById('item-color').value = item.color;
    document.getElementById('item-style').value = item.style;
    document.getElementById('item-season').value = item.season;
    document.getElementById('item-description').value = item.description || '';
    preview.src = item.imageUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    titleEl.textContent = 'Add Wardrobe Item';
    submitBtn.textContent = 'Add to Wardrobe';
    preview.classList.add('hidden');
    preview.removeAttribute('src');
    placeholder.classList.remove('hidden');
  }

  modal.classList.add('is-open');
}

function closeGarmentModal() {
  document.getElementById('garment-modal')?.classList.remove('is-open');
}

function populateColorFilter() {
  const colorSelect = document.getElementById('filter-color');
  if (!colorSelect) return;
  const previous = colorSelect.value;
  const colors = Array.from(new Set(allItems.map((i) => i.color.trim()).filter(Boolean))).sort();
  colorSelect.innerHTML = `<option value="All">All Colors</option>` +
    colors.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (colors.includes(previous)) {
    colorSelect.value = previous;
  }
}

const STARTER_CAMPUS_ITEMS = [
  {
    itemName: 'Heavyweight White Crew Tee',
    category: 'T-Shirts',
    color: 'White',
    style: 'Casual',
    season: 'All Season',
    description: 'Everyday breathable cotton tee ideal for daily lectures and casual campus hangouts.',
    imageUrl: '/src/assets/images/garment_white_tee_1794816094719.jpg',
  },
  {
    itemName: 'Sky Blue Oxford Shirt',
    category: 'Shirts',
    color: 'Light Blue',
    style: 'Smart Casual',
    season: 'All Season',
    description: 'Clean button-down Oxford shirt suitable for viva presentations, labs, and interviews.',
    imageUrl: '/src/assets/images/garment_blue_shirt_1794816095321.jpg',
  },
  {
    itemName: 'Matte Black Straight Jeans',
    category: 'Jeans',
    color: 'Black',
    style: 'Casual',
    season: 'All Season',
    description: 'Versatile straight-fit black denim that pairs cleanly with tees, hoodies, and shirts.',
    imageUrl: '/src/assets/images/garment_black_jeans_1794816097507.jpg',
  },
  {
    itemName: 'Charcoal Tailored Trousers',
    category: 'Trousers',
    color: 'Charcoal',
    style: 'Formal',
    season: 'All Season',
    description: 'Structured grey trousers tailored for formal presentations, placements, and events.',
    imageUrl: '/src/assets/images/garment_charcoal_trousers_1794816096686.jpg',
  },
  {
    itemName: 'White Leather Court Sneakers',
    category: 'Shoes',
    color: 'White',
    style: 'Casual',
    season: 'All Season',
    description: 'Minimalist low-top sneakers built for all-day walking across campus.',
    imageUrl: '/src/assets/images/garment_white_sneakers_1794816096298.jpg',
  },
];

async function loadStarterCampusWardrobe(btn) {
  if (!currentUser) return;
  btn.disabled = true;
  btn.textContent = 'Adding 5 starter items...';
  try {
    for (const sample of STARTER_CAMPUS_ITEMS) {
      const itemId = generateId('item');
      await setDoc(doc(db, 'wardrobe', itemId), {
        itemId,
        userId: currentUser.uid,
        itemName: sample.itemName,
        category: sample.category,
        color: sample.color,
        style: sample.style,
        season: sample.season,
        description: sample.description,
        imageUrl: sample.imageUrl,
        storagePath: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    showToast('Added 5 starter campus items to your Firestore wardrobe.', 'success');
    await fetchWardrobe();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Load 5 Starter Campus Items';
    showToast('Could not add starter items. Check permissions.', 'error');
    handleFirestoreError(err, OperationType.CREATE, 'wardrobe');
  }
}

function renderWardrobeGrid() {
  const grid = document.getElementById('wardrobe-grid');
  const countEl = document.getElementById('wardrobe-count-label');
  const searchVal = (document.getElementById('wardrobe-search')?.value || '').trim().toLowerCase();
  const colorFilter = document.getElementById('filter-color')?.value || 'All';
  const styleFilter = document.getElementById('filter-style')?.value || 'All';

  const filtered = allItems.filter((item) => {
    if (activeCategory !== 'All' && item.category !== activeCategory) return false;
    if (colorFilter !== 'All' && item.color.toLowerCase() !== colorFilter.toLowerCase()) return false;
    if (styleFilter !== 'All' && item.style !== styleFilter) return false;
    if (searchVal) {
      const hay = `${item.itemName} ${item.category} ${item.color} ${item.style} ${item.description || ''}`.toLowerCase();
      if (!hay.includes(searchVal)) return false;
    }
    return true;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} of ${allItems.length} items`;
  }

  if (allItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>Start building your digital wardrobe</h3>
        <p>Upload photos of the clothes you already own—shirts, jeans, shoes, jackets, and accessories—or load a 5-piece college starter set to test outfit generation right away.</p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button type="button" class="btn btn-primary" id="empty-add-item-btn">Upload Your First Garment</button>
          <button type="button" class="btn btn-secondary" id="load-starter-btn">Load 5 Starter Campus Items</button>
        </div>
      </div>
    `;
    document.getElementById('empty-add-item-btn')?.addEventListener('click', () => openGarmentModal());
    const starterBtn = document.getElementById('load-starter-btn');
    starterBtn?.addEventListener('click', () => loadStarterCampusWardrobe(starterBtn));
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No matching garments</h3>
        <p>Try clearing your category, color, or search filter to see all uploaded items.</p>
        <button type="button" class="btn btn-secondary" id="reset-filters-btn">Reset Filters</button>
      </div>
    `;
    document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
      activeCategory = 'All';
      document.getElementById('wardrobe-search').value = '';
      document.getElementById('filter-color').value = 'All';
      document.getElementById('filter-style').value = 'All';
      document.querySelectorAll('[data-cat-tab]').forEach((t) => {
        t.classList.toggle('is-active', t.getAttribute('data-cat-tab') === 'All');
      });
      renderWardrobeGrid();
    });
    return;
  }

  grid.innerHTML = filtered
    .map(
      (item) => `
      <article class="garment-card" data-item-id="${escapeHtml(item.itemId)}">
        <div class="garment-media">
          <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}" referrerpolicy="no-referrer"
               onerror="this.parentElement.innerHTML='<div class=&quot;img-fallback-box&quot;>${escapeHtml(item.category)}</div>';" />
        </div>
        <div class="garment-body">
          <div class="meta-line">
            <span>${escapeHtml(item.category)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>${escapeHtml(item.color)}</span>
          </div>
          <h3 class="garment-title">${escapeHtml(item.itemName)}</h3>
          <div class="meta-line">
            <span>${escapeHtml(item.style)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>${escapeHtml(item.season)}</span>
          </div>
          ${item.description ? `<p class="garment-desc">${escapeHtml(item.description)}</p>` : ''}
          <div class="garment-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-id="${escapeHtml(item.itemId)}">
              <i data-lucide="pencil" width="15" height="15"></i>
              <span>Edit</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-delete-id="${escapeHtml(item.itemId)}">
              <i data-lucide="trash-2" width="15" height="15"></i>
              <span>Delete</span>
            </button>
          </div>
        </div>
      </article>
    `
    )
    .join('');

  grid.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = allItems.find((i) => i.itemId === btn.getAttribute('data-edit-id'));
      if (target) openGarmentModal(target);
    });
  });

  grid.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-id');
      const target = allItems.find((i) => i.itemId === id);
      if (!target || !currentUser) return;
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, 'wardrobe', id));
        await deleteStorageAsset(target.storagePath);
        allItems = allItems.filter((i) => i.itemId !== id);
        populateColorFilter();
        renderWardrobeGrid();
        showToast(`Removed "${target.itemName}" from wardrobe.`, 'success');
      } catch (err) {
        btn.disabled = false;
        showToast('Unable to delete item. Check your permissions.', 'error');
        handleFirestoreError(err, OperationType.DELETE, `wardrobe/${id}`);
      }
    });
  });

  initIcons();
}

async function fetchWardrobe() {
  const grid = document.getElementById('wardrobe-grid');
  grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
  try {
    const snap = await getDocs(query(collection(db, 'wardrobe'), where('userId', '==', currentUser.uid)));
    allItems = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    populateColorFilter();
    renderWardrobeGrid();
  } catch (err) {
    grid.innerHTML = `<div class="alert-box alert-error">Failed to load wardrobe items.</div>`;
    handleFirestoreError(err, OperationType.LIST, 'wardrobe');
  }
}

function setupCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;
  const tabs = ['All', ...CATEGORIES];
  container.innerHTML = tabs
    .map(
      (cat) => `
      <button type="button" class="segmented-btn ${cat === 'All' ? 'is-active' : ''}" data-cat-tab="${escapeHtml(cat)}">
        ${escapeHtml(cat)}
      </button>
    `
    )
    .join('');

  container.querySelectorAll('[data-cat-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-cat-tab');
      container.querySelectorAll('[data-cat-tab]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderWardrobeGrid();
    });
  });
}

function setupUploadDropzone() {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('item-image-input');
  const preview = document.getElementById('garment-image-preview');
  const placeholder = document.getElementById('upload-placeholder');

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image is too large. Please pick an image under 10 MB.', 'error');
      return;
    }
    selectedFile = file;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
  };

  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    handleFile(e.dataTransfer.files?.[0]);
  });
}

requireAuth(async (user) => {
  currentUser = user;
  setupCategoryTabs();
  setupUploadDropzone();

  document.getElementById('open-add-modal-btn')?.addEventListener('click', () => openGarmentModal());
  document.querySelectorAll('[data-close-garment-modal]').forEach((btn) => {
    btn.addEventListener('click', closeGarmentModal);
  });

  document.getElementById('wardrobe-search')?.addEventListener('input', renderWardrobeGrid);
  document.getElementById('filter-color')?.addEventListener('change', renderWardrobeGrid);
  document.getElementById('filter-style')?.addEventListener('change', renderWardrobeGrid);

  document.getElementById('garment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const itemName = document.getElementById('item-name').value.trim();
    const category = document.getElementById('item-category').value;
    const color = document.getElementById('item-color').value.trim();
    const style = document.getElementById('item-style').value;
    const season = document.getElementById('item-season').value;
    const description = document.getElementById('item-description').value.trim();

    if (!itemName || !color) {
      showToast('Please provide the garment name and color.', 'error');
      return;
    }

    if (!editingItemId && !selectedFile) {
      showToast('Please upload an image of your clothing item.', 'error');
      return;
    }

    const submitBtn = document.getElementById('garment-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = editingItemId ? 'Saving...' : 'Uploading...';

    try {
      const itemId = editingItemId || generateId('item');
      const existingItem = editingItemId ? allItems.find((i) => i.itemId === editingItemId) : null;

      let imageUrl = existingItem?.imageUrl || '';
      let storagePath = existingItem?.storagePath || '';

      if (selectedFile) {
        const uploaded = await uploadImageAsset(currentUser.uid, 'wardrobe', itemId, selectedFile);
        imageUrl = uploaded.imageUrl;
        storagePath = uploaded.storagePath;
      }

      if (editingItemId) {
        const updatePayload = {
          itemName: itemName.slice(0, 100),
          category,
          color: color.slice(0, 40),
          style,
          season,
          description: description.slice(0, 500),
          imageUrl,
          storagePath,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, 'wardrobe', itemId), updatePayload);
        showToast(`Updated "${itemName}".`, 'success');
      } else {
        const createPayload = {
          itemId,
          userId: currentUser.uid,
          itemName: itemName.slice(0, 100),
          category,
          color: color.slice(0, 40),
          style,
          season,
          description: description.slice(0, 500),
          imageUrl,
          storagePath,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'wardrobe', itemId), createPayload);
        showToast(`Added "${itemName}" to your wardrobe.`, 'success');
      }

      closeGarmentModal();
      await fetchWardrobe();
    } catch (err) {
      showToast(err.message || 'Could not save wardrobe item.', 'error');
      if (String(err?.message || '').includes('permissions')) {
        handleFirestoreError(err, editingItemId ? OperationType.UPDATE : OperationType.CREATE, 'wardrobe');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingItemId ? 'Save Changes' : 'Add to Wardrobe';
    }
  });

  await fetchWardrobe();
});
