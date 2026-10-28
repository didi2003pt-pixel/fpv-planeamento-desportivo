import { ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE } from './auth.service';

export function tokenFromRequest(req: Request): string | undefined {
  const pairs = (req.headers.cookie ?? '').split(';').map(item => item.trim());
  const pair = pairs.find(item => item.startsWith(SESSION_COOKIE + '='));
  return pair?.slice(SESSION_COOKIE.length + 1);
}

/** Apenas pedidos JSON e origens coincidentes; proteção adicional às cookies SameSite. */
export function validateSameOrigin(req: Request): void {
  if (!req.is('application/json')) {
    throw new UnsupportedMediaTypeException('O pedido deve ser JSON.');
  }
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) {
        throw new ForbiddenException('Origem não permitida.');
      }
    } catch {
      throw new ForbiddenException('Origem não permitida.');
    }
  }
}
