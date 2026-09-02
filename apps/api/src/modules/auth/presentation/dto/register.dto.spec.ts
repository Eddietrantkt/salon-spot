import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

describe('RegisterDto', () => {
  it('accepts an eight-character password', async () => {
    const input = Object.assign(new RegisterDto(), {
      email: 'owner@example.com',
      displayName: 'Owner',
      password: 'Mvp#2026'
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('accepts a known onboarding intent and rejects an unknown one', async () => {
    const accepted = Object.assign(new RegisterDto(), {
      email: 'professional@example.com', displayName: 'Professional', password: 'Mvp#2026', onboardingIntent: 'PROFESSIONAL'
    });
    const rejected = Object.assign(new RegisterDto(), {
      email: 'unknown@example.com', displayName: 'Unknown', password: 'Mvp#2026', onboardingIntent: 'ADMIN'
    });

    await expect(validate(accepted)).resolves.toHaveLength(0);
    expect((await validate(rejected)).some((error) => error.property === 'onboardingIntent')).toBe(true);
  });

  it('rejects a password shorter than eight characters', async () => {
    const input = Object.assign(new RegisterDto(), {
      email: 'owner@example.com',
      displayName: 'Owner',
      password: 'Mvp#26'
    });

    const errors = await validate(input);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
