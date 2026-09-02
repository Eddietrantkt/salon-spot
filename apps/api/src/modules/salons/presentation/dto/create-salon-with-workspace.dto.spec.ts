import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSalonWithWorkspaceDto } from './create-salon-with-workspace.dto.js';

describe('CreateSalonWithWorkspaceDto', () => {
  it('rejects whitespace-only fields after normalization', async () => {
    const input = plainToInstance(CreateSalonWithWorkspaceDto, {
      name: '   ', area: '   ', timezone: ' Asia/Ho_Chi_Minh ',
      workspace: { name: '   ', rentalLabel: '   ', priceCents: 250000 }
    });

    const errors = await validate(input);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
    expect(errors.some((error) => error.property === 'area')).toBe(true);
    expect(input.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(input.workspace.name).toBe('');
    expect(input.workspace.rentalLabel).toBe('');
  });
});
