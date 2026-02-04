export const ASN_PROVIDERS: Record<number, string> = {
  24940: "Hetzner",
  16276: "OVH",
  14061: "DigitalOcean",
  20473: "Vultr",
  396356: "Latitude.sh",
  13335: "Cloudflare",
  15169: "Google",
  16509: "Amazon",
  8075: "Microsoft",
  36352: "ColoCrossing",
  55720: "Gigabit Hosting",
};

export function getAsnDisplay(asn: number | null): string {
  if (asn === null) return "Unknown";
  const provider = ASN_PROVIDERS[asn];
  return provider ? `${provider} (${asn})` : asn.toString();
}
