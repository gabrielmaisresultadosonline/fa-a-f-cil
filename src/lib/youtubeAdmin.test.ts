import { describe, expect, it } from 'vitest';
import { canUploadCookies } from './youtubeAdmin';

describe('envio de cookies do YouTube', () => {
  it('permite envio pelo domínio HTTPS e renderização no mesmo endereço', () => {
    expect(canUploadCookies('https://motionmro.com.br/admin/painel', 'https://motionmro.com.br/render')).toBe(true);
  });

  it('não envia uma sessão pelo IP público sem HTTPS', () => {
    expect(canUploadCookies('http://189.24.24.252/admin/painel', 'http://189.24.24.252:4400')).toBe(false);
  });

  it('permite o envio local durante o desenvolvimento', () => {
    expect(canUploadCookies('http://localhost:8080/admin/painel', 'http://localhost:4400')).toBe(true);
  });
});
