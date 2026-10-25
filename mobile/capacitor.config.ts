import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rappisportshub.app",
  appName: "RAPPI",
  webDir: "www",
  server: {
    url: "https://www.rappisportshub.com",
    androidScheme: "https",
    allowNavigation: [
      "www.rappisportshub.com",
      "rappisportshub.com",
      "*.supabase.co",
      "accounts.google.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    scheme: "RAPPI",
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
