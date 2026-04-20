import { ConnectivityService } from './connectivity.service';

describe('ConnectivityService', () => {
  let service: ConnectivityService;

  beforeEach(() => {
    service = new ConnectivityService();
  });

  it('should default to online', () => {
    expect(service.isOnline()).toBe(true);
  });

  it('should initialize with browser online status', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    await service.init();
    expect(service.isOnline()).toBe(true);
  });
});
