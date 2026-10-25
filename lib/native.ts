export const NATIVE_APP_ID = "com.rappisportshub.app";
export const NATIVE_SCHEME = "com.rappisportshub.app";
export const NATIVE_AUTH_REDIRECT = `${NATIVE_SCHEME}://login-callback`;

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitor(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
  return bridge ?? null;
}

export function isNativeApp() {
  return Boolean(capacitor()?.isNativePlatform?.());
}

export function nativePlatform(): "ios" | "android" | null {
  const platform = capacitor()?.getPlatform?.();
  if (platform === "ios" || platform === "android") return platform;
  return null;
}

export function nativeAuthRedirect(next = "/account") {
  const dest = next.startsWith("/") ? next : "/account";
  return `${NATIVE_AUTH_REDIRECT}?next=${encodeURIComponent(dest)}`;
}

export async function shareContent(payload: { title: string; text?: string; url: string }) {
  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share");
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      await Share.share(payload);
      return true;
    } catch {
      /* fall through */
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share(payload);
    return true;
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(payload.url);
    return "copied";
  }
  return false;
}
