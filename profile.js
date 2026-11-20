import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  db,
  requireAuth,
  handleFirestoreError,
  OperationType,
  uploadImageAsset,
  updateSidebarUser,
  extractLoginId,
  escapeHtml,
  showToast,
} from './firebase-config.js';

let currentUser = null;
let selectedAvatarFile = null;

function renderAvatarPreview(url, name) {
  const box = document.getElementById('profile-avatar-box');
  if (!box) return;
  if (url) {
    box.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" referrerpolicy="no-referrer" />`;
  } else {
    box.textContent = (name || 'U').charAt(0).toUpperCase();
  }
}

requireAuth(async (user, profile) => {
  currentUser = user;
  const loginId = profile?.loginId || extractLoginId(user);
  const displayName = profile?.name || user.displayName || loginId;
  const avatarUrl = profile?.profileImage || user.photoURL || '';

  document.getElementById('profile-name').value = displayName;
  document.getElementById('profile-login-id').value = `@${loginId}`;
  document.getElementById('profile-default-style').value = profile?.defaultStyle || 'Casual';
  document.getElementById('profile-default-weather').value = profile?.defaultWeather || 'Normal';
  document.getElementById('profile-summary-name').textContent = displayName || 'Wardrobe Member';
  document.getElementById('profile-summary-id').textContent = `User ID: @${loginId}`;
  renderAvatarPreview(avatarUrl, displayName);

  const avatarInput = document.getElementById('profile-avatar-input');
  document.getElementById('change-avatar-btn')?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please pick a valid image file.', 'error');
      return;
    }
    selectedAvatarFile = file;
    renderAvatarPreview(URL.createObjectURL(file), displayName);
  });

  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('profile-name').value.trim();
    const defaultStyle = document.getElementById('profile-default-style').value;
    const defaultWeather = document.getElementById('profile-default-weather').value;

    if (!name) {
      showToast('Display name cannot be empty.', 'error');
      return;
    }

    const btn = document.getElementById('profile-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      let nextImage = profile?.profileImage || user.photoURL || '';
      if (selectedAvatarFile) {
        const uploaded = await uploadImageAsset(currentUser.uid, 'profile', 'avatar', selectedAvatarFile);
        nextImage = uploaded.imageUrl;
      }

      await updateProfile(currentUser, { displayName: name });
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: name.slice(0, 80),
        profileImage: nextImage.slice(0, 300000),
        defaultStyle,
        defaultWeather,
        updatedAt: serverTimestamp(),
      });

      const updatedProfile = { ...profile, loginId, name, profileImage: nextImage, defaultStyle, defaultWeather };
      updateSidebarUser(currentUser, updatedProfile);
      document.getElementById('profile-summary-name').textContent = name;
      selectedAvatarFile = null;
      showToast('Profile settings saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update profile.', 'error');
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Profile';
    }
  });

  document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;

    if (newPass.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    const btn = document.getElementById('change-password-btn');
    btn.disabled = true;
    btn.textContent = 'Updating...';
    try {
      await updatePassword(currentUser, newPass);
      document.getElementById('change-password-form').reset();
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') {
        showToast('Please sign out and sign back in before changing your password.', 'error');
      } else {
        showToast(err.message || 'Could not update password.', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  });
});
