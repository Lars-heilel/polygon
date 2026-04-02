import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import type { Request, Response } from 'express';
import request from 'supertest';

@Controller('test')
class TestController {
  @Get()
  get() {
    return { ok: true };
  }

  @Post()
  post() {
    return { ok: true };
  }
}

describe('CSRF Protection', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());

    const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
      getSecret: () => 'test-csrf-secret-min-32-chars-xxxx',
      getSessionIdentifier: (req) => (req as Request).ip ?? 'test-session',
      cookieName: '__csrf',
      cookieOptions: { sameSite: 'strict', secure: false, httpOnly: true },
      getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
    });

    app.use(doubleCsrfProtection);

    app.getHttpAdapter().get('/csrf-token', (req: Request, res: Response) => {
      const token = generateCsrfToken(req, res);
      res.json({ token });
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow GET requests without CSRF token', async () => {
    await request(app.getHttpServer()).get('/test').expect(200);
  });

  it('should reject POST requests without CSRF token', async () => {
    await request(app.getHttpServer()).post('/test').expect(403);
  });

  it('should allow POST requests with valid CSRF token', async () => {
    const agent = request.agent(app.getHttpServer());
    const tokenRes = await agent.get('/csrf-token').expect(200);
    const csrfToken = tokenRes.body.token;

    await agent.post('/test').set('x-csrf-token', csrfToken).expect(201);
  });
});
