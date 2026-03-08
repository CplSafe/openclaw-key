/**
 * Lookup geolocation data for an IP address using the free ip-api.com service.
 * Rate limit: 45 requests per minute (sufficient for license activations).
 */
export type GeoResult = {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function lookupIpGeo(ip: string): Promise<GeoResult> {
  const empty: GeoResult = {
    city: null,
    country: null,
    latitude: null,
    longitude: null,
  };

  // Skip private/local IPs
  if (
    ip === "unknown" ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return empty;
  }

  // Strip IPv6 prefix if present
  const cleanIp = ip.replace(/^::ffff:/, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `http://ip-api.com/json/${cleanIp}?fields=status,city,country,lat,lon`,
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      return empty;
    }

    const data = await response.json();

    if (data.status !== "success") {
      return empty;
    }

    return {
      city: data.city || null,
      country: data.country || null,
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
    };
  } catch {
    // Don't let geo lookup failure block the install
    console.warn(`GeoIP lookup failed for ${cleanIp}`);
    return empty;
  }
}
