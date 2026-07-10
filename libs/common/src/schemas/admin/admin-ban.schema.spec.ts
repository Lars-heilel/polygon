import { adminBanRequestSchema } from './admin-ban.schema';

describe('adminBanRequestSchema', () => {
  it.each(['ONE_HOUR', 'ONE_DAY', 'SEVEN_DAYS', 'THIRTY_DAYS', 'PERMANENT'])(
    'accepts %s',
    (duration) => {
      expect(adminBanRequestSchema.safeParse({ duration, reason: 'SPAM' }).success).toBe(true);
    },
  );

  it('requires a trimmed custom reason of at least 5 characters', () => {
    expect(
      adminBanRequestSchema.safeParse({
        duration: 'ONE_DAY',
        reason: 'CUSTOM',
        customReason: ' no ',
      }).success,
    ).toBe(false);

    expect(
      adminBanRequestSchema.parse({
        duration: 'ONE_DAY',
        reason: 'CUSTOM',
        customReason: '  repeated abuse  ',
      }).customReason,
    ).toBe('repeated abuse');
  });

  it('rejects a custom reason longer than 500 trimmed characters', () => {
    expect(
      adminBanRequestSchema.safeParse({
        duration: 'ONE_DAY',
        reason: 'CUSTOM',
        customReason: `  ${'a'.repeat(501)}  `,
      }).success,
    ).toBe(false);
  });

  it('rejects custom text for a preset reason', () => {
    expect(
      adminBanRequestSchema.safeParse({
        duration: 'ONE_DAY',
        reason: 'SPAM',
        customReason: 'ignored text',
      }).success,
    ).toBe(false);
  });
});
