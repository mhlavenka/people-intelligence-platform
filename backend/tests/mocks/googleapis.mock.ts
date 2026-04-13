/**
 * googleapis mock. The individual method mocks are exported so tests can
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
};

export function resetGoogleMocks(): void {
  Object.values(calendarMock.events).forEach((fn) => (fn as jest.Mock).mockReset());
  (calendarMock.channels.stop as jest.Mock).mockReset();
  (calendarMock.freebusy.query as jest.Mock).mockReset();

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
}

export const google = {
  auth: {
    OAuth2: jest.fn().mockImplementation(() => ({
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn().mockResolvedValue({
        credentials: {
          access_token: 'fake-new-access',
          expiry_date: Date.now() + 3600_000,
        },
      }),
    })),
  },
  calendar: jest.fn(() => calendarMock),
};
