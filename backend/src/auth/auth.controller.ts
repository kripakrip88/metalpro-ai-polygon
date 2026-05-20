import { Controller, Post, Get, Body, Req, HttpCode, HttpStatus } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { email: string; password: string }, @Req() req: any) {
    const meta = {
      ip: req.ip ?? req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    };
    return this.authService.login(body.email, body.password, meta);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: { refreshToken: string }) {
    return this.authService.logout(body.refreshToken);
  }

  @Get("me")
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.getMe(user.sub);
  }
}
