/**
 * AWS SES mock. `sesSendMock` captures every command sent; assert on
 * `sesSendMock.mock.calls` to verify email was triggered.
 */

export const sesSendMock = jest.fn();

export const SESClient = jest.fn().mockImplementation(() => ({
  send: (cmd: unknown) => sesSendMock(cmd),
}));

export const SendEmailCommand = jest
  .fn()
  .mockImplementation((input: unknown) => ({ type: 'SendEmail', input }));

export const SendRawEmailCommand = jest
  .fn()
  .mockImplementation((input: unknown) => ({ type: 'SendRawEmail', input }));
