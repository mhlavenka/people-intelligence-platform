import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { BiometricService } from './biometric.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: BiometricService, useValue: { isAvailable: () => Promise.resolve(false) } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should start unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.getToken()).toBeNull();
  });

  it('should set user and token on successful login', () => {
    const mockResponse = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      user: {
        id: '1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'coachee',
        organizationId: 'org1',
      },
    };

    service.login('test@test.com', 'password').subscribe();

    const req = httpMock.expectOne('http://localhost:3030/api/auth/login');
    req.flush(mockResponse);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getToken()).toBe('test-token');
    expect(service.currentUser()?.email).toBe('test@test.com');
  });

  it('should handle 2FA flow', () => {
    const mockResponse = {
      requiresTwoFactor: true,
      tempToken: 'temp-123',
    };

    service.login('test@test.com', 'password').subscribe((res) => {
      expect(res.requiresTwoFactor).toBe(true);
      expect(res.tempToken).toBe('temp-123');
    });

    const req = httpMock.expectOne('http://localhost:3030/api/auth/login');
    req.flush(mockResponse);

    expect(service.isAuthenticated()).toBe(false);
  });

  it('should clear session on logout', () => {
    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });
});
