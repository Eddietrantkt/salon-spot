import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const derivedKey = await this.derive(password, salt);
    return `scrypt$${salt}$${derivedKey.toString('base64url')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, salt, expectedEncoded, ...extra] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !expectedEncoded || extra.length > 0) return false;

    const expected = Buffer.from(expectedEncoded, 'base64url');
    const actual = await this.derive(password, salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private async derive(password: string, salt: string): Promise<Buffer> {
    return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  }
}
