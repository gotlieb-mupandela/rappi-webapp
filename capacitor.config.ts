import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rappisportshub.app",
  appName: "RAPPI SPORTS HUB",
  webDir: "mobile/www",
  server: {
    url: "https://www.rappisportshub.com",
    allowNavigation: [
      "rappisportshub.com",
      "*.rappisportshub.com",
      "*.supabase.co",
      "*.3gdirectpay.com",
    ],
  },
  android: {
    backgroundColor: "#ffffff",
  },
  plugins: {
    SystemBars: {
      // Set before first paint so the header does not jump when insets arrive.
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "LIGHT",
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#000000",
      showSpinner: false,
    },
  },
};

export default config;
