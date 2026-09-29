import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function getTotpAuthUrl(email: string, secret: string, issuer: string = 'Persona Studio'): string {
  return generateURI({
    secret,
    issuer,
    label: email,
  });
}

export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    margin: 2,
    width: 250,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export function verifyTotpToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const cleanedToken = token.replace(/\s+/g, '');
  try {
    const result = verifySync({
      token: cleanedToken,
      secret,
    });
    return Boolean(result && typeof result === 'object' && result.valid);
  } catch {
    return false;
  }
}

export function generateBackupCodes(count: number = 8): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    // 8-character alphanumeric code in format XXXX-XXXX
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    plainCodes.push(code);

    const hash = crypto.createHash('sha256').update(code).digest('hex');
    hashedCodes.push(hash);
  }

  return { plainCodes, hashedCodes };
}

export function verifyAndConsumeBackupCode(
  inputCode: string,
  hashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const normalized = inputCode.trim().toUpperCase();
  const inputHash = crypto.createHash('sha256').update(normalized).digest('hex');

  const index = hashedCodes.indexOf(inputHash);
  if (index === -1) {
    return { valid: false, remainingHashedCodes: hashedCodes };
  }

  const remainingHashedCodes = [...hashedCodes];
  remainingHashedCodes.splice(index, 1);
  return { valid: true, remainingHashedCodes };
}

export async function initiateTotpSetup(email: string): Promise<TotpSetupResult> {
  const secret = generateTotpSecret();
  const otpauthUrl = getTotpAuthUrl(email, secret);
  const qrCodeDataUrl = await generateQrCode(otpauthUrl);
  const { plainCodes } = generateBackupCodes();

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
    backupCodes: plainCodes,
  };
}
