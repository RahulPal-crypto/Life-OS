export type ActivityCategory = 'focus' | 'meal' | 'place' | 'social' | 'note';

export interface TimelineEntry {
  id: string;
  time: string; // e.g. "09:15 AM"
  timestamp: number;
  category: ActivityCategory;
  title: string;
  details?: string;
  meta?: string; // e.g. "2.5 hrs" or "Central City Library"
  isAutoTracked?: boolean;
}

export interface DaySummary {
  focusHours: number;
  placesCount: number;
  mealsCount: number;
  autoTrackingActive: boolean;
}

class TimelineService {
  private entries: TimelineEntry[] = [
    {
      id: 'entry_1',
      time: '08:30 AM',
      timestamp: Date.now() - 1000 * 60 * 60 * 6,
      category: 'meal',
      title: 'Breakfast',
      details: 'Oatmeal, black coffee, and fresh berries.',
      meta: 'Nutrition logged',
    },
    {
      id: 'entry_2',
      time: '09:45 AM',
      timestamp: Date.now() - 1000 * 60 * 60 * 5,
      category: 'focus',
      title: 'Deep Work: System Architecture',
      details: 'Engineered modular mobile layers and core schemas.',
      meta: '2.5 hrs focus',
    },
    {
      id: 'entry_3',
      time: '01:15 PM',
      timestamp: Date.now() - 1000 * 60 * 60 * 3,
      category: 'place',
      title: 'Central Tech Hub',
      details: 'Arrived at Co-working space for afternoon sprint.',
      meta: 'GPS Check-in',
      isAutoTracked: true,
    },
    {
      id: 'entry_4',
      time: '02:00 PM',
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      category: 'meal',
      title: 'Lunch',
      details: 'Grilled salad and hydration break.',
      meta: 'Nutrition logged',
    },
    {
      id: 'entry_5',
      time: '03:30 PM',
      timestamp: Date.now() - 1000 * 60 * 60 * 1,
      category: 'social',
      title: 'Call with Project Collaborator',
      details: 'Reviewed product milestone and personal space roadmap.',
      meta: '25 mins call',
    },
  ];

  getEntries(): TimelineEntry[] {
    return [...this.entries].sort((a, b) => a.timestamp - b.timestamp);
  }

  addEntry(entry: Omit<TimelineEntry, 'id' | 'timestamp'>): TimelineEntry {
    const newEntry: TimelineEntry = {
      ...entry,
      id: `entry_${Date.now()}`,
      timestamp: Date.now(),
    };
    this.entries.push(newEntry);
    return newEntry;
  }

  getSummary(): DaySummary {
    let focusMinutes = 0;
    let placesCount = 0;
    let mealsCount = 0;

    for (const e of this.entries) {
      if (e.category === 'focus') {
        // approximate parse or default 1.5 hrs
        focusMinutes += 120;
      } else if (e.category === 'place') {
        placesCount += 1;
      } else if (e.category === 'meal') {
        mealsCount += 1;
      }
    }

    return {
      focusHours: Math.round((focusMinutes / 60) * 10) / 10,
      placesCount: placesCount || 1,
      mealsCount: mealsCount || 1,
      autoTrackingActive: true,
    };
  }
}

export const timelineService = new TimelineService();
