/**
 * AES-256-GCM para cifrar dados sensíveis (Meta App Secret, access tokens).
 *
 * Layout do payload (base64):
 *   [12 bytes IV][16 bytes auth tag][N bytes ciphertext]
 *
 * A chave (ENCRYPTION_KEY) vem do env: 32 bytes em base64.
 */
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class CryptoService {
  private getKey(): Buffer {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) throw new Error('ENCRYPTION_KEY não configurada');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY precisa ter 32 bytes em base64');
    return key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.getKey(), iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('Payload cifrado invalido');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }
}
