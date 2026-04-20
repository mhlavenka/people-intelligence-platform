import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should make GET requests with base URL', () => {
    service.get<{ ok: boolean }>('/test').subscribe((res) => {
      expect(res.ok).toBe(true);
    });

    const req = httpMock.expectOne('http://localhost:3030/api/test');
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
  });

  it('should include query params', () => {
    service.get('/test', { page: 1, status: 'active' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:3030/api/test' && r.params.get('page') === '1'
    );
    expect(req.request.params.get('status')).toBe('active');
    req.flush({});
  });

  it('should make POST requests with body', () => {
    const body = { email: 'test@example.com' };
    service.post('/auth/login', body).subscribe();

    const req = httpMock.expectOne('http://localhost:3030/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('should make DELETE requests', () => {
    service.delete('/booking/bookings/123').subscribe();

    const req = httpMock.expectOne('http://localhost:3030/api/booking/bookings/123');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
