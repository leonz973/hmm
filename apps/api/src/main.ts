import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({ origin: true, credentials: true });

  // 单镜像模式：同一个端口既提供 /api/v1，也提供打包好的前端（SPA 回退到 index.html）
  if (process.env.SERVE_WEB === '1') {
    const webDist = resolve(process.env.WEB_DIST ?? join(__dirname, '../../web/dist'));
    const indexHtml = join(webDist, 'index.html');
    if (existsSync(indexHtml)) {
      app.useStaticAssets(webDist, { index: false, maxAge: '1h' });
      app.use((req: any, res: any, next: any) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (req.path.startsWith('/api/')) return next();
        return res.sendFile(indexHtml);
      });
      Logger.log(`Serving web from ${webDist}`, 'Bootstrap');
    } else {
      Logger.warn(`SERVE_WEB=1 but ${indexHtml} not found, API only`, 'Bootstrap');
    }
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`HMM API listening on :${port}`, 'Bootstrap');
}
void bootstrap();
