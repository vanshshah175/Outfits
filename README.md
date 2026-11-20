# OUTFIT AI — Smart Outfit Recommendation Website (College Project Documentation)

## 1. Abstract & Problem Statement
Students and young professionals often spend unnecessary time each morning deciding what to wear for classes, lab practicals, presentations, college fests, or interviews—frequently feeling like they have "nothing to wear" despite owning plenty of clothes. **OUTFIT AI** solves this by digitizing a user's existing wardrobe into Cloud Firestore and applying a deterministic, rule-based recommendation engine to assemble occasion- and weather-appropriate outfits strictly from items the user already owns.

## 2. Technology Stack
- **Frontend**: HTML5, CSS3 (modular responsive stylesheets with Light/Dark theme tokens), Vanilla JavaScript (ES Modules), Lucide Icons
- **Backend & Database**: Firebase Authentication (User ID + Password mapped to `@users.outfitai.app`), Cloud Firestore (`users`, `wardrobe`, `outfits`), Firebase Storage (garment image uploads with client-side Canvas optimization), and Zero-Trust Security Rules (`firestore.rules`, `storage.rules`)
- **Build & Dev Tooling**: Vite multi-page bundler (`vite.config.ts`)

## 3. Project Folder Structure
```text
outfit-ai/
├── index.html              # Editorial landing page & sample lookbook
├── login.html              # User ID & Password sign-in
├── signup.html             # Account registration with User ID & Password
├── dashboard.html          # KPIs, Campus Quick Presets, inventory breakdown
├── wardrobe.html           # Digital closet CRUD, upload dropzone, filters & demo starter loader
├── generate-outfit.html    # 12-occasion recommendation engine & detail modal
├── saved-outfits.html      # Saved & favorite outfits archive
├── profile.html            # User profile, avatar upload, inline password change, preferences
├── css/
│   ├── style.css           # Design tokens, typography, landing & auth layout
│   ├── dashboard.css       # App shell sidebar, topbar, KPIs
│   ├── wardrobe.css        # Garment cards, generator layout, detail modal
│   └── responsive.css      # Tablet & mobile drawer breakpoints
├── js/
│   ├── firebase-config.js  # Firebase init, error handler, theme, image compression, auth guard
│   ├── auth.js             # User ID + Password Login & Signup
│   ├── dashboard.js        # Analytics, Campus Quick Presets, recent outfits
│   ├── wardrobe.js         # Wardrobe CRUD + Starter Campus Wardrobe loader
│   ├── outfit-generator.js # Rule-based scoring & color harmony engine
│   ├── saved-outfits.js    # Favorites toggle, filtering, delete
│   └── profile.js          # Profile, preferences & inline password update
├── firebase-blueprint.json # Firestore entity schema IR
├── firestore.rules         # Owner-isolated security rules
├── storage.rules           # Owner-isolated image storage rules
└── README.md               # Project & Viva documentation
```

## 4. Firestore Database Schema
1. **`users/{userId}`**: `userId`, `name`, `loginId`, `email` (optional), `profileImage`, `defaultStyle`, `defaultWeather`, `createdAt`, `updatedAt` (strictly private to owner; `allow list: if false`).
2. **`wardrobe/{itemId}`**: `itemId`, `userId`, `itemName`, `category`, `color`, `style`, `season`, `description`, `imageUrl`, `storagePath`, `createdAt`, `updatedAt`.
3. **`outfits/{outfitId}`**: `outfitId`, `userId`, `title`, `occasion`, `weather`, `style`, `clothingItemIds`, `description`, `colorHarmony`, `whyItWorks`, `isFavorite`, `createdAt`, `updatedAt`.

## 5. Rule-Based Recommendation Algorithm (`js/outfit-generator.js`)
1. **Slot Partitioning**: Groups the user's Firestore wardrobe items into `Topwear` (`Shirts`, `T-Shirts`, `Hoodies`), `Bottomwear` (`Jeans`, `Trousers`, `Shorts`), `Footwear` (`Shoes`), `Outerwear` (`Jackets`, `Hoodies`), and `Accessories` (`Watches`, `Accessories`).
2. **Item Scoring (`scoreItem`)**: Evaluates each garment using:
   - **Style Fit** (+28 direct match / +24 occasion-rule match)
   - **Category Occasion Fit** (+18 if category suits the selected occasion)
   - **Weather & Season Fit** (+18 for matching season, +22 outerwear boost in Cold, -24/-30 penalty for heavy layers in Hot or shorts in Cold)
   - **Color Preference** (+24 if user entered an optional color preference)
3. **Color Harmony (`colorPairScore`)**: Rewards neutral-anchored pairings (`Black`, `White`, `Ivory`, `Beige`, `Grey`, `Navy`, `Charcoal`, `Brown`) and curated complementary pairs (e.g., `Light Blue + Charcoal`, `Olive + Cream`, `Burgundy + Black`).
4. **Deduplication & Variety**: Computes a sorted item-ID signature per combination so duplicate outfits are never generated, returning 3–5 unique outfits and displaying the computed rule score breakdown inside the Outfit Details modal.

## 6. Quick Demo / Viva Guide
- **User ID & Password Login**: On `signup.html` or `login.html`, users authenticate with a plain User ID (3–40 chars: letters, numbers, `.`, `_`, `-`) and Password—no email required. Internally, IDs map to `<userId>@users.outfitai.app` for Firebase Auth.
- **Firebase Console Requirement**: Ensure **Email/Password** is enabled under **Firebase Console → Authentication → Sign-in method** so User ID + Password accounts can register and log in.
- **1-Click Starter Wardrobe**: On `wardrobe.html`, click **Load 5 Starter Campus Items** (when empty) to populate 5 real editable garments in Firestore, or upload your own photos via the **Upload Garment** button.
- **Inline Password Update**: Signed-in users can update their password directly from `profile.html`.
