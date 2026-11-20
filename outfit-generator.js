import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  requireAuth,
  handleFirestoreError,
  OperationType,
  generateId,
  escapeHtml,
  showToast,
  initIcons,
} from './firebase-config.js';

export const OCCASIONS = [
  'College / University',
  'Office / Professional',
  'Casual Outing',
  'Party',
  'Date Night',
  'Wedding',
  'Birthday',
  'Gym / Workout',
  'Travel',
  'Festival',
  'Formal Meeting',
  'Interview',
];

const OCCASION_RULES = {
  'College / University': {
    preferredStyles: ['Casual', 'Streetwear', 'Smart Casual'],
    preferredTops: ['T-Shirts', 'Hoodies', 'Shirts'],
    preferredBottoms: ['Jeans', 'Trousers', 'Shorts'],
    outerwearBonus: 12,
    formality: 'relaxed',
  },
  'Office / Professional': {
    preferredStyles: ['Formal', 'Smart Casual'],
    preferredTops: ['Shirts'],
    preferredBottoms: ['Trousers'],
    outerwearBonus: 18,
    formality: 'tailored',
  },
  'Casual Outing': {
    preferredStyles: ['Casual', 'Streetwear', 'Smart Casual'],
    preferredTops: ['T-Shirts', 'Shirts', 'Hoodies'],
    preferredBottoms: ['Jeans', 'Shorts', 'Trousers'],
    outerwearBonus: 10,
    formality: 'relaxed',
  },
  Party: {
    preferredStyles: ['Streetwear', 'Smart Casual', 'Casual'],
    preferredTops: ['Shirts', 'T-Shirts'],
    preferredBottoms: ['Jeans', 'Trousers'],
    outerwearBonus: 20,
    formality: 'statement',
  },
  'Date Night': {
    preferredStyles: ['Smart Casual', 'Formal', 'Casual'],
    preferredTops: ['Shirts', 'T-Shirts'],
    preferredBottoms: ['Trousers', 'Jeans'],
    outerwearBonus: 18,
    formality: 'refined',
  },
  Wedding: {
    preferredStyles: ['Traditional', 'Formal'],
    preferredTops: ['Shirts'],
    preferredBottoms: ['Trousers'],
    outerwearBonus: 22,
    formality: 'ceremonial',
  },
  Birthday: {
    preferredStyles: ['Smart Casual', 'Streetwear', 'Casual'],
    preferredTops: ['Shirts', 'T-Shirts', 'Hoodies'],
    preferredBottoms: ['Jeans', 'Trousers'],
    outerwearBonus: 15,
    formality: 'celebratory',
  },
  'Gym / Workout': {
    preferredStyles: ['Casual', 'Streetwear'],
    preferredTops: ['T-Shirts', 'Hoodies'],
    preferredBottoms: ['Shorts', 'Trousers'],
    outerwearBonus: 4,
    formality: 'athletic',
  },
  Travel: {
    preferredStyles: ['Casual', 'Streetwear', 'Smart Casual'],
    preferredTops: ['T-Shirts', 'Hoodies', 'Shirts'],
    preferredBottoms: ['Jeans', 'Trousers', 'Shorts'],
    outerwearBonus: 16,
    formality: 'comfortable',
  },
  Festival: {
    preferredStyles: ['Traditional', 'Streetwear', 'Casual'],
    preferredTops: ['Shirts', 'T-Shirts'],
    preferredBottoms: ['Trousers', 'Jeans', 'Shorts'],
    outerwearBonus: 10,
    formality: 'expressive',
  },
  'Formal Meeting': {
    preferredStyles: ['Formal', 'Smart Casual'],
    preferredTops: ['Shirts'],
    preferredBottoms: ['Trousers'],
    outerwearBonus: 22,
    formality: 'executive',
  },
  Interview: {
    preferredStyles: ['Formal', 'Smart Casual'],
    preferredTops: ['Shirts'],
    preferredBottoms: ['Trousers'],
    outerwearBonus: 20,
    formality: 'executive',
  },
};

