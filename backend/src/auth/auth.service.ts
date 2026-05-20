import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const ACCESS_TOKEN_TTL  = "15m";
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string } = {}) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const tokens = await this.issueTokens(user.id, user.role);

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "login", entityType: "user", entityId: user.id, ipAddress: meta.ip, userAgent: meta.userAgent },
    });

    this.logger.log(`Login: ${user.email} (${user.role})`);
    return { ...tokens, user: { id: user.id, email: user.email, role: user.role } };
  }

  async refresh(refreshToken: string) {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (!stored.user.isActive) throw new UnauthorizedException("Account disabled");

    // Token rotation: revoke old, issue new
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(stored.user.id, stored.user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException("User not found");
    return user;
  }

  private async issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? "change-me-in-production",
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const rawRefreshToken = randomBytes(40).toString("hex");
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
