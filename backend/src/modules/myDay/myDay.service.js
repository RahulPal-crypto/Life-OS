import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../../config/db.js';

const CATEGORY_ICONS = {
  focus: '📖',
  meal: '🍴',
  place: '📍',
  social: '💬',
  wake: '☀️',
  sleep: '🌙',
  workout: '🏃',
  note: '📝',
  other: '☑️',
};

const formatTimeFromTimestamp = (ts) => {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' should be '12'
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

const normalizeDateOnly = (value) => {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value || '').trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : str;
};

const formatDateToReadable = (dateValue) => {
  const dateStr = normalizeDateOnly(dateValue);
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export class MyDayService {
  /**
   * Ensure a summary record exists for a user on a given date (concurrency-safe).
   */
  static async getOrCreateSummary(userId, logDate, runQuery = query) {
    const existing = await runQuery(
      'SELECT * FROM my_day_summaries WHERE user_id = ? AND log_date = ? LIMIT 1',
      [userId, logDate]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    const newId = randomUUID();
    await runQuery(
      `INSERT IGNORE INTO my_day_summaries (id, user_id, log_date, study_hours, work_hours, active_steps, sleep_hours, mood)
       VALUES (?, ?, ?, 0.0, 0.0, 0, 0.0, 'Productive')`,
      [newId, userId, logDate]
    );

    const created = await runQuery(
      'SELECT * FROM my_day_summaries WHERE user_id = ? AND log_date = ? LIMIT 1',
      [userId, logDate]
    );
    return created[0];
  }

  /**
   * Get full My Day snapshot for a given date
   */
  static async getDaySnapshot(userId, logDate) {
    // 1. Get or create summary
    const summary = await this.getOrCreateSummary(userId, logDate);

    // 2. Get all timeline activities for that date
    const activities = await query(
      `SELECT id, log_date, time_string, timestamp, category, title, details, meta, icon, is_auto_tracked, created_at
       FROM my_day_activities
       WHERE user_id = ? AND log_date = ?
       ORDER BY timestamp ASC`,
      [userId, logDate]
    );

    // 3. Compute Today at a Glance Aggregations
    const mealsList = activities.filter((a) => a.category === 'meal');
    const conversationsList = activities.filter((a) => a.category === 'social');
    const placesList = activities.filter((a) => a.category === 'place');
    const totalActivities = activities.length;

    return {
      date: logDate,
      formattedDate: formatDateToReadable(logDate),
      metrics: {
        studyHours: Number(summary.study_hours) || 0,
        workHours: Number(summary.work_hours) || 0,
        activeSteps: Number(summary.active_steps) || 0,
        sleepHours: Number(summary.sleep_hours) || 0,
        mood: summary.mood || 'Productive',
        notes: summary.notes || null,
      },
      todayAtAGlance: {
        meals: {
          count: mealsList.length,
          badge: `${mealsList.length} logged`,
          items: mealsList.map((m) => ({ id: m.id, title: m.title, time: m.time_string })),
        },
        conversations: {
          count: conversationsList.length,
          badge: `${conversationsList.length} people`,
          items: conversationsList.map((c) => ({ id: c.id, title: c.title, time: c.time_string })),
        },
        places: {
          count: placesList.length,
          badge: `${placesList.length} places`,
          items: placesList.map((p) => ({ id: p.id, title: p.title, details: p.details })),
        },
        activities: {
          count: totalActivities,
          badge: `${totalActivities} activities`,
        },
      },
      timeline: activities.map((a) => ({
        id: a.id,
        time: a.time_string,
        timestamp: Number(a.timestamp),
        category: a.category,
        title: a.title,
        subtitle: a.details || 'Activity logged in My Day',
        meta: a.meta,
        icon: a.icon,
        isAutoTracked: Boolean(a.is_auto_tracked),
      })),
    };
  }

  /**
   * Create a new timeline activity and automatically update daily metrics
   */
  static async createActivity(userId, data) {
    const { logDate, title, category, details, meta, timeString, timestamp, icon } = data;

    const activityId = randomUUID();
    const resolvedTimestamp = timestamp || Date.now();
    const resolvedTimeString = timeString || formatTimeFromTimestamp(resolvedTimestamp);
    const resolvedIcon = icon || CATEGORY_ICONS[category] || '☑️';

    const activity = await withTransaction(async (txQuery) => {
      // Ensure summary row exists before inserting/auto-updating study metrics
      await this.getOrCreateSummary(userId, logDate, txQuery);

      await txQuery(
        `INSERT INTO my_day_activities
          (id, user_id, log_date, time_string, timestamp, category, title, details, meta, icon, is_auto_tracked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          activityId,
          userId,
          logDate,
          resolvedTimeString,
          resolvedTimestamp,
          category,
          title,
          details || null,
          meta || null,
          resolvedIcon,
        ]
      );

      // Auto-update summary metrics if applicable (e.g. parsing "2.0 hrs" from meta for focus/work)
      if (category === 'focus' && meta) {
        const match = meta.match(/([\d.]+)\s*hr/i);
        if (match) {
          const hours = parseFloat(match[1]);
          if (Number.isFinite(hours) && hours > 0 && hours <= 24) {
            await txQuery(
              `UPDATE my_day_summaries
               SET study_hours = LEAST(999.9, study_hours + ?)
               WHERE user_id = ? AND log_date = ?`,
              [hours, userId, logDate]
            );
          }
        }
      }

      const created = await txQuery(
        `SELECT id, log_date, time_string, timestamp, category, title, details, meta, icon, is_auto_tracked, created_at
         FROM my_day_activities
         WHERE id = ? LIMIT 1`,
        [activityId]
      );

      return created[0];
    });

    return {
      id: activity.id,
      time: activity.time_string,
      timestamp: Number(activity.timestamp),
      category: activity.category,
      title: activity.title,
      subtitle: activity.details || 'Activity logged in My Day',
      meta: activity.meta,
      icon: activity.icon,
      isAutoTracked: Boolean(activity.is_auto_tracked),
    };
  }

  /**
   * Update an existing activity
   */
  static async updateActivity(userId, activityId, updates) {
    const existing = await query(
      'SELECT id, user_id FROM my_day_activities WHERE id = ? AND user_id = ? LIMIT 1',
      [activityId, userId]
    );

    if (existing.length === 0) {
      const err = new Error('Activity not found or unauthorized.');
      err.statusCode = 404;
      err.code = 'ACTIVITY_NOT_FOUND';
      throw err;
    }

    const updateFields = [];
    const updateValues = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(updates.title);
    }
    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(updates.category);
    }
    if (updates.details !== undefined) {
      updateFields.push('details = ?');
      updateValues.push(updates.details);
    }
    if (updates.meta !== undefined) {
      updateFields.push('meta = ?');
      updateValues.push(updates.meta);
    }
    if (updates.timeString !== undefined) {
      updateFields.push('time_string = ?');
      updateValues.push(updates.timeString);
    }
    if (updates.icon !== undefined) {
      updateFields.push('icon = ?');
      updateValues.push(updates.icon);
    }

    if (updateFields.length > 0) {
      updateValues.push(activityId, userId);
      await query(
        `UPDATE my_day_activities SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
        updateValues
      );
    }

    const updated = await query(
      `SELECT id, log_date, time_string, timestamp, category, title, details, meta, icon, is_auto_tracked, created_at
       FROM my_day_activities
       WHERE id = ? LIMIT 1`,
      [activityId]
    );

    const a = updated[0];
    return {
      id: a.id,
      time: a.time_string,
      timestamp: Number(a.timestamp),
      category: a.category,
      title: a.title,
      subtitle: a.details || 'Activity logged in My Day',
      meta: a.meta,
      icon: a.icon,
      isAutoTracked: Boolean(a.is_auto_tracked),
    };
  }

  /**
   * Delete an activity
   */
  static async deleteActivity(userId, activityId) {
    const existing = await query(
      'SELECT id FROM my_day_activities WHERE id = ? AND user_id = ? LIMIT 1',
      [activityId, userId]
    );

    if (existing.length === 0) {
      const err = new Error('Activity not found or unauthorized.');
      err.statusCode = 404;
      err.code = 'ACTIVITY_NOT_FOUND';
      throw err;
    }

    await query('DELETE FROM my_day_activities WHERE id = ? AND user_id = ?', [activityId, userId]);
    return { deleted: true };
  }

  /**
   * Update or set daily metrics (studyHours, workHours, activeSteps, sleepHours, mood)
   */
  static async updateMetrics(userId, data) {
    const { logDate, studyHours, workHours, activeSteps, sleepHours, mood, notes } = data;

    // Ensure record exists
    await this.getOrCreateSummary(userId, logDate);

    const updateFields = [];
    const updateValues = [];

    if (studyHours !== undefined) {
      updateFields.push('study_hours = ?');
      updateValues.push(studyHours);
    }
    if (workHours !== undefined) {
      updateFields.push('work_hours = ?');
      updateValues.push(workHours);
    }
    if (activeSteps !== undefined) {
      updateFields.push('active_steps = ?');
      updateValues.push(activeSteps);
    }
    if (sleepHours !== undefined) {
      updateFields.push('sleep_hours = ?');
      updateValues.push(sleepHours);
    }
    if (mood !== undefined) {
      updateFields.push('mood = ?');
      updateValues.push(mood);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length > 0) {
      updateValues.push(userId, logDate);
      await query(
        `UPDATE my_day_summaries SET ${updateFields.join(', ')} WHERE user_id = ? AND log_date = ?`,
        updateValues
      );
    }

    const updated = await query(
      'SELECT * FROM my_day_summaries WHERE user_id = ? AND log_date = ? LIMIT 1',
      [userId, logDate]
    );

    const s = updated[0];
    return {
      date: normalizeDateOnly(s.log_date),
      studyHours: Number(s.study_hours) || 0,
      workHours: Number(s.work_hours) || 0,
      activeSteps: Number(s.active_steps) || 0,
      sleepHours: Number(s.sleep_hours) || 0,
      mood: s.mood || 'Productive',
      notes: s.notes || null,
    };
  }

  /**
   * Get past N days history overview
   */
  static async getHistory(userId, days = 7) {
    const parsedDays = Number.isInteger(days) ? days : Number.parseInt(days, 10) || 7;
    const safeDays = Math.min(Math.max(parsedDays, 1), 30);

    // Inline validated integer for LIMIT because TiDB prepared statements reject numeric parameters in LIMIT ?
    const historyRows = await query(
      `SELECT s.log_date, s.study_hours, s.work_hours, s.active_steps, s.sleep_hours, s.mood,
              COUNT(a.id) as total_activities
       FROM my_day_summaries s
       LEFT JOIN my_day_activities a ON s.user_id = a.user_id AND s.log_date = a.log_date
       WHERE s.user_id = ?
       GROUP BY s.log_date, s.study_hours, s.work_hours, s.active_steps, s.sleep_hours, s.mood
       ORDER BY s.log_date DESC
       LIMIT ${safeDays}`,
      [userId]
    );

    return historyRows.map((r) => {
      const dateStr = normalizeDateOnly(r.log_date);
      return {
        date: dateStr,
        formattedDate: formatDateToReadable(dateStr),
        studyHours: Number(r.study_hours) || 0,
        workHours: Number(r.work_hours) || 0,
        activeSteps: Number(r.active_steps) || 0,
        sleepHours: Number(r.sleep_hours) || 0,
        mood: r.mood || 'Productive',
        totalActivities: Number(r.total_activities) || 0,
      };
    });
  }
}
