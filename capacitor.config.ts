import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aiclass.app",
  appName: "AI Class",
  webDir: "public",
  server: {
    // Points directly to the live Next.js production deployment
    url: "https://aiclass-six.vercel.app",
    cleartext: true,
    allowNavigation: [
      "aiclass-six.vercel.app",
      "*.vercel.app",
      "ai-class-d960b.firebaseapp.com",
      "*.firebaseapp.com",
      "*.googleapis.com",
      "accounts.google.com",
      "*.google.com",
    ],
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0A0A0B",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#7C3AED",
    },
  },
};

export default config;
