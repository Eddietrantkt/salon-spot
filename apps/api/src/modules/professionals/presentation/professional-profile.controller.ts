import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, ProfessionalProfile } from '@salon-spot/contracts';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { ProfessionalProfileService } from '../application/professional-profile.service.js';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto.js';

@Controller('professionals/me')
@UseGuards(AccessTokenGuard)
export class ProfessionalProfileController {
  constructor(private readonly profiles: ProfessionalProfileService) {}

  @Get()
  getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<ProfessionalProfile> {
    return this.profiles.getCurrent(user.id);
  }

  @Patch()
  updateCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfessionalProfileDto,
    @RequestId() requestId?: string
  ): Promise<ProfessionalProfile> {
    return this.profiles.updateCurrent(user.id, body, requestId);
  }
}