const NEUTRAL_COLORS = new Set([
  'black',
  'white',
  'ivory',
  'cream',
  'off-white',
  'ecru',
  'beige',
  'sand',
  'tan',
  'taupe',
  'khaki',
  'grey',
  'gray',
  'charcoal',
  'slate',
  'navy',
  'brown',
  'espresso',
  'camel',
]);

const COMPLEMENTARY_PAIRS = [
  ['blue', 'beige'],
  ['blue', 'khaki'],
  ['blue', 'white'],
  ['blue', 'grey'],
  ['light blue', 'charcoal'],
  ['light blue', 'black'],
  ['olive', 'cream'],
  ['olive', 'black'],
  ['green', 'beige'],
  ['burgundy', 'black'],
  ['burgundy', 'grey'],
  ['maroon', 'beige'],
  ['pink', 'navy'],
  ['mustard', 'navy'],
  ['rust', 'cream'],
];

function normalizeColor(c) {
  return (c || '').trim().toLowerCase();
}

function isNeutral(color) {
  const norm = normalizeColor(color);
  return Array.from(NEUTRAL_COLORS).some((n) => norm.includes(n));
}

function colorPairScore(c1, c2) {
  const a = normalizeColor(c1);
  const b = normalizeColor(c2);
  if (!a || !b) return 10;
  if (a === b) return isNeutral(a) ? 16 : 8; // monochrome neutrals work well
  if (isNeutral(a) || isNeutral(b)) return 20;
  const isPair = COMPLEMENTARY_PAIRS.some(
    ([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))
  );
  return isPair ? 22 : 9;
}

function scoreItem(item, { occasion, weather, style, colorPref }) {
  const rule = OCCASION_RULES[occasion] || OCCASION_RULES['Casual Outing'];
  let score = 20;

  // Style match
  if (style && style !== 'Any') {
    if (item.style === style) score += 28;
    else if (rule.preferredStyles.includes(item.style)) score += 12;
  } else if (rule.preferredStyles.includes(item.style)) {
    score += 24;
  }

  // Category occasion fit
  if (rule.preferredTops.includes(item.category) || rule.preferredBottoms.includes(item.category)) {
    score += 18;
  }

  // Weather & season fit
  if (weather === 'Hot') {
    if (item.season === 'Summer' || item.season === 'All Season') score += 18;
    if (item.category === 'Jackets' || item.category === 'Hoodies' || item.season === 'Winter') score -= 24;
    if (item.category === 'Shorts' || item.category === 'T-Shirts') score += 10;
  } else if (weather === 'Cold') {
    if (item.season === 'Winter' || item.season === 'Autumn' || item.season === 'All Season') score += 18;
    if (item.category === 'Jackets' || item.category === 'Hoodies') score += 22;
    if (item.category === 'Shorts') score -= 30;
  } else if (weather === 'Rainy') {
    if (item.season === 'Monsoon' || item.season === 'All Season') score += 18;
    if (item.category === 'Jackets') score += 15;
  } else {
    if (item.season === 'All Season' || item.season === 'Spring' || item.season === 'Autumn') score += 10;
  }

  // Optional color preference
  if (colorPref) {
    const prefNorm = normalizeColor(colorPref);
    if (normalizeColor(item.color).includes(prefNorm)) {
      score += 24;
    }
  }

  return score;
}

function buildColorHarmonyExplanation(items) {
  const colors = Array.from(new Set(items.map((i) => i.color.trim()).filter(Boolean)));
  if (colors.length <= 1) {
    return `A cohesive monochrome palette anchored in ${colors[0] || 'balanced tones'} creates a sharp, elongated silhouette.`;
  }
  const neutralList = colors.filter((c) => isNeutral(c));
  const accentList = colors.filter((c) => !isNeutral(c));
  if (accentList.length === 0) {
    return `Grounding ${colors.join(', ')} together delivers understated tonal contrast with effortless versatility.`;
  }
  if (neutralList.length > 0) {
    return `${accentList.join(' & ')} acts as the focal tone, balanced cleanly by neutral ${neutralList.join(' and ')} pieces.`;
  }
  return `Pairing ${colors.join(' with ')} introduces deliberate color contrast suited to the occasion.`;
}

