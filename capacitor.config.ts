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
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com",
      "ai-class-d960b.firebaseapp.com",
      "*.firebaseapp.com",
      "*.googleapis.com",
    ],
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    // Eliminates Google's 'disallowed_useragent' restriction in WebViews
    overrideUserAgent:
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
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
