import "reflect-metadata";
import * as jwt from "jsonwebtoken";
import { ArgumentsHost, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { Socket } from "socket.io";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator";
import { ROLES_KEY } from "./decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";
import { ReservationsController } from "../reservations/reservations.controller";
import { EventsController } from "../events/events.controller";
import { HealthController } from "../health/health.controller";
import { UploadService } from "../upload/upload.service";
import { GlobalExceptionFilter } from "../../common/filters/http-exception.filter";
import { RealtimeGateway } from "../realtime/realtime.gateway";

jest.mock("fs", () => ({
  ...jest.requireActual<typeof import("fs")>("fs"),
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));
jest.mock("uuid", () => ({ v4: () => "test-uuid" }));
jest.mock("sharp", () => ({ __esModule: true, default: jest.fn() }));

const reflector = new Reflector();
const GUARDS_KEY = "__guards__";

function methodsOf(controller: { prototype: object }): Array<() => unknown> {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== "constructor")
    .map((name) => proto[name])
    .filter((v): v is () => unknown => typeof v === "function");
}

describe("security hardening", () => {
  describe("AuthController.register", () => {
    const handler = AuthController.prototype.register;

    it("requires JwtAuthGuard and RolesGuard", () => {
      const guards: unknown[] = Reflect.getMetadata(GUARDS_KEY, handler) ?? [];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it("requires the ADMIN role", () => {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.ADMIN]);
    });

    it("is not public", () => {
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        handler,
        AuthController,
      ]);
      expect(isPublic).toBeFalsy();
    });
  });

  describe("ReservationsController", () => {
    it("has no @Public methods", () => {
      const publicMethods = methodsOf(ReservationsController).filter(
        (m) => reflector.get<boolean>(IS_PUBLIC_KEY, m) === true,
      );
      expect(publicMethods).toHaveLength(0);
    });
  });

  describe("EventsController", () => {
    it("active/today is not public", () => {
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        EventsController.prototype.getActiveEventsToday,
        EventsController,
      ]);
      expect(isPublic).toBeFalsy();
    });
  });

  describe("HealthController.metrics", () => {
    const handler = HealthController.prototype.metrics;

    it("requires ADMIN role behind JwtAuthGuard and RolesGuard", () => {
      const guards: unknown[] = Reflect.getMetadata(GUARDS_KEY, handler) ?? [];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.ADMIN]);
    });
  });

  describe("UploadService.deleteAvatar", () => {
    let service: UploadService;

    beforeEach(() => {
      service = new UploadService();
    });

    it.each(["../../etc/passwd", "a/b.webp", "..%2Fx"])(
      "rejects %s",
      async (name) => {
        await expect(service.deleteAvatar(name)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it("accepts a plain filename", async () => {
      await expect(service.deleteAvatar("abc123.webp")).resolves.toBeUndefined();
    });
  });

  describe("GlobalExceptionFilter", () => {
    const originalEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("hides internal error messages in production", () => {
      process.env.NODE_ENV = "production";
      const json = jest.fn();
      const response = { status: jest.fn().mockReturnValue({ json }) };
      const host = {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => ({ url: "/x", headers: {} }),
        }),
      } as unknown as ArgumentsHost;

      new GlobalExceptionFilter().catch(
        new Error('relation "users" does not exist'),
        host,
      );

      const body = json.mock.calls[0][0] as { error: { message: string } };
      expect(body.error.message).toBe("Internal server error");
      expect(JSON.stringify(body)).not.toContain("users");
    });
  });

  describe("RealtimeGateway.joinUser", () => {
    it("uses the role from the verified JWT, not the client payload", () => {
      const secret = "test-secret";
      const config = {
        get: (key: string) => (key === "JWT_SECRET" ? secret : undefined),
      } as unknown as ConfigService;
      const gateway = new RealtimeGateway(config);

      const joined: string[] = [];
      const client = {
        id: "sock1",
        handshake: {
          auth: { token: jwt.sign({ sub: "u1", role: "staff" }, secret) },
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: (room: string) => {
          joined.push(room);
        },
      } as unknown as Socket;

      gateway.handleConnection(client);
      gateway.handleJoinUser(client, { userId: "u1", role: "admin" });

      expect(joined).toContain("role:staff");
      expect(joined).not.toContain("role:admin");
    });

    it("joinEvent cannot overwrite the verified role before joinUser", () => {
      const secret = "test-secret";
      const config = {
        get: (key: string) => (key === "JWT_SECRET" ? secret : undefined),
      } as unknown as ConfigService;
      const gateway = new RealtimeGateway(config);

      const joined: string[] = [];
      const client = {
        id: "sock2",
        handshake: {
          auth: { token: jwt.sign({ sub: "u2", role: "staff" }, secret) },
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: (room: string) => {
          joined.push(room);
        },
      } as unknown as Socket;

      gateway.handleConnection(client);
      gateway.handleJoinEvent(client, { eventId: "e1", role: "admin" });
      gateway.handleJoinUser(client, { userId: "u2", role: "admin" });

      expect(joined).toContain("role:staff");
      expect(joined).not.toContain("role:admin");
    });
  });
});
