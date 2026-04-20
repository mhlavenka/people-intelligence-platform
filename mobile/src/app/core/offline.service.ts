import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ConnectivityService } from './connectivity.service';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

interface QueuedRequest {
  method: 'post' | 'put' | 'patch';
  path: string;
  body: unknown;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private connectivity = inject(ConnectivityService);
  private api = inject(ApiService);

  async cache(key: string, data: unknown): Promise<void> {
    await Preferences.set({
      key: `cache_${key}`,
      value: JSON.stringify({ data, cachedAt: Date.now() }),
    });
  }

  async getCached<T>(key: string, maxAgeMs?: number): Promise<T | null> {
    const result = await Preferences.get({ key: `cache_${key}` });
    if (!result.value) return null;

    const parsed = JSON.parse(result.value);
    if (maxAgeMs && Date.now() - parsed.cachedAt > maxAgeMs) return null;
    return parsed.data as T;
  }

  async queueRequest(method: 'post' | 'put' | 'patch', path: string, body: unknown): Promise<void> {
    const queue = await this.getQueue();
    queue.push({ method, path, body, timestamp: Date.now() });
    await Preferences.set({ key: 'offline_queue', value: JSON.stringify(queue) });
  }

  async syncQueue(): Promise<void> {
    if (!this.connectivity.isOnline()) return;

    const queue = await this.getQueue();
    if (!queue.length) return;

    const failed: QueuedRequest[] = [];
    for (const req of queue) {
      try {
        await firstValueFrom(this.api[req.method](req.path, req.body));
      } catch {
        failed.push(req);
      }
    }

    await Preferences.set({ key: 'offline_queue', value: JSON.stringify(failed) });
  }

  private async getQueue(): Promise<QueuedRequest[]> {
    const result = await Preferences.get({ key: 'offline_queue' });
    return result.value ? JSON.parse(result.value) : [];
  }
}
