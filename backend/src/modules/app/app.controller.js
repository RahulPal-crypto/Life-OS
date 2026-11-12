import { sendSuccess } from '../../utils/apiResponse.js';
import { appService } from './app.service.js';

export const getAppVersion = async (req, res, next) => {
  try {
    const versionInfo = await appService.getLatestVersion();
    return sendSuccess(res, 'Latest app version metadata retrieved.', versionInfo);
  } catch (error) {
    return next(error);
  }
};
