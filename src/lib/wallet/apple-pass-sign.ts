import "server-only";

import { PKPass } from "passkit-generator";
import { passImageBuffers } from "@/lib/wallet/apple-pass-icon";
import { normalizePem, type StorePassDefinition } from "@/lib/wallet/apple-pass";

export type PassCertificates = {
  wwdr: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
};

export function readPassCertificates(
  env: Record<string, string | undefined> = process.env,
): PassCertificates {
  const passphrase = (env.PASS_KEY_PASSPHRASE ?? "").trim();
  return {
    wwdr: normalizePem(env.WWDR_CERT_PEM ?? ""),
    signerCert: normalizePem(env.PASS_CERT_PEM ?? ""),
    signerKey: normalizePem(env.PASS_KEY_PEM ?? ""),
    ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
  };
}

/** Sign a store card. Caller has already checked that the PEMs are present. */
export function signStorePass(
  definition: StorePassDefinition,
  certificates: PassCertificates,
): Buffer {
  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(definition)),
      ...passImageBuffers(),
    },
    certificates,
  );
  if (definition.locations?.length) pass.setLocations(...definition.locations);
  else pass.setLocations(null);
  if (definition.barcodes?.length) pass.setBarcodes(...definition.barcodes);
  else pass.setBarcodes(null);
  pass.setExpirationDate(
    definition.expirationDate ? new Date(definition.expirationDate) : null,
  );
  return pass.getAsBuffer();
}
