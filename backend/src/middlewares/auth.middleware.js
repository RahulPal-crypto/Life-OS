import { verifyAccessToken } from '../utils/tokenHelper.js';
import { sendError } from '../utils/apiResponse.js';
import { query } from '../config/db.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(
        res,
        'Access denied. No authentication token provided.',
        401,
        'NO_TOKEN_PROVIDED'
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return sendError(
        res,
        'Authentication token is invalid or has expired.',
        401,
        'INVALID_OR_EXPIRED_TOKEN'
      );
    }

    // Verify user exists and is active in DB
    const users = await query(
      'SELECT id, name, email, phone, profile_image, is_email_verified, is_phone_verified, account_status FROM users WHERE id = ? LIMIT 1',
      [decoded.sub]
    );

    if (users.length === 0) {
      return sendError(res, 'User account associated with this token no longer exists.', 401, 'USER_NOT_FOUND');
    }

    const user = users[0];

    if (user.account_status !== 'active') {
      return sendError(res, `Account is currently ${user.account_status}. Please contact support.`, 403, 'ACCOUNT_NOT_ACTIVE');
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 'Authentication verification failed.', 500, 'AUTH_ERROR', error.message);
  }
};
