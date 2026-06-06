'use strict';

const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');

const expressApp = express();
let cachedApp = null;

async function getApp() {
  if (!cachedApp) {
    const { AppModule } = require('../dist/app.module');
    cachedApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: ['error', 'warn'],
    });
    cachedApp.enableCors({
      origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    });
    cachedApp.setGlobalPrefix('api');
    await cachedApp.init();
  }
  return expressApp;
}

module.exports = async (req, res) => {
  const server = await getApp();
  return server(req, res);
};
