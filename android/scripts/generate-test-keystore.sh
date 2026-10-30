#!/usr/bin/env bash
# Creates a throwaway test keystore under android/.signing/ (gitignored).
# Prints the SHA-256 fingerprint to put in public/.well-known/assetlinks.json.
# Never prints the password. Never writes the keystore into git.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
sign_dir="${root}/.signing"
keystore="${sign_dir}/test.keystore"
props="${sign_dir}/signing.properties"

mkdir -p "${sign_dir}"

if [[ ! -f "${keystore}" || ! -f "${props}" ]]; then
  pass="$(openssl rand -hex 24)"
  keytool -genkeypair \
    -keystore "${keystore}" \
    -alias test \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${pass}" \
    -keypass "${pass}" \
    -dname "CN=Refunds Bag Test, OU=Test, O=Refunds Bag, C=US" >/dev/null
  umask 077
  cat > "${props}" <<EOF
storeFile=.signing/test.keystore
storePassword=${pass}
keyPassword=${pass}
keyAlias=test
EOF
  chmod 600 "${props}" "${keystore}"
  echo "Created ${keystore}"
else
  echo "Using existing ${keystore}"
fi

store_pass="$(awk -F= '/^storePassword=/{print substr($0, index($0, "=") + 1)}' "${props}")"
alias_name="$(awk -F= '/^keyAlias=/{print substr($0, index($0, "=") + 1)}' "${props}")"
fingerprint="$(
  keytool -list -v -keystore "${keystore}" -alias "${alias_name}" -storepass "${store_pass}" \
    | awk -F': ' '/SHA256:/{print $2; exit}'
)"
echo "SHA-256: ${fingerprint}"
echo "Add that value to sha256_cert_fingerprints in public/.well-known/assetlinks.json"
echo "The password stays in ${props} and must not be committed."
