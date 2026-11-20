import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  requireAuth,
  handleFirestoreError,
  OperationType,
  escapeHtml,
  showToast,
  initIcons,
} from './firebase-config.js';

let currentUser = null;
let allOutfits = [];
let wardrobeMap = new Map();
let activeFilter = 'all';
let activeOccasionFilter = 'All';
let activeModalOutfit = null;

function resolveOutfitItems(outfit) {
  return (outfit.clothingItemIds || []).map((id) => wardrobeMap.get(id)).filter(Boolean);
}

function populateOccasionFilter() {
  const select = document.getElementById('saved-occasion-filter');
  if (!select) return;
  const occasions = Array.from(new Set(allOutfits.map((o) => o.occasion))).sort();
  select.innerHTML = `<option value="All">All Occasions</option>` +
    occasions.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
}

function renderSavedOutfits() {
  const grid = document.getElementById('saved-outfits-grid');
  const filtered = allOutfits.filter((o) => {
    if (activeFilter === 'favorites' && !o.isFavorite) return false;
    if (activeOccasionFilter !== 'All' && o.occasion !== activeOccasionFilter) return false;
    return true;
  });

  if (allOutfits.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No saved outfits yet</h3>
        <p>Generate outfit combinations for your upcoming events and save your favorites here for quick access.</p>
        <a href="/generate-outfit.html" class="btn btn-primary">Generate Your First Look</a>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No outfits match this filter</h3>
        <p>Try viewing all saved outfits or clearing the occasion filter.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((outfit) => {
      const items = resolveOutfitItems(outfit);
      const slots = items.slice(0, 4);
      while (slots.length < 4 && items.length > 0) {
        slots.push(items[slots.length % items.length]);
      }
      return `
        <article class="outfit-card" data-saved-id="${escapeHtml(outfit.outfitId)}">
          <div class="outfit-collage">
            ${
              slots.length > 0
                ? slots
                    .map(
                      (item) => `
                  <div class="outfit-collage-slot">
                    <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}" referrerpolicy="no-referrer"
                         onerror="this.parentElement.innerHTML='<div class=&quot;img-fallback-box&quot;>${escapeHtml(item.category)}</div>';" />
                  </div>
                `
                    )
                    .join('')
                : `<div class="outfit-collage-slot" style="grid-column:span 2;"><div class="img-fallback-box">Wardrobe items updated</div></div>`
            }
          </div>
          <div class="outfit-card-body">
            <div class="meta-line">
              <span>${escapeHtml(outfit.occasion)}</span>
              <span aria-hidden="true">&middot;</span>
              <span>${escapeHtml(outfit.weather)}</span>
              <span aria-hidden="true">&middot;</span>
              <span>${escapeHtml(outfit.style)}</span>
            </div>
            <h3 class="outfit-card-title">${escapeHtml(outfit.title)}</h3>
            <p class="garment-desc">${escapeHtml(outfit.description)}</p>
          </div>
          <div class="outfit-card-footer">
            <button type="button" class="btn ${outfit.isFavorite ? 'btn-accent' : 'btn-secondary'} btn-sm" data-fav-id="${escapeHtml(outfit.outfitId)}">
              <i data-lucide="heart" width="15" height="15"></i>
              <span>${outfit.isFavorite ? 'Favorite' : 'Pin Favorite'}</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-delete-outfit-id="${escapeHtml(outfit.outfitId)}">
              <i data-lucide="trash-2" width="15" height="15"></i>
              <span>Delete</span>
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-saved-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const outfit = allOutfits.find((o) => o.outfitId === card.getAttribute('data-saved-id'));
      if (outfit) openSavedDetailModal(outfit);
    });
  });

  grid.querySelectorAll('[data-fav-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-fav-id');
      const outfit = allOutfits.find((o) => o.outfitId === id);
      if (!outfit) return;
      try {
        const nextVal = !outfit.isFavorite;
        await updateDoc(doc(db, 'outfits', id), {
          isFavorite: nextVal,
          updatedAt: serverTimestamp(),
        });
        outfit.isFavorite = nextVal;
        renderSavedOutfits();
        showToast(nextVal ? 'Pinned to favorites.' : 'Unpinned from favorites.', 'info');
      } catch (err) {
        showToast('Could not update favorite state.', 'error');
        handleFirestoreError(err, OperationType.UPDATE, `outfits/${id}`);
      }
    });
  });

  grid.querySelectorAll('[data-delete-outfit-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-outfit-id');
      await deleteSavedOutfit(id);
    });
  });

  initIcons();
}

async function deleteSavedOutfit(id) {
  try {
    await deleteDoc(doc(db, 'outfits', id));
    allOutfits = allOutfits.filter((o) => o.outfitId !== id);
    document.getElementById('saved-detail-modal')?.classList.remove('is-open');
    populateOccasionFilter();
    renderSavedOutfits();
    showToast('Outfit removed from Saved Outfits.', 'success');
  } catch (err) {
    showToast('Failed to delete outfit.', 'error');
    handleFirestoreError(err, OperationType.DELETE, `outfits/${id}`);
  }
}

function openSavedDetailModal(outfit) {
  activeModalOutfit = outfit;
  const items = resolveOutfitItems(outfit);
  document.getElementById('saved-modal-title').textContent = outfit.title;
  document.getElementById('saved-modal-meta').textContent = `${outfit.occasion} · ${outfit.weather} Weather · ${outfit.style}`;
  document.getElementById('saved-modal-description').textContent = outfit.description;
  document.getElementById('saved-modal-harmony').textContent = outfit.colorHarmony || 'Balanced palette pairing.';
  document.getElementById('saved-modal-why').textContent = outfit.whyItWorks || 'Tailored to your selected occasion.';

  document.getElementById('saved-modal-items').innerHTML =
    items.length > 0
      ? items
          .map(
            (item) => `
          <div class="detail-item-tile">
            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}" referrerpolicy="no-referrer" />
            <div class="detail-item-caption">
              <strong>${escapeHtml(item.itemName)}</strong>
              <span>${escapeHtml(item.category)} &middot; ${escapeHtml(item.color)}</span>
            </div>
          </div>
        `
          )
          .join('')
      : '<p style="color:var(--text-muted);">Some garments in this look were removed from your wardrobe.</p>';

  document.getElementById('saved-detail-modal').classList.add('is-open');
  initIcons();
}

requireAuth(async (user) => {
  currentUser = user;
  const grid = document.getElementById('saved-outfits-grid');
  grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

  try {
    const [wSnap, oSnap] = await Promise.all([
      getDocs(query(collection(db, 'wardrobe'), where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'outfits'), where('userId', '==', user.uid))),
    ]);
    wardrobeMap = new Map(wSnap.docs.map((d) => [d.data().itemId, d.data()]));
    allOutfits = oSnap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'outfits');
  }

  populateOccasionFilter();
  renderSavedOutfits();

  document.querySelectorAll('[data-saved-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-saved-tab');
      document.querySelectorAll('[data-saved-tab]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderSavedOutfits();
    });
  });

  document.getElementById('saved-occasion-filter')?.addEventListener('change', (e) => {
    activeOccasionFilter = e.target.value;
    renderSavedOutfits();
  });

  document.querySelectorAll('[data-close-saved-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('saved-detail-modal')?.classList.remove('is-open');
    });
  });

  document.getElementById('saved-modal-delete-btn')?.addEventListener('click', () => {
    if (activeModalOutfit) deleteSavedOutfit(activeModalOutfit.outfitId);
  });
});
