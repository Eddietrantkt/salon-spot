import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FixedSlotsDateQueryDto, ManageFixedSlotsDto } from './open-fixed-slots.dto.js';

describe('Availability DTOs', () => {
  it('accepts an exact local date and unique fixed periods', async () => {
    const input = plainToInstance(ManageFixedSlotsDto, {
      localDate: '2099-12-11',
      periods: ['09:00-11:00', '13:00-15:00']
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it.each([
    [{ localDate: '2099-12-11T00:00:00Z', periods: ['09:00-11:00'] }, 'localDate'],
    [{ localDate: '2099-12-11', periods: ['10:00-12:00'] }, 'periods'],
    [{ localDate: '2099-12-11', periods: ['09:00-11:00', '09:00-11:00'] }, 'periods']
  ])('rejects malformed schedule input %#', async (value, property) => {
    const errors = await validate(plainToInstance(ManageFixedSlotsDto, value));
    expect(errors.some((error) => error.property === property)).toBe(true);
  });

  it('validates the schedule read query independently from mutation periods', async () => {
    const query = plainToInstance(FixedSlotsDateQueryDto, { localDate: '2099-12-11' });
    await expect(validate(query)).resolves.toHaveLength(0);
  });
});
