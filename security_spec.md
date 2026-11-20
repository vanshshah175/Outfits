# OUTFIT AI — Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `users`, `wardrobe`, and `outfits` belongs strictly to a single authenticated and email-verified user (`request.auth.uid`). No cross-user read, list, create, update, or delete is permitted.
2. **PII Protection**: `users/{userId}` holds `email` and profile attributes. `allow list` is permanently disabled (`false`) and `allow get` requires `userId == request.auth.uid`.
3. **Document ID Integrity**: Path IDs (`{userId}`, `{itemId}`, `{outfitId}`) must match `^[a-zA-Z0-9_\-]+$` with max length 128 and match the internal ID field (`userId`, `itemId`, `outfitId`) inside the document.
4. **Immutable Ownership & Creation Timestamps**: `userId`, `itemId`/`outfitId`, and `createdAt` cannot be modified after creation.
5. **Server Timestamp Enforcement**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
6. **Strict Schema Allowlisting & Type/Size Bounds**: Every write validates exact keys via `hasAll`/`hasOnly` on create and `affectedKeys().hasOnly(...)` on update, plus string length and enum bounds.
7. **Secure List Queries**: `allow list` on `wardrobe` and `outfits` strictly enforces `resource.data.userId == request.auth.uid`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /wardrobe/item-1` with `auth = null`.
2. **Cross-User Profile Read (PII Leak)**: `GET /users/victim-uid` signed in as `attacker-uid`.
3. **Users Collection Scrape**: `LIST /users` signed in as `attacker-uid`.
4. **Unverified Email Write**: `CREATE /wardrobe/item-1` with `email_verified = false`.
5. **Identity Spoofing on Create**: `CREATE /wardrobe/item-1` where `data.userId = "victim-uid"` while `auth.uid = "attacker-uid"`.
6. **Ghost Field Shadow Write**: `CREATE /wardrobe/item-1` including `"isAdmin": true` or `"role": "superadmin"`.
7. **ID Poisoning**: `CREATE /wardrobe/../../etc/passwd` or >128 char document ID.
8. **Oversized String Exhaustion**: `CREATE /wardrobe/item-1` with 2000-char `itemName`.
9. **Client Timestamp Forgery**: `CREATE /wardrobe/item-1` with backdated `createdAt` != `request.time`.
10. **Immutable Field Mutation**: `UPDATE /wardrobe/item-1` attempting to reassign `userId` or `createdAt`.
11. **Invalid Category / Value Poisoning**: `UPDATE /wardrobe/item-1` setting `category` to `"InvalidCat"` or `clothingItemIds` to an empty array `[]` on `outfits`.
12. **Unscoped List Query**: `LIST /wardrobe` without filtering `where('userId', '==', auth.uid)`.
