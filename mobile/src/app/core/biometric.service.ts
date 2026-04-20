import { Injectable } from '@angular/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class BiometricService {
  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  async verify(): Promise<boolean> {
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Sign in to ARTES',
        title: 'Biometric Login',
      });
      return true;
    } catch {
      return false;
    }
  }

  async getBiometryType(): Promise<BiometryType> {
    const result = await NativeBiometric.isAvailable();
    return result.biometryType;
  }
}
