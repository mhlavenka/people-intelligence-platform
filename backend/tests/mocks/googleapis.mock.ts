/**
 * @googleapis/calendar + google-auth-library mock.
 * The individual method mocks are exported so tests can
 * assert / configure them. Reset between tests via `resetGoogleMocks()`.
 */

export const calendarMock = {
  events: {
    insert: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    list: jest.fn(),
    watch: jest.fn(),
  },
  channels: {
    stop: jest.fn(),
  },
  freebusy: {
    query: jest.fn(),
  },
  calendarList: {
    list: jest.fn().mockResolvedValue({ data: { items: [] } }),
  },
};

export function resetGoogleMocks(): void {
  Object.values(calendarMock.events).forEach((fn) => (fn as jest.Mock).mockReset());
  (calendarMock.channels.stop as jest.Mock).mockReset();
  (calendarMock.freebusy.query as jest.Mock).mockReset();
  (calendarMock.calendarList.list as jest.Mock).mockReset();

  calendarMock.events.insert.mockResolvedValue({
    data: { id: 'gcal-event-id', conferenceData: null },
  });
  calendarMock.events.delete.mockResolvedValue({ data: {} });
  calendarMock.events.patch.mockResolvedValue({ data: {} });
  calendarMock.events.list.mockResolvedValue({ data: { items: [] } });
  calendarMock.events.watch.mockResolvedValue({
    data: { resourceId: 'resource-xyz', expiration: String(Date.now() + 7 * 86400_000) },
  });
  calendarMock.channels.stop.mockResolvedValue({ data: {} });
  calendarMock.freebusy.query.mockResolvedValue({ data: { calendars: {} } });
  calendarMock.calendarList.list.mockResolvedValue({ data: { items: [] } });
}

// Mock for @googleapis/calendar
export const calendar = jest.fn(() => calendarMock);

// Mock for google-auth-library
export const OAuth2Client = jest.fn().mockImplementation(() => ({
  generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url'),
  getToken: jest.fn().mockResolvedValue({
    tokens: {
      access_token: 'fake-access',
      refresh_token: 'fake-refresh',
      expiry_date: Date.now() + 3600_000,
    },
  }),
  setCredentials: jest.fn(),
  refreshAccessToken: jest.fn().mockResolvedValue({
    credentials: {
      access_token: 'fake-new-access',
      expiry_date: Date.now() + 3600_000,
    },
  }),
}));
