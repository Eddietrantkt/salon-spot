import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetMediaCoverDto } from './set-media-cover.dto.js';

describe('SetMediaCoverDto', () => {
  it.each([{}, { mediaId: '' }])('rejects an absent or empty mediaId', async (body) => {
    await expect(validate(plainToInstance(SetMediaCoverDto, body))).resolves.not.toHaveLength(0);
  });

  it('accepts null to explicitly remove the cover', async () => {
    await expect(validate(plainToInstance(SetMediaCoverDto, { mediaId: null }))).resolves.toHaveLength(0);
  });
});
