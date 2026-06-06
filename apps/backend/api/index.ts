/**
 * Serverless entry point para Vercel.
 * O NestJS é inicializado uma vez e reutilizado entre requests (module-level singleton).
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { INestApplication } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from '../src/app.module';

const expressApp = express();
let app: INestApplication | null = null;

async function getApp(): Promise<express.Express> {
  if (!app) {
    app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: ['error', 'warn'],
    });

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    app.enableCors({ origin: webOrigin, credentials: true });
    app.setGlobalPrefix('api');
    await app.init();
  }
  return expressApp;
}

export default async function handler(req: any, res: any) {
  const server = await getApp();
  server(req, res);
}
