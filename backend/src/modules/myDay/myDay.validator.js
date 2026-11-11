/**
 * LIFE OS - My Day Module Input Validators
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_CATEGORIES = [
  'focus',
  'meal',
  'place',
  'social',
  'wake',
  'sleep',
  'note',
  'workout',
  'other',
];

export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isValidCalendarDate = (dateStr) => {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

const resolveDateInput = (rawDate) => {
  const resolved = rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== ''
    ? String(rawDate).trim()
    : getTodayDateString();
  if (!isValidCalendarDate(resolved)) {
    return { isValid: false, date: null };
  }
  return { isValid: true, date: resolved };
};

const validateOptionalText = (value, fieldName, { maxLength, countCodePoints = false }, errors) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    errors[fieldName] = `${fieldName} must be a string.`;
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const length = countCodePoints ? Array.from(trimmed).length : trimmed.length;
  if (length > maxLength) {
    errors[fieldName] = `${fieldName} cannot exceed ${maxLength} characters.`;
    return null;
  }
  return trimmed;
};

const parseStrictNumber = (value, fieldName, { min = 0, max = Infinity, integer = false }, errors) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'object') {
    errors[fieldName] = `${fieldName} must be a valid ${integer ? 'integer' : 'number'}.`;
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    errors[fieldName] = `${fieldName} must be a valid ${integer ? 'integer' : 'number'}.`;
    return undefined;
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) {
    errors[fieldName] = `${fieldName} must be a finite ${integer ? 'integer' : 'number'}.`;
    return undefined;
  }
  if (integer && !Number.isInteger(num)) {
    errors[fieldName] = `${fieldName} must be a non-negative integer.`;
    return undefined;
  }
  if (num < min || num > max) {
    errors[fieldName] =
      max === Infinity
        ? `${fieldName} must be at least ${min}.`
        : `${fieldName} must be a ${integer ? 'integer' : 'number'} between ${min} and ${max}.`;
    return undefined;
  }
  return num;
};

export const validateDateQuery = (query) => {
  const { isValid, date } = resolveDateInput(query?.date);
  if (!isValid) {
    return {
      isValid: false,
      error: 'Invalid calendar date. Expected a valid YYYY-MM-DD date (e.g., 2026-11-08).',
      date: null,
    };
  }
  return { isValid: true, error: null, date };
};

export const validateHistoryDays = (rawDays) => {
  if (rawDays === undefined || rawDays === '') {
    return { isValid: true, error: null, days: 7 };
  }
  const rawStr = String(rawDays).trim();
  if (!/^-?\d+$/.test(rawStr)) {
    return {
      isValid: false,
      error: 'days query parameter must be an integer between 1 and 30.',
      days: null,
    };
  }
  const parsed = Number.parseInt(rawStr, 10);
  return {
    isValid: true,
    error: null,
    days: Math.min(Math.max(parsed, 1), 30),
  };
};

export const validateCreateActivity = (body) => {
  const errors = {};
  const { title, category, details, meta, timeString, timestamp, icon, logDate } = body || {};

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.title = 'Activity title is required and cannot be empty.';
  } else if (title.trim().length > 150) {
    errors.title = 'Activity title cannot exceed 150 characters.';
  }

  const cleanCategory =
    category !== undefined && category !== null && String(category).trim() !== ''
      ? String(category).toLowerCase().trim()
      : 'focus';
  if (!VALID_CATEGORIES.includes(cleanCategory)) {
    errors.category = `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`;
  }

  const dateRes = resolveDateInput(logDate);
  if (!dateRes.isValid) {
    errors.logDate = 'Invalid logDate calendar date. Expected YYYY-MM-DD.';
  }

  const cleanDetails = validateOptionalText(details, 'details', { maxLength: 2000 }, errors);
  const cleanMeta = validateOptionalText(meta, 'meta', { maxLength: 150 }, errors);
  const cleanTimeString = validateOptionalText(timeString, 'timeString', { maxLength: 20 }, errors);
  const cleanIcon = validateOptionalText(icon, 'icon', { maxLength: 10, countCodePoints: true }, errors);

  let resolvedTimestamp = Date.now();
  if (timestamp !== undefined && timestamp !== null) {
    const parsedTs = parseStrictNumber(timestamp, 'timestamp', { min: 1 }, errors);
    if (parsedTs !== undefined) {
      resolvedTimestamp = parsedTs;
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized: {
      title: typeof title === 'string' ? title.trim() : '',
      category: cleanCategory,
      details: cleanDetails,
      meta: cleanMeta,
      timeString: cleanTimeString,
      timestamp: resolvedTimestamp,
      icon: cleanIcon,
      logDate: dateRes.date || getTodayDateString(),
    },
  };
};

export const validateUpdateActivity = (body) => {
  const errors = {};
  const sanitized = {};
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const { title, category, details, meta, timeString, icon } = payload;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      errors.title = 'Activity title cannot be empty.';
    } else if (title.trim().length > 150) {
      errors.title = 'Activity title cannot exceed 150 characters.';
    } else {
      sanitized.title = title.trim();
    }
  }

  if (category !== undefined) {
    if (typeof category !== 'string') {
      errors.category = 'category must be a string.';
    } else {
      const cleanCategory = category.toLowerCase().trim();
      if (!VALID_CATEGORIES.includes(cleanCategory)) {
        errors.category = `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`;
      } else {
        sanitized.category = cleanCategory;
      }
    }
  }

  if (details !== undefined) {
    sanitized.details = validateOptionalText(details, 'details', { maxLength: 2000 }, errors);
  }
  if (meta !== undefined) {
    sanitized.meta = validateOptionalText(meta, 'meta', { maxLength: 150 }, errors);
  }
  if (timeString !== undefined) {
    const parsedTime = validateOptionalText(timeString, 'timeString', { maxLength: 20 }, errors);
    if (parsedTime === null && !errors.timeString) {
      errors.timeString = 'timeString cannot be empty or null.';
    } else {
      sanitized.timeString = parsedTime;
    }
  }
  if (icon !== undefined) {
    const parsedIcon = validateOptionalText(icon, 'icon', { maxLength: 10, countCodePoints: true }, errors);
    if (parsedIcon === null && !errors.icon) {
      errors.icon = 'icon cannot be empty or null.';
    } else {
      sanitized.icon = parsedIcon;
    }
  }

  if (Object.keys(errors).length === 0 && Object.keys(sanitized).length === 0) {
    errors._form = 'At least one updatable field (title, category, details, meta, timeString, icon) is required.';
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized,
  };
};

export const validateUpdateMetrics = (body) => {
  const errors = {};
  const { logDate, studyHours, workHours, activeSteps, sleepHours, mood, notes } = body || {};

  const dateRes = resolveDateInput(logDate);
  if (!dateRes.isValid) {
    errors.logDate = 'Invalid logDate calendar date. Expected YYYY-MM-DD.';
  }

  const cleanStudyHours =
    studyHours !== undefined ? parseStrictNumber(studyHours, 'studyHours', { min: 0, max: 24 }, errors) : undefined;
  const cleanWorkHours =
    workHours !== undefined ? parseStrictNumber(workHours, 'workHours', { min: 0, max: 24 }, errors) : undefined;
  const cleanActiveSteps =
    activeSteps !== undefined ? parseStrictNumber(activeSteps, 'activeSteps', { min: 0, integer: true }, errors) : undefined;
  const cleanSleepHours =
    sleepHours !== undefined ? parseStrictNumber(sleepHours, 'sleepHours', { min: 0, max: 24 }, errors) : undefined;

  let cleanMood;
  if (mood !== undefined) {
    if (typeof mood !== 'string' || mood.trim().length === 0 || mood.trim().length > 50) {
      errors.mood = 'mood must be a non-empty string up to 50 characters.';
    } else {
      cleanMood = mood.trim();
    }
  }

  let cleanNotes;
  if (notes !== undefined) {
    cleanNotes = validateOptionalText(notes, 'notes', { maxLength: 2000 }, errors);
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized: {
      logDate: dateRes.date || getTodayDateString(),
      studyHours: cleanStudyHours,
      workHours: cleanWorkHours,
      activeSteps: cleanActiveSteps,
      sleepHours: cleanSleepHours,
      mood: cleanMood,
      notes: cleanNotes,
    },
  };
};
