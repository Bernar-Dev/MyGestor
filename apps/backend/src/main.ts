import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}/api (origin: ${webOrigin})`);
}
bootstrap();
