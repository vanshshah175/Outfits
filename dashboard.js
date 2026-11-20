import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  db,
  requireAuth,
  handleFirestoreError,
  OperationType,
  escapeHtml,
  initIcons,
} from './firebase-config.js';

function renderItemThumb(item) {
  if (!item) return `<div class="outfit-collage-slot"><div class="img-fallback-box">Item</div></div>`;
  return `
    <div class="outfit-collage-slot">
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}" referrerpolicy="no-referrer"
           onerror="this.parentElement.innerHTML='<div class=&quot;img-fallback-box&quot;>${escapeHtml(item.category)}</div>';" />
    </div>
  `;
}

requireAuth(async (user, profile) => {
  const welcomeName = document.getElementById('dashboard-welcome-name');
  if (welcomeName) {
    const firstName = (profile?.name || user.displayName || 'Stylist').split(' ')[0];
    welcomeName.textContent = `Welcome back, ${firstName}`;
  }

  let wardrobeItems = [];
  let outfits = [];

  try {
    const wardrobeSnap = await getDocs(query(collection(db, 'wardrobe'), where('userId', '==', user.uid)));
    wardrobeItems = wardrobeSnap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'wardrobe');
  }

  try {
    const outfitsSnap = await getDocs(query(collection(db, 'outfits'), where('userId', '==', user.uid)));
    outfits = outfitsSnap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'outfits');
  }

  const savedFavorites = outfits.filter((o) => o.isFavorite);
  const uniqueCategories = new Set(wardrobeItems.map((i) => i.category));
  const uniqueColors = new Set(wardrobeItems.map((i) => i.color.trim().toLowerCase()));

  document.getElementById('stat-total-wardrobe').textContent = String(wardrobeItems.length);
  document.getElementById('stat-saved-outfits').textContent = String(savedFavorites.length);
  document.getElementById('stat-categories-count').textContent = String(uniqueCategories.size);
  document.getElementById('stat-colors-count').textContent = String(uniqueColors.size);

  // Category Breakdown
  const breakdownEl = document.getElementById('wardrobe-breakdown');
  if (wardrobeItems.length === 0) {
    breakdownEl.innerHTML = `
      <div class="empty-state" style="padding:28px 18px;">
        <h3>Your wardrobe is empty</h3>
        <p>Upload your shirts, trousers, shoes, and accessories to unlock tailored outfit combinations.</p>
        <a href="/wardrobe.html" class="btn btn-primary btn-sm">Upload First Item</a>
      </div>
    `;
  } else {
    const counts = {};
    wardrobeItems.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    breakdownEl.innerHTML = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => {
        const pct = Math.round((count / maxCount) * 100);
        return `
          <div class="breakdown-row">
            <span>${escapeHtml(cat)}</span>
            <div class="breakdown-bar-wrap"><div class="breakdown-bar-fill" style="width:${pct}%"></div></div>
            <strong class="tabular-nums">${count}</strong>
          </div>
        `;
      })
      .join('');
  }

  // Quick Generator Launch
  const quickWeather = document.getElementById('quick-weather');
  const quickStyle = document.getElementById('quick-style');
  if (quickWeather && profile?.defaultWeather) quickWeather.value = profile.defaultWeather;
  if (quickStyle && profile?.defaultStyle) quickStyle.value = profile.defaultStyle;

  const quickForm = document.getElementById('quick-generator-form');
  quickForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const occasion = document.getElementById('quick-occasion').value;
    const weather = quickWeather.value;
    const style = quickStyle.value;
    const params = new URLSearchParams({ occasion, weather, style, autogen: '1' });
    window.location.href = `/generate-outfit.html?${params.toString()}`;
  });

  document.querySelectorAll('[data-preset-occ]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const occasion = btn.getAttribute('data-preset-occ');
      const style = btn.getAttribute('data-preset-style') || 'Casual';
      const weather = quickWeather?.value || 'Normal';
      const params = new URLSearchParams({ occasion, weather, style, autogen: '1' });
      window.location.href = `/generate-outfit.html?${params.toString()}`;
    });
  });

  // Recent Saved Outfits
  const recentGrid = document.getElementById('recent-outfits-grid');
  const itemMap = new Map(wardrobeItems.map((i) => [i.itemId, i]));

  const recentList = (savedFavorites.length > 0 ? savedFavorites : outfits)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 3);

  if (recentList.length === 0) {
    recentGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No generated looks yet</h3>
        <p>Select an occasion to assemble combinations strictly from your own wardrobe.</p>
        <a href="/generate-outfit.html" class="btn btn-accent btn-sm">Generate Outfits</a>
      </div>
    `;
  } else {
    recentGrid.innerHTML = recentList
      .map((outfit) => {
        const items = (outfit.clothingItemIds || []).map((id) => itemMap.get(id)).filter(Boolean);
        const slots = items.slice(0, 4);
        while (slots.length < 4 && items.length > 0) {
          slots.push(items[slots.length % items.length]);
        }
        return `
          <a href="/saved-outfits.html" class="outfit-card">
            <div class="outfit-collage">
              ${slots.map(renderItemThumb).join('')}
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
          </a>
        `;
      })
      .join('');
  }

  initIcons();
});
