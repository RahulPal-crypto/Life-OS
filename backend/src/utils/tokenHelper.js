import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import crypto from 'crypto';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      type: 'access',
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry }
  );
};

export const generateRefreshToken = (user) => {
  const tokenId = crypto.randomUUID();
  return jwt.sign(
    {
      sub: user.id,
      jti: tokenId,
      type: 'refresh',
    },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry }
  );
};

const verifyTypedToken = (token, secret, expectedType) => {
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || decoded.type !== expectedType) {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

export const verifyAccessToken = (token) => {
  return verifyTypedToken(token, env.jwt.accessSecret, 'access');
};

export const verifyRefreshToken = (token) => {
  return verifyTypedToken(token, env.jwt.refreshSecret, 'refresh');
};
