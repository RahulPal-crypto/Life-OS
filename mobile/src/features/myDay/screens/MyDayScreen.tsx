import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing } from '../../../theme';
import { ScreenContainer } from '../../../components';
import { MyDayTopBar } from '../components/MyDayTopBar';
import { DateSelector } from '../components/DateSelector';
import { DaySnapshotBanner } from '../components/DaySnapshotBanner';
import { MetricCardsRow } from '../components/MetricCardsRow';
import { TodayAtAGlance } from '../components/TodayAtAGlance';
import { MyDayTimelineStream, TimelineEventItem } from '../components/MyDayTimelineStream';
import { QuickLogModal } from '../components/QuickLogModal';
import { myDayService, DaySnapshot, GlanceItem } from '../services/myDayService';
import { User } from '../../auth';

interface MyDayScreenProps {
  user: User | null;
  onBackToDashboard?: () => void;
  onSwitchSpace?: () => void;
  onLogout?: () => void;
}

const formatDateToYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const MyDayScreen: React.FC<MyDayScreenProps> = ({
  user,
  onBackToDashboard,
  onSwitchSpace,
  onLogout,
}) => {
  // Use today's real current date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real Metrics State from Backend
  const [studyHours, setStudyHours] = useState(0.0);
  const [workHours, setWorkHours] = useState(0.0);
  const [activeSteps, setActiveSteps] = useState(0);
  const [sleepHours, setSleepHours] = useState(0.0);

  // Real Today at a Glance State
  const [mealsCount, setMealsCount] = useState(0);
  const [conversationsCount, setConversationsCount] = useState(0);
  const [placesCount, setPlacesCount] = useState(0);
  const [activitiesCount, setActivitiesCount] = useState(0);

  const [mealsItems, setMealsItems] = useState<GlanceItem[]>([]);
  const [conversationsItems, setConversationsItems] = useState<GlanceItem[]>([]);
  const [placesItems, setPlacesItems] = useState<GlanceItem[]>([]);

  // Real Timeline Events State from Backend
  const [events, setEvents] = useState<TimelineEventItem[]>([]);

  // Load real day data from backend
  const loadDayData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const dateStr = formatDateToYYYYMMDD(currentDate);

    try {
      const snapshot: DaySnapshot = await myDayService.fetchDaySnapshot(dateStr);

      // Populate metrics
      setStudyHours(snapshot.metrics.studyHours);
      setWorkHours(snapshot.metrics.workHours);
      setActiveSteps(snapshot.metrics.activeSteps);
      setSleepHours(snapshot.metrics.sleepHours);

      // Populate Today at a Glance
      setMealsCount(snapshot.todayAtAGlance.meals.count);
      setConversationsCount(snapshot.todayAtAGlance.conversations.count);
      setPlacesCount(snapshot.todayAtAGlance.places.count);
      setActivitiesCount(snapshot.todayAtAGlance.activities.count);

      setMealsItems(snapshot.todayAtAGlance.meals.items || []);
      setConversationsItems(snapshot.todayAtAGlance.conversations.items || []);
      setPlacesItems(snapshot.todayAtAGlance.places.items || []);

      // Populate timeline events
      const mappedEvents: TimelineEventItem[] = (snapshot.timeline || []).map(a => ({
        id: a.id,
        time: a.time,
        icon: a.icon || '☑️',
        title: a.title,
        subtitle: a.subtitle || a.meta || 'Activity logged in My Day',
      }));

      setEvents(mappedEvents);
    } catch (err: any) {
      console.warn('[MyDayScreen] Error fetching snapshot:', err.message);
      // If error occurs, keep UI clean without dummy data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  const handlePreviousDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleAddEvent = async (newEntry: {
    category: any;
    title: string;
    details?: string;
    meta?: string;
    time: string;
  }) => {
    const dateStr = formatDateToYYYYMMDD(currentDate);

    try {
      const created = await myDayService.createActivity({
        logDate: dateStr,
        category: newEntry.category,
        title: newEntry.title,
        details: newEntry.details,
        meta: newEntry.meta,
        timeString: newEntry.time,
      });

      // Add to timeline
      const newItem: TimelineEventItem = {
        id: created.id,
        time: created.time,
        icon: created.icon || '☑️',
        title: created.title,
        subtitle: created.subtitle || created.meta || 'Activity logged in My Day',
      };

      setEvents(prev => [...prev, newItem]);

      // Re-fetch snapshot to sync metrics and counts with backend
      loadDayData(true);
    } catch (err: any) {
      Alert.alert('Unable to Save Activity', err.message || 'Please check your connection.');
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await myDayService.deleteActivity(activityId);
      setEvents(prev => prev.filter(e => e.id !== activityId));
      loadDayData(true);
    } catch (err: any) {
      Alert.alert('Delete Failed', err.message);
    }
  };

  const handleItemPress = (item: TimelineEventItem) => {
    Alert.alert(
      item.title,
      `${item.time}\n\n${item.subtitle}`,
      [
        {
          text: 'Delete Activity',
          style: 'destructive',
          onPress: () => handleDeleteActivity(item.id),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const renderGlanceDetails = (title: string, count: number, items: GlanceItem[], emptyMessage: string) => {
    if (count === 0 || items.length === 0) {
      Alert.alert(title, emptyMessage);
      return;
    }
    const details = items.map(i => `• ${i.title}${i.time ? ` (${i.time})` : ''}`).join('\n');
    Alert.alert(`${title} (${count})`, details);
  };

  return (
    <ScreenContainer backgroundColor="#F4F0FA" barStyle="dark-content">
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadDayData(true)}
              colors={['#7C3AED']}
            />
          }
        >
          {/* 1. Top Bar */}
          <MyDayTopBar
            onBack={() => {
              if (onBackToDashboard) {
                onBackToDashboard();
              }
            }}
            onCalendarPress={() =>
              Alert.alert('Date Navigation', 'Use the ‹ and › buttons to jump between days.')
            }
          />

          {/* 2. Date Selector */}
          <DateSelector
            date={currentDate}
            onPreviousDay={handlePreviousDay}
            onNextDay={handleNextDay}
          />

          {/* 3. Hero Scenic Snapshot Banner */}
          <DaySnapshotBanner />

          {/* Loading indicator when switching dates */}
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#7C3AED" />
            </View>
          ) : (
            <>
              {/* 4. Top 4 Metric Cards Row (Real Data) */}
              <MetricCardsRow
                studyHours={studyHours}
                workHours={workHours}
                activeSteps={activeSteps}
                sleepHours={sleepHours}
              />

              {/* 5. Today at a Glance Grouped Card (Real Data) */}
              <TodayAtAGlance
                mealsCount={mealsCount}
                conversationsCount={conversationsCount}
                placesCount={placesCount}
                activitiesCount={activitiesCount}
                onMealsPress={() =>
                  renderGlanceDetails(
                    'Meals Logged',
                    mealsCount,
                    mealsItems,
                    'No meals logged yet today. Tap Log Activity to add one!'
                  )
                }
                onConversationsPress={() =>
                  renderGlanceDetails(
                    'Conversations',
                    conversationsCount,
                    conversationsItems,
                    'No conversations recorded yet today.'
                  )
                }
                onPlacesPress={() =>
                  renderGlanceDetails(
                    'Places Visited',
                    placesCount,
                    placesItems,
                    'No places logged yet today.'
                  )
                }
                onActivitiesPress={() => setQuickLogVisible(true)}
              />

              {/* 6. My Day Timeline Connected Stream (Real Data) */}
              <MyDayTimelineStream
                events={events}
                onViewAll={() => setQuickLogVisible(true)}
                onItemPress={handleItemPress}
              />
            </>
          )}
        </ScrollView>

        {/* Quick Log Modal */}
        <QuickLogModal
          visible={quickLogVisible}
          onClose={() => setQuickLogVisible(false)}
          onSave={handleAddEvent}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0FA',
  },
  scrollContent: {
    paddingBottom: spacing.xxl + 10,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
