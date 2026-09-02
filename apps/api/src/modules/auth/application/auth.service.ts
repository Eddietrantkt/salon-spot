import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ProfessionalProfileStatus, ProfessionalVerificationStatus, UserStatus, type Prisma, type User } from '@prisma/client';
import type { AuthenticatedUser, AuthenticationResponse, RegistrationIntent } from '@salon-spot/contracts';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthConfigService } from './auth-config.service.js';
import { PasswordService } from './password.service.js';

interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
  onboardingIntent?: RegistrationIntent;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RefreshSession {
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthSessionResult {
  authentication: AuthenticationResponse;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

type SessionUser = Pick<User, 'id' | 'email' | 'displayName'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly accessTokens: AccessTokenService,
    private readonly config: AuthConfigService
  ) {}

  async register(input: RegisterInput, requestId?: string): Promise<AuthSessionResult> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('Email is already registered.');

    const passwordHash = await this.passwordService.hash(input.password);
    const result = await this.prisma.$transaction(async (tx) => {
      let user: User;
      try {
        user = await tx.user.create({ data: { email, displayName: input.displayName.trim(), passwordHash } });
      } catch (error) {
        if (this.isUniqueEmailViolation(error)) throw new ConflictException('Email is already registered.');
        throw error;
      }
      if (input.onboardingIntent === 'PROFESSIONAL') {
        await tx.professionalProfile.create({
          data: {
            userId: user.id,
            status: ProfessionalProfileStatus.PENDING,
            verificationStatus: ProfessionalVerificationStatus.DRAFT,
            specialties: []
          }
        });
        await this.writeAudit(tx, user.id, 'PROFESSIONAL_ONBOARDING_STARTED', requestId);
      } else if (input.onboardingIntent === 'OWNER') {
        await this.writeAudit(tx, user.id, 'OWNER_ONBOARDING_SELECTED', requestId);
      }
      const refresh = await this.createRefreshSession(tx, user.id);
      await this.writeAudit(tx, user.id, 'AUTH_REGISTERED', requestId);
      return { user, refresh };
    });

    return this.toAuthenticationResponse(result.user, result.refresh);
  }

  async login(input: LoginInput, requestId?: string): Promise<AuthSessionResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE || !(await this.passwordService.verify(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const refresh = await this.prisma.$transaction(async (tx) => {
      const session = await this.createRefreshSession(tx, user.id);
      await this.writeAudit(tx, user.id, 'AUTH_LOGGED_IN', requestId);
      return session;
    });

    return this.toAuthenticationResponse(user, refresh);
  }

  async refresh(refreshToken: string, requestId?: string): Promise<AuthSessionResult> {
    const refreshTokenHash = this.config.hashRefreshToken(refreshToken);
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { refreshTokenHash },
        include: { user: { select: { id: true, email: true, displayName: true, status: true } } }
      });
      if (!session) return null;

      const now = new Date();
      if (session.user.status !== UserStatus.ACTIVE) {
        await tx.authSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: now } });
        await this.writeAudit(tx, session.userId, 'AUTH_REFRESH_DENIED_SUSPENDED', requestId);
        return null;
      }
      if (session.revokedAt || session.expiresAt <= now) {
        if (session.revokedAt) {
          await this.revokeActiveFamilyForReuse(tx, session.userId, session.familyId, now, requestId);
        } else {
          await tx.authSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
          await this.writeAudit(tx, session.userId, 'AUTH_REFRESH_EXPIRED', requestId);
        }
        return null;
      }

      const claimed = await tx.authSession.updateMany({
        where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now }
      });
      if (claimed.count !== 1) {
        await this.revokeActiveFamilyForReuse(tx, session.userId, session.familyId, now, requestId);
        return null;
      }

      const nextSession = await this.createRefreshSession(tx, session.userId, session.familyId);
      await tx.authSession.update({ where: { id: session.id }, data: { replacedById: nextSession.id } });
      await this.writeAudit(tx, session.userId, 'AUTH_REFRESH_ROTATED', requestId);
      return { user: session.user, refresh: nextSession };
    });

    if (!result) throw new UnauthorizedException('Refresh token is invalid or expired.');
    return this.toAuthenticationResponse(result.user, result.refresh);
  }

  async logout(refreshToken: string, requestId?: string): Promise<void> {
    const refreshTokenHash = this.config.hashRefreshToken(refreshToken);
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({ where: { refreshTokenHash }, select: { id: true, userId: true, revokedAt: true } });
      if (!session || session.revokedAt) return;
      await tx.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await this.writeAudit(tx, session.userId, 'AUTH_LOGGED_OUT', requestId);
    });
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
    return user;
  }

  private async createRefreshSession(
    tx: Prisma.TransactionClient,
    userId: string,
    familyId?: string
  ): Promise<RefreshSession & { id: string }> {
    const sessionId = randomBytes(15).toString('base64url');
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    const session = await tx.authSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: this.config.hashRefreshToken(refreshToken),
        familyId: familyId ?? sessionId,
        expiresAt
      }
    });

    return { id: session.id, refreshToken, expiresAt };
  }

  private isUniqueEmailViolation(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
  }

  private async writeAudit(tx: Prisma.TransactionClient, actorUserId: string, action: string, requestId?: string): Promise<void> {
    await tx.auditEvent.create({
      data: {
        actorUserId,
        entityType: 'User',
        entityId: actorUserId,
        action,
        requestId
      }
    });
  }

  private async revokeActiveFamilyForReuse(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    familyId: string,
    now: Date,
    requestId?: string
  ): Promise<void> {
    await tx.authSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
    await this.writeAudit(tx, actorUserId, 'AUTH_REFRESH_REUSE_DETECTED', requestId);
  }

  private toAuthenticationResponse(user: SessionUser, refresh: RefreshSession): AuthSessionResult {
    const access = this.accessTokens.issue({ sub: user.id, email: user.email });
    return {
      authentication: {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString()
      },
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.expiresAt
    };
  }
}