function buildWhyItWorks(items, { occasion, weather, style }) {
  const rule = OCCASION_RULES[occasion] || OCCASION_RULES['Casual Outing'];
  const cats = items.map((i) => i.category).join(', ');
  const weatherNote =
    weather === 'Hot'
      ? 'keeps silhouettes breathable for warm conditions'
      : weather === 'Cold'
        ? 'layers structure for cooler temperatures'
        : weather === 'Rainy'
          ? 'leans on practical coverage for wet weather'
          : 'balances comfort and proportion for temperate weather';
  return `Combines your ${cats.toLowerCase()} in a ${rule.formality} ${style === 'Any' ? items[0]?.style || 'versatile' : style.toLowerCase()} direction for ${occasion}, while ${weatherNote}.`;
}

/**
 * Rule-based modular recommendation engine.
 * Strictly draws from the user's real wardrobe items and guarantees unique combinations.
 */
export function generateOutfitCombinations(wardrobeItems, prefs, seedOffset = 0) {
  const tops = wardrobeItems.filter((i) => ['Shirts', 'T-Shirts', 'Hoodies'].includes(i.category));
  const bottoms = wardrobeItems.filter((i) => ['Jeans', 'Trousers', 'Shorts'].includes(i.category));
  const shoes = wardrobeItems.filter((i) => i.category === 'Shoes');
  const outerwear = wardrobeItems.filter((i) => ['Jackets', 'Hoodies'].includes(i.category));
  const accessories = wardrobeItems.filter((i) => ['Watches', 'Accessories'].includes(i.category));

  if (tops.length === 0 || bottoms.length === 0) {
    const missing = [];
    if (tops.length === 0) missing.push('at least 1 Topwear item (Shirt, T-Shirt, or Hoodie)');
    if (bottoms.length === 0) missing.push('at least 1 Bottomwear item (Jeans, Trousers, or Shorts)');
    return {
      outfits: [],
      missingMessage: `To assemble complete outfits, please upload ${missing.join(' and ')} in My Wardrobe.`,
    };
  }

  const rank = (arr) =>
    arr
      .map((item, idx) => ({
        item,
        score: scoreItem(item, prefs) + (((idx + seedOffset) % 5) * 1.5),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);

  const rankedTops = rank(tops);
  const rankedBottoms = rank(bottoms);
  const rankedShoes = rank(shoes);
  const rankedOuterwear = rank(outerwear);
  const rankedAccessories = rank(accessories);

  const candidates = [];
  const seenSignatures = new Set();

  for (let tIdx = 0; tIdx < rankedTops.length; tIdx++) {
    for (let bIdx = 0; bIdx < rankedBottoms.length; bIdx++) {
      const top = rankedTops[tIdx];
      const bottom = rankedBottoms[bIdx];

      // Pick best matching shoe
      const shoe =
        rankedShoes.length > 0
          ? rankedShoes[(tIdx + bIdx + seedOffset) % rankedShoes.length]
          : null;

      // Pick optional outerwear if weather is Cold/Rainy or Jacket fits occasion
      let layer = null;
      if (rankedOuterwear.length > 0) {
        const candidateLayer = rankedOuterwear.find((o) => o.itemId !== top.itemId);
        if (candidateLayer && (prefs.weather === 'Cold' || prefs.weather === 'Rainy' || candidateLayer.category === 'Jackets')) {
          if (prefs.weather !== 'Hot') {
            layer = candidateLayer;
          }
        }
      }

      // Pick optional accessory / watch
      const acc =
        rankedAccessories.length > 0
          ? rankedAccessories[(tIdx + bIdx + seedOffset) % rankedAccessories.length]
          : null;

      const items = [top, bottom, shoe, layer, acc].filter(Boolean);
      const signature = items
        .map((i) => i.itemId)
        .sort()
        .join('|');

      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);

      const pairScore =
        scoreItem(top, prefs) +
        scoreItem(bottom, prefs) +
        colorPairScore(top.color, bottom.color) +
        (shoe ? colorPairScore(bottom.color, shoe.color) * 0.6 : 0) +
        (layer ? 10 : 0);

      candidates.push({ items, pairScore });
    }
  }

  // Sort by compatibility score and apply seed rotation for "Try Another Combination"
  candidates.sort((a, b) => b.pairScore - a.pairScore);
  const pool = candidates.slice(0, Math.min(12, candidates.length));
  if (seedOffset > 0 && pool.length > 3) {
    const shift = seedOffset % pool.length;
    const rotated = [...pool.slice(shift), ...pool.slice(0, shift)];
    pool.splice(0, pool.length, ...rotated);
  }

  const chosen = pool.slice(0, Math.min(5, pool.length));
  const resolvedStyle = prefs.style === 'Any' ? chosen[0]?.items[0]?.style || 'Smart Casual' : prefs.style;

  const outfits = chosen.map((combo, index) => {
    const { items } = combo;
    const top = items[0];
    const bottom = items[1];
    const title = `${prefs.occasion.split(' / ')[0]} Look ${index + 1}: ${top.color} & ${bottom.color}`;
    const colorHarmony = buildColorHarmonyExplanation(items);
    const whyItWorks = buildWhyItWorks(items, prefs);
    const description = `${top.itemName} paired with ${bottom.itemName}${items[2] ? ` and ${items[2].itemName}` : ''}.`;

    const colorScore = colorPairScore(top.color, bottom.color);
    const totalScore = Math.round(combo.pairScore);

    return {
      outfitId: generateId('outfit'),
      title,
      occasion: prefs.occasion,
      weather: prefs.weather,
      style: resolvedStyle,
      clothingItemIds: items.map((i) => i.itemId),
      items,
      description,
      colorHarmony,
      whyItWorks,
      scoreSummary: `Total Rule Score: ${totalScore} pts · Top-Bottom Color Compatibility: ${colorScore}/22 pts · Matched ${items.length} wardrobe items for ${prefs.occasion} (${prefs.weather} weather).`,
      isFavorite: false,
      savedInDb: false,
    };
  });

  const missingHints = [];
  if (shoes.length === 0) missingHints.push('footwear');
  if (accessories.length === 0) missingHints.push('watches or accessories');

  return {
    outfits,
    missingMessage:
      outfits.length < 3
        ? `Generated ${outfits.length} unique combination${outfits.length === 1 ? '' : 's'} from your current wardrobe. Upload more tops or bottoms to unlock 3–5 variations.`
        : missingHints.length > 0
          ? `Tip: Upload ${missingHints.join(' and ')} to make your outfit cards even more complete.`
          : '',
  };
}

// ==========================================================================
// Page Controller (runs only when generate-outfit.html elements are present)
// ==========================================================================
let currentUser = null;
let wardrobeItems = [];
let savedOutfitIds = new Set();
let generatedOutfits = [];
let selectedOccasion = OCCASIONS[0];
let seedCounter = 0;
let activeModalOutfit = null;

function renderOccasionSelector() {
  const grid = document.getElementById('occasion-selector-grid');
  if (!grid) return;
  grid.innerHTML = OCCASIONS.map(
    (occ) => `
      <button type="button" class="occasion-option ${occ === selectedOccasion ? 'is-active' : ''}" data-occ="${escapeHtml(occ)}">
        ${escapeHtml(occ)}
      </button>
    `
  ).join('');

  grid.querySelectorAll('[data-occ]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedOccasion = btn.getAttribute('data-occ');
      grid.querySelectorAll('[data-occ]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });
}

function renderGeneratedResults(missingMessage = '') {
  const resultsEl = document.getElementById('generated-outfits-grid');
  const noticeEl = document.getElementById('generator-notice');
  if (!resultsEl) return;

  if (noticeEl) {
    if (missingMessage) {
      noticeEl.textContent = missingMessage;
      noticeEl.classList.remove('hidden');
    } else {
      noticeEl.classList.add('hidden');
    }
  }

  if (generatedOutfits.length === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>Not enough items to build this outfit</h3>
        <p>${escapeHtml(missingMessage || 'Upload tops, bottoms, and shoes in My Wardrobe first.')}</p>
        <a href="/wardrobe.html" class="btn btn-primary">Go to My Wardrobe</a>
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = generatedOutfits
    .map((outfit) => {
      const slots = outfit.items.slice(0, 4);
      while (slots.length < 4 && outfit.items.length > 0) {
        slots.push(outfit.items[slots.length % outfit.items.length]);
      }
      const isSaved = savedOutfitIds.has(outfit.outfitId);
      return `
        <article class="outfit-card" data-outfit-id="${escapeHtml(outfit.outfitId)}">
          <div class="outfit-collage">
            ${slots
              .map(
                (item) => `
              <div class="outfit-collage-slot">
                <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}" referrerpolicy="no-referrer"
                     onerror="this.parentElement.innerHTML='<div class=&quot;img-fallback-box&quot;>${escapeHtml(item.category)}</div>';" />
              </div>
            `
              )
              .join('')}
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
            <ul class="outfit-items-summary">
              ${outfit.items
                .map(
                  (item) => `
                <li>
                  <span>${escapeHtml(item.itemName)}</span>
                  <span style="color:var(--text-muted);">${escapeHtml(item.category)}</span>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
          <div class="outfit-card-footer">
            <button type="button" class="btn btn-ghost btn-sm" data-inspect-id="${escapeHtml(outfit.outfitId)}">
              <i data-lucide="eye" width="15" height="15"></i>
              <span>Details</span>
            </button>
            <button type="button" class="btn ${isSaved ? 'btn-accent' : 'btn-secondary'} btn-sm" data-quick-save-id="${escapeHtml(outfit.outfitId)}">
              <i data-lucide="heart" width="15" height="15"></i>
              <span>${isSaved ? 'Saved' : 'Save Outfit'}</span>
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  resultsEl.querySelectorAll('[data-outfit-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-quick-save-id]')) return;
      const outfit = generatedOutfits.find((o) => o.outfitId === card.getAttribute('data-outfit-id'));
      if (outfit) openOutfitDetailModal(outfit);
    });
  });

  resultsEl.querySelectorAll('[data-quick-save-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const outfit = generatedOutfits.find((o) => o.outfitId === btn.getAttribute('data-quick-save-id'));
      if (outfit) await toggleSaveOutfit(outfit);
    });
  });

  initIcons();
}

