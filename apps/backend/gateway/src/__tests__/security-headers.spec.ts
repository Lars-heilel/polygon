import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';

describe('Security Headers', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [],
    }).compile();

    app = module.createNestApplication();
    app.use(helmet());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return X-Content-Type-Options header', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should return X-Frame-Options header', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should not expose X-Powered-By header', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
