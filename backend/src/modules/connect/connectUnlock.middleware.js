import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { sendError } from '../../utils/apiResponse.js';

export const requireConnectUnlock = (req, res, next) => {
  const token = req.headers['x-connect-unlock-token'];
  if (typeof token !== 'string' || !token) {
    return sendError(res, 'Unlock My Connect with your PIN first.', 403, 'CONNECT_LOCKED');
  }

  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    if (decoded?.scope !== 'my_connect' || decoded?.sub !== req.user?.id) {
      return sendError(res, 'Connect unlock session is invalid.', 403, 'CONNECT_LOCKED');
    }
  } catch {
    return sendError(res, 'Connect unlock session expired. Enter your PIN again.', 403, 'CONNECT_LOCKED');
  }

  next();
};