function openOutfitDetailModal(outfit) {
  activeModalOutfit = outfit;
  const modal = document.getElementById('outfit-detail-modal');
  document.getElementById('detail-modal-title').textContent = outfit.title;
  document.getElementById('detail-modal-meta').textContent = `${outfit.occasion} · ${outfit.weather} Weather · ${outfit.style}`;
  document.getElementById('detail-modal-description').textContent = outfit.description;
  document.getElementById('detail-modal-harmony').textContent = outfit.colorHarmony;
  document.getElementById('detail-modal-why').textContent = outfit.whyItWorks;
  const breakdownEl = document.getElementById('detail-modal-score-breakdown');
  if (breakdownEl) {
    breakdownEl.textContent = outfit.scoreSummary || 'Computed via category, occasion, climate, and color harmony rules.';
  }

  const itemsGrid = document.getElementById('detail-modal-items');
  itemsGrid.innerHTML = outfit.items
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
    .join('');

  const isSaved = savedOutfitIds.has(outfit.outfitId);
  const saveBtn = document.getElementById('detail-save-btn');
  const removeBtn = document.getElementById('detail-remove-btn');
  if (isSaved) {
    saveBtn.classList.add('hidden');
    removeBtn.classList.remove('hidden');
  } else {
    saveBtn.classList.remove('hidden');
    removeBtn.classList.add('hidden');
  }

  modal.classList.add('is-open');
  initIcons();
}

