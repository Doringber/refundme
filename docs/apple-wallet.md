# Apple Wallet pass

A voucher can become a store card (`.pkpass`) with the store name, the balance you reported, the expiry, the barcode or code, and up to 10 branch locations. Wallet on a real iPhone may show that card on the Lock Screen when you are next to one of those branches. The app does not track location in the background. The ten coordinates are written into the pass at the moment you add it.

The button **הוספה ל-Apple Wallet** is hidden until signing is configured. `PASS_DEV_UNSIGNED=1` shows it and downloads `zikuy-pass.json` instead of a signed pass. Wallet will not install that file.

## What current iOS actually does

Checked against Apple's pass documentation and passkit-generator 3.7 (which tracks the iOS 26 / 27 pass schema).

- A pass can list at most **10** `locations`. Each one is a latitude, a longitude, and an optional `relevantText`. There is no radius field you can set to 300m. The old `maxDistance` key only shrinks Apple's radius; it cannot widen it.
- For a **store card**, Apple treats locations with a **small radius, on the order of 100 meters**. A pin on the shop door can surface the pass. A pin at the other end of a mall often will not. The exact radius is Apple's and has changed before.
- Store cards do **not** use `relevantDate`. That key is for boarding passes, tickets, and generic passes. iOS 18 replaced the single `relevantDate` with `relevantDates` (several time windows). iOS 26 renamed the moment field inside that list. Neither change adds time-based Lock Screen relevance to a store card, so this pass does not set them.
- iOS 26's new pass styles (poster event tickets, semantic boarding passes) are not store cards. `locations` is still the field Wallet reads for "show this near a place."
- The pass is a **suggestion**, not a notification. iOS can skip it. The person can turn off **Suggest on Lock Screen** for that pass (Wallet → the pass → the ··· menu → Details). Location Services, and Precise Location for Wallet, have to be on. Low Power Mode and Focus can suppress suggestions. The Simulator never shows a pass on the Lock Screen; test on a phone.
- The ten locations are a snapshot. A pass created near Tel Aviv will not grow Haifa branches by itself. Updating them is the web-service step below.

`relevantText` on this pass is `יש לך זיכוי של 280₪ ב-FOX`. Apple's design note asks for a short reason ("Store nearby") and discourages instructions. The sentence above is the product copy; the Lock Screen may truncate it.

## 1. Apple Developer account

1. Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) with the Apple ID that should own the passes. The fee is billed by Apple (99 USD per year as of 2026; confirm it on that page).
2. Wait until the account shows as active. Certificates below are refused before that.
3. You do not need a paid App Store app. A Pass Type ID is enough for a web-generated pass.

## 2. Pass Type ID

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources).
2. **Identifiers** → **+** → **Pass Type IDs**.
3. Description: `RefundMe credit`. Identifier: `pass.com.refundme.credit` (reverse-DNS, must start with `pass.`).
4. Register it. This string is `PASS_TYPE_IDENTIFIER`. It is baked into every pass and must match the certificate.

## 3. Certificates

Apple's current click-path is under the account site and moves occasionally. The files you need at the end are the same.

### Pass Type ID certificate

1. **Certificates** → **+** → **Pass Type ID Certificate**.
2. Choose the Pass Type ID from step 2.
3. On your Mac, Keychain Access → Certificate Assistant → **Request a Certificate From a Certificate Authority**. Save the `.certSigningRequest`. Upload it.
4. Download the issued `.cer`.
5. Double-click it so it lands in Keychain, then export the certificate **and** its private key as a `.p12`. Remember the password.
6. Turn that `.p12` into the two PEMs Netlify will store:

```bash
openssl pkcs12 -in refundme-pass.p12 -clcerts -nokeys -out pass-cert.pem
openssl pkcs12 -in refundme-pass.p12 -nocerts -out pass-key.pem
```

`pass-cert.pem` is `PASS_CERT_PEM`. `pass-key.pem` is `PASS_KEY_PEM`. If you set a password on the key, that password is `PASS_KEY_PASSPHRASE`.

### WWDR

1. Download the **Worldwide Developer Relations - G4** certificate from [Apple PKI](https://www.apple.com/certificateauthority/).
2. Convert it if the download is DER:

```bash
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

`wwdr.pem` is `WWDR_CERT_PEM`.

### Team ID

**Membership details** in the developer account. Ten letters and digits. That is `APPLE_TEAM_ID`.

## 4. Netlify

Site → **Environment variables**. Add these for production (and for a preview if you want the button there). Paste each PEM as one line with `\n` between lines, or as a multiline value. The server accepts both.

| Name | Value |
| --- | --- |
| `PASS_TYPE_IDENTIFIER` | `pass.com.refundme.credit` |
| `APPLE_TEAM_ID` | the ten-character Team ID |
| `PASS_CERT_PEM` | contents of `pass-cert.pem` |
| `PASS_KEY_PEM` | contents of `pass-key.pem` |
| `PASS_KEY_PASSPHRASE` | the key password, or leave empty |
| `WWDR_CERT_PEM` | contents of `wwdr.pem` |

Do **not** set `PASS_DEV_UNSIGNED` on Netlify. Redeploy after saving. The next request reads the variables; they are not baked in at build time.

Until all five PEM-backed values are present, `GET /api/wallet/apple` returns `{ "mode": "hidden" }` and the voucher screen draws no button.

## 5. Try it

1. Sign in (demo mode will not mint a signed pass, because the credit has to come from your account).
2. Open a credit that still has a balance. Receipts have no button.
3. Tap **הוספה ל-Apple Wallet**. The phone asks for location once, then downloads `zikuy.pkpass`. Wallet should offer Add.
4. On a real iPhone, walk to within about 100m of one saved branch with Precise Location on, and with Suggest on Lock Screen on for that pass. The card may appear. It may not. That is the platform, not a failed download.
5. Local draft, without any certificate:

```bash
PASS_DEV_UNSIGNED=1 npm run dev
```

The button appears with the note that the file is unsigned. The download is `zikuy-pass.json`. Use it to inspect `storeCard`, `barcodes`, and `locations`.

## Next step: updates

Not built. A pass cannot change its balance or its ten locations after it is installed unless you add Apple's [PassKit web service](https://developer.apple.com/documentation/walletpasses/adding_a_web_service_to_update_passes) and send an empty APNs push to the device token Wallet registered.

When you do it, gate it with something like `WALLET_UPDATES=1` and only then set `webServiceURL` plus a long `authenticationToken`. Wallet will call, on your origin:

- `POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}`
- `GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince=`
- `GET /v1/passes/{passTypeIdentifier}/{serialNumber}` (the fresh `.pkpass`)
- `DELETE` the registration
- `POST /v1/log`

`serialNumber` is the voucher id. The push goes to the APNs device token from the registration, using the same Pass Type ID certificate, with an empty JSON body. Skip `webServiceURL` until those routes answer; a dead URL makes Wallet fail the add.

[passkit-webservice-toolkit](https://github.com/alexandercerutti/passkit-webservice-toolkit) and [hapns](https://github.com/alexandercerutti/hapns) are the libraries that match the signer already in this repo (`passkit-generator`).
