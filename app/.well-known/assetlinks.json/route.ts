import { env } from "cloudflare:workers";

const PACKAGE_ID = "app.stridefitness";
const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const configured = String(
    (env as unknown as Record<string, unknown>)
      .ANDROID_ASSETLINKS_SHA256_FINGERPRINTS ?? "",
  );
  const fingerprints = configured
    .split(",")
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint));

  const statements = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: PACKAGE_ID,
            sha256_cert_fingerprints: [...new Set(fingerprints)],
          },
        },
      ]
    : [];

  return Response.json(statements, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
