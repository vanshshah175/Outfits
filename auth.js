import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  auth,
  initTheme,
  initIcons,
  showToast,
  ensureUserProfile,
  normalizeLoginId,
  toInternalAuthEmail,
} from './firebase-config.js';

initTheme();
initIcons();

function showAuthFeedback(message, type = 'error') {
  const box = document.getElementById('auth-feedback');
  if (!box) return;
  box.className = `alert-box ${type === 'success' ? 'alert-success' : 'alert-error'}`;
  box.textContent = message;
  box.classList.remove('hidden');
}

function clearAuthFeedback() {
  const box = document.getElementById('auth-feedback');
  if (box) box.classList.add('hidden');
}

function validateLoginId(rawId) {
  const trimmed = String(rawId || '').trim();
  const normalized = normalizeLoginId(trimmed);
  if (!trimmed || normalized !== trimmed.toLowerCase()) {
    return { valid: false, error: 'User ID can only contain letters, numbers, dots (.), underscores (_), or hyphens (-).' };
  }
  if (normalized.length < 3 || normalized.length > 40) {
    return { valid: false, error: 'User ID must be between 3 and 40 characters.' };
  }
  return { valid: true, normalized };
}

function formatAuthError(error) {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect User ID or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'That User ID is already registered. Please choose another User ID or sign in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'User ID format is invalid. Use only letters, numbers, dots, underscores, or hyphens.';
    case 'auth/operation-not-allowed':
      return 'ID & Password login requires enabling the Email/Password provider in Firebase Console (Authentication → Sign-in method → Email/Password).';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user && (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('signup.html'))) {
    await ensureUserProfile(user);
    window.location.href = '/dashboard.html';
  }
});

// User ID + Password Login handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthFeedback();
    const rawUserId = document.getElementById('login-userid').value;
    const password = document.getElementById('login-password').value;

    const idCheck = validateLoginId(rawUserId);
    if (!idCheck.valid) {
      showAuthFeedback(idCheck.error);
      return;
    }
    if (!password) {
      showAuthFeedback('Please enter your password.');
      return;
    }

    const submitBtn = document.getElementById('login-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const internalEmail = toInternalAuthEmail(idCheck.normalized);
      const cred = await signInWithEmailAndPassword(auth, internalEmail, password);
      await ensureUserProfile(cred.user, idCheck.normalized);
      window.location.href = '/dashboard.html';
    } catch (err) {
      showAuthFeedback(formatAuthError(err), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// User ID + Password Sign-Up handler
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthFeedback();
    const name = document.getElementById('signup-name').value.trim();
    const rawUserId = document.getElementById('signup-userid').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!name) {
      showAuthFeedback('Please enter your full name.');
      return;
    }

    const idCheck = validateLoginId(rawUserId);
    if (!idCheck.valid) {
      showAuthFeedback(idCheck.error);
      return;
    }

    if (password.length < 6) {
      showAuthFeedback('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showAuthFeedback('Passwords do not match.');
      return;
    }

    const submitBtn = document.getElementById('signup-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const internalEmail = toInternalAuthEmail(idCheck.normalized);
      const cred = await createUserWithEmailAndPassword(auth, internalEmail, password);
      await updateProfile(cred.user, { displayName: name });
      await ensureUserProfile(cred.user, idCheck.normalized);
      showToast(`Account @${idCheck.normalized} created!`, 'success');
      window.location.href = '/dashboard.html';
    } catch (err) {
      showAuthFeedback(formatAuthError(err), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}
