import { Body, Controller, Get, Headers, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, AuthenticationResponse } from '@salon-spot/contracts';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AuthService } from '../application/auth.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

interface RefreshCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  expires?: Date;
}

interface CookieResponse {
  cookie(name: string, value: string, options: RefreshCookieOptions): void;
  clearCookie(name: string, options: Pick<RefreshCookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'path'>): void;
}

const REFRESH_COOKIE = 'salon_spot_refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: CookieResponse, @RequestId() requestId?: string): Promise<AuthenticationResponse> {
    const session = await this.auth.register(body, requestId);
    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);
    return session.authentication;
  }

  @HttpCode(200)
  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: CookieResponse, @RequestId() requestId?: string): Promise<AuthenticationResponse> {
    const session = await this.auth.login(body, requestId);
    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);
    return session.authentication;
  }

  @HttpCode(200)
  @Post('refresh')
  async refresh(@Headers('cookie') cookie: string | undefined, @Res({ passthrough: true }) response: CookieResponse, @RequestId() requestId?: string): Promise<AuthenticationResponse> {
    const session = await this.auth.refresh(this.requireRefreshCookie(cookie), requestId);
    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);
    return session.authentication;
  }

  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  @Post('owner-onboarding')
  async enableOwner(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: CookieResponse, @RequestId() requestId?: string): Promise<AuthenticationResponse> {
    const session = await this.auth.enableOwner(user.id, requestId);
    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);
    return session.authentication;
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Headers('cookie') cookie: string | undefined, @Res({ passthrough: true }) response: CookieResponse, @RequestId() requestId?: string): Promise<void> {
    const refreshToken = this.readRefreshCookie(cookie);
    if (refreshToken) await this.auth.logout(refreshToken, requestId);
    response.clearCookie(REFRESH_COOKIE, this.cookieBaseOptions());
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.auth.getCurrentUser(user.id);
  }

  private setRefreshCookie(response: CookieResponse, refreshToken: string, expires: Date): void {
    response.cookie(REFRESH_COOKIE, refreshToken, { ...this.cookieBaseOptions(), expires });
  }

  private cookieBaseOptions(): Pick<RefreshCookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'path'> {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1/auth' };
  }

  private requireRefreshCookie(cookie: string | undefined): string {
    const refreshToken = this.readRefreshCookie(cookie);
    if (!refreshToken) throw new UnauthorizedException('Refresh session is missing.');
    return refreshToken;
  }

  private readRefreshCookie(cookie: string | undefined): string | undefined {
    if (!cookie) return undefined;
    return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`))?.slice(`${REFRESH_COOKIE}=`.length);
  }
}
