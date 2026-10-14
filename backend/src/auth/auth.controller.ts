import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { Request, response, Response } from 'express';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('signup')
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
async login(
  @Body() loginDto: LoginDto,
  @Res({ passthrough: true }) response: Response,
) {
  const result = await this.authService.login(loginDto);

  response.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const { refreshToken, ...safeResult } = result;
  return safeResult;
}

@Post('refresh')
async refresh(
  @Req() request:Request,
    @Res({ passthrough: true }) response: Response,

){
  const refreshToken=request.cookies?.refresh_token;
  if (typeof refreshToken!=='string') {
    throw new UnauthorizedException('Refresh token missing');
  }
  const result=await this.authService.refresh(refreshToken);
    response.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    message: result.message,
    accessToken: result.accessToken,
  };
}
}
