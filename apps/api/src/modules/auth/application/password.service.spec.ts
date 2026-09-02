import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('verifies the original password only', async () => {
    const hash = await passwords.hash('correct-horse-battery-staple');

    await expect(passwords.verify('correct-horse-battery-staple', hash)).resolves.toBe(true);
    await expect(passwords.verify('incorrect-password', hash)).resolves.toBe(false);
  });
});