async function toggleSaveOutfit(outfit) {
  if (!currentUser) return;
  const isSaved = savedOutfitIds.has(outfit.outfitId);
  try {
    if (isSaved) {
      await deleteDoc(doc(db, 'outfits', outfit.outfitId));
      savedOutfitIds.delete(outfit.outfitId);
      showToast('Removed from Saved Outfits.', 'info');
    } else {
      await setDoc(doc(db, 'outfits', outfit.outfitId), {
        outfitId: outfit.outfitId,
        userId: currentUser.uid,
        title: outfit.title.slice(0, 120),
        occasion: outfit.occasion.slice(0, 60),
        weather: outfit.weather,
        style: outfit.style,
        clothingItemIds: outfit.clothingItemIds.slice(0, 10),
        description: outfit.description.slice(0, 800),
        colorHarmony: outfit.colorHarmony.slice(0, 400),
        whyItWorks: outfit.whyItWorks.slice(0, 600),
        isFavorite: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      savedOutfitIds.add(outfit.outfitId);
      showToast('Outfit saved to My Saved Outfits.', 'success');
    }
    renderGeneratedResults(document.getElementById('generator-notice')?.textContent || '');
    if (activeModalOutfit?.outfitId === outfit.outfitId) {
      openOutfitDetailModal(outfit);
    }
  } catch (err) {
    showToast('Could not update saved outfit.', 'error');
    handleFirestoreError(err, OperationType.WRITE, `outfits/${outfit.outfitId}`);
  }
}

function runGeneration(incrementSeed = false) {
  if (incrementSeed) seedCounter += 1;
  const weather = document.getElementById('gen-weather').value;
  const style = document.getElementById('gen-style').value;
  const colorPref = document.getElementById('gen-color').value.trim();

  const { outfits, missingMessage } = generateOutfitCombinations(
    wardrobeItems,
    { occasion: selectedOccasion, weather, style, colorPref },
    seedCounter
  );
  generatedOutfits = outfits;
  renderGeneratedResults(missingMessage);
}

if (document.getElementById('occasion-selector-grid')) {
  requireAuth(async (user, profile) => {
    currentUser = user;

    const params = new URLSearchParams(window.location.search);
    if (params.get('occasion') && OCCASIONS.includes(params.get('occasion'))) {
      selectedOccasion = params.get('occasion');
    }
    if (params.get('weather')) {
      document.getElementById('gen-weather').value = params.get('weather');
    } else if (profile?.defaultWeather) {
      document.getElementById('gen-weather').value = profile.defaultWeather;
    }
    if (params.get('style')) {
      document.getElementById('gen-style').value = params.get('style');
    } else if (profile?.defaultStyle) {
      document.getElementById('gen-style').value = profile.defaultStyle;
    }

    renderOccasionSelector();

    try {
      const snap = await getDocs(query(collection(db, 'wardrobe'), where('userId', '==', user.uid)));
      wardrobeItems = snap.docs.map((d) => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'wardrobe');
    }

    document.getElementById('generator-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      runGeneration(false);
    });

    document.getElementById('regenerate-btn')?.addEventListener('click', () => {
      runGeneration(true);
    });

    document.querySelectorAll('[data-close-detail-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('outfit-detail-modal')?.classList.remove('is-open');
      });
    });

    document.getElementById('detail-save-btn')?.addEventListener('click', () => {
      if (activeModalOutfit) toggleSaveOutfit(activeModalOutfit);
    });

    document.getElementById('detail-remove-btn')?.addEventListener('click', () => {
      if (activeModalOutfit) toggleSaveOutfit(activeModalOutfit);
    });

    document.getElementById('detail-try-another-btn')?.addEventListener('click', () => {
      document.getElementById('outfit-detail-modal')?.classList.remove('is-open');
      runGeneration(true);
    });

    if (wardrobeItems.length > 0 || params.get('autogen') === '1') {
      runGeneration(false);
    } else {
      renderGeneratedResults('Upload your clothes in My Wardrobe to start generating personalized outfit combinations.');
    }
  });
}
