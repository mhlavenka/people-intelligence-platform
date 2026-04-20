import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.headsoft.artes',
  appName: 'ARTES',
  webDir: 'www/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP'
    }
  }
};

export default config;
