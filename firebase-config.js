import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  createIcons,
  Sun,
  Moon,
  Menu,
  X,
  Plus,
  Search,
  LayoutDashboard,
  Shirt,
  Layers,
  Bookmark,
  User,
  LogOut,
  Upload,
  Pencil,
  Trash2,
  Heart,
  RefreshCw,
  CircleCheck,
  CircleAlert,
  ArrowRight,
  Eye,
  Check,
  Image,
  Camera,
  Lock,
  SlidersHorizontal,
} from 'lucide';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const INTERNAL_ID_DOMAIN = 'users.outfitai.app';

export function normalizeLoginId(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

export function toInternalAuthEmail(loginId) {
  const clean = normalizeLoginId(loginId);
  return `${clean}@${INTERNAL_ID_DOMAIN}`;
}

export function extractLoginId(user) {
  const rawEmail = user?.email || '';
  if (rawEmail.endsWith(`@${INTERNAL_ID_DOMAIN}`)) {
    return rawEmail.slice(0, -(`@${INTERNAL_ID_DOMAIN}`.length));
  }
  if (rawEmail.includes('@')) {
    return normalizeLoginId(rawEmail.split('@')[0]) || user.uid.slice(0, 8);
  }
  return user?.uid?.slice(0, 8) || 'member';
}

export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
});

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const ICON_MAP = {
  Sun,
  Moon,
  Menu,
  X,
  Plus,
  Search,
  LayoutDashboard,
  Shirt,
  Layers,
  Bookmark,
  User,
  LogOut,
  Upload,
  Pencil,
  Trash2,
  Heart,
  RefreshCw,
  CircleCheck,
  CircleAlert,
  ArrowRight,
  Eye,
  Check,
  Image,
  Camera,
  Lock,
  SlidersHorizontal,
};

export function initIcons() {
  createIcons({ icons: ICON_MAP });
}

export function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('outfit_ai_theme');
  if (saved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const syncButtons = () => {
    const isDark = root.classList.contains('dark');
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = isDark
        ? '<i data-lucide="sun" width="18" height="18"></i>'
        : '<i data-lucide="moon" width="18" height="18"></i>';
    });
    initIcons();
  };

  syncButtons();

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.classList.toggle('dark');
      localStorage.setItem('outfit_ai_theme', root.classList.contains('dark') ? 'dark' : 'light');
      syncButtons();
    });
  });
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  const iconName = type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'layers';
  toast.innerHTML = `<i data-lucide="${iconName}" width="18" height="18"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  initIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
    setTimeout(() => toast.remove(), 200);
  }, 3600);
}

export function generateId(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function compressImage(file, maxDimension = 960, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Invalid image format. Please choose a JPG, PNG, or WebP file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not process image.'));
              return;
            }
            const fbScale = Math.min(1, 560 / Math.max(img.width, img.height));
            const fbCanvas = document.createElement('canvas');
            fbCanvas.width = Math.max(1, Math.round(img.width * fbScale));
            fbCanvas.height = Math.max(1, Math.round(img.height * fbScale));
            const fbCtx = fbCanvas.getContext('2d');
            fbCtx.drawImage(img, 0, 0, fbCanvas.width, fbCanvas.height);
            const fallbackDataUrl = fbCanvas.toDataURL('image/jpeg', 0.72);
            resolve({ blob, fallbackDataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImageAsset(userId, folder, assetId, file) {
  const { blob, fallbackDataUrl } = await compressImage(file);
  const path = `users/${userId}/${folder}/${assetId}.jpg`;
  const fileRef = storageRef(storage, path);

  try {
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    const downloadUrl = await getDownloadURL(fileRef);
    return { imageUrl: downloadUrl, storagePath: path };
  } catch (storageErr) {
    console.warn('Firebase Storage upload unavailable, using compressed image fallback:', storageErr);
    if (fallbackDataUrl.length <= 290000) {
      return { imageUrl: fallbackDataUrl, storagePath: '' };
    }
    throw new Error('Image upload failed. Please choose a smaller image file under 5 MB.');
  }
}

export async function deleteStorageAsset(storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch (err) {
    console.warn('Storage object cleanup skipped:', err);
  }
}

/**
 * Ensures the signed-in user has a profile document in /users/{uid}.
 */
export async function ensureUserProfile(user, explicitLoginId = '') {
  if (!user) return null;
  const userPath = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      return snap.data();
    }
    const resolvedLoginId = (normalizeLoginId(explicitLoginId) || extractLoginId(user)).padEnd(3, '0').slice(0, 40);
    const profilePayload = {
      userId: user.uid,
      name: (user.displayName || resolvedLoginId || 'Wardrobe Member').slice(0, 80),
      loginId: resolvedLoginId,
      profileImage: (user.photoURL || '').slice(0, 300000),
      defaultStyle: 'Casual',
      defaultWeather: 'Normal',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', user.uid), profilePayload);
    return profilePayload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
    return null;
  }
}

export function initAppShellNavigation() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const openBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');

  const closeMenu = () => {
    sidebar?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
  };

  openBtn?.addEventListener('click', () => {
    sidebar?.classList.add('is-open');
    backdrop?.classList.add('is-open');
  });

  closeBtn?.addEventListener('click', closeMenu);
  backdrop?.addEventListener('click', closeMenu);

  document.querySelectorAll('[data-logout-btn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = '/login.html';
      } catch (err) {
        showToast(err.message || 'Sign out failed.', 'error');
      }
    });
  });
}

export function updateSidebarUser(user, profile) {
  const nameEl = document.getElementById('sidebar-user-name');
  const idEl = document.getElementById('sidebar-user-email');
  const avatarEl = document.getElementById('sidebar-avatar');

  const loginId = profile?.loginId || extractLoginId(user);
  const displayName = profile?.name || user.displayName || loginId || 'Member';
  if (nameEl) nameEl.textContent = displayName;
  if (idEl) idEl.textContent = `@${loginId}`;

  if (avatarEl) {
    const imgUrl = profile?.profileImage || user.photoURL || '';
    if (imgUrl) {
      avatarEl.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(displayName)}" referrerpolicy="no-referrer" />`;
    } else {
      avatarEl.textContent = displayName.charAt(0).toUpperCase();
    }
  }
}

/**
 * Auth guard for authenticated workspace pages.
 */
export function requireAuth(onReady) {
  initTheme();
  initAppShellNavigation();
  initIcons();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }
    const profile = await ensureUserProfile(user);
    updateSidebarUser(user, profile);
    await onReady(user, profile);
    initIcons();
  });
}
