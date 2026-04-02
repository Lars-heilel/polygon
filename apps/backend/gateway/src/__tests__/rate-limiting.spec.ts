import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

@Controller('test')
class TestController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('Rate Limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 3 }],
        }),
      ],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests within limit', async () => {
    await request(app.getHttpServer()).get('/test').expect(200);
    await request(app.getHttpServer()).get('/test').expect(200);
    await request(app.getHttpServer()).get('/test').expect(200);
  });

  it('should return 429 when limit is exceeded', async () => {
    await request(app.getHttpServer()).get('/test').expect(429);
  });
});
