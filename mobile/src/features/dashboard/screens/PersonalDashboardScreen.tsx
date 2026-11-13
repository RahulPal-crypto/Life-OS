import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { ScreenContainer } from '../../../components';
import { DashboardHeader } from '../components/DashboardHeader';
import { ProgressAndMoodCards } from '../components/ProgressAndMoodCards';
import { QuickActionsRow } from '../components/QuickActionsRow';
import { PersonalSpaceGrid } from '../components/PersonalSpaceGrid';
import { FloatingBottomNav, DashboardNavTab } from '../components/FloatingBottomNav';
import { QuickLogModal } from '../../myDay/components/QuickLogModal';
import { myDayService } from '../../myDay/services/myDayService';
import { ActivityCategory } from '../../myDay/services/timelineService';
import { scheduleCompletionAlarm } from '../../myDay/services/activityTimerHelper';
import { User } from '../../auth';

interface PersonalDashboardScreenProps {
  user: User | null;
  onOpenMyDayTimeline: () => void;
  onOpenMemories: () => void;
  onOpenConnect?: () => void;
  onOpenProfile: () => void;
  onSwitchSpace: () => void;
  onLogout: () => void;
}

export const PersonalDashboardScreen: React.FC<PersonalDashboardScreenProps> = ({
  user,
  onOpenMyDayTimeline,
  onOpenMemories,
  onOpenConnect,
  onOpenProfile,
  onSwitchSpace: _onSwitchSpace,
  onLogout: _onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardNavTab>('home');
  const [quickLogModalVisible, setQuickLogModalVisible] = useState(false);
  const [quickLogDefaultCategory, setQuickLogDefaultCategory] = useState<ActivityCategory>('focus');

  // Real Dashboard Metrics from Backend
  const [dashboardMetrics, setDashboardMetrics] = useState({
    studyHours: 0.0,
    workHours: 0.0,
    otherHours: 0.0,
    progressPercentage: 0,
    mood: 'Productive',
  });

  const loadDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const snapshot = await myDayService.fetchDaySnapshot(dateStr);
      if (snapshot && snapshot.metrics) {
        const totalFocus = (snapshot.metrics.studyHours || 0) + (snapshot.metrics.workHours || 0);
        const dailyTarget = user?.dailyFocusGoal || 8.0;
        const pct = Math.min(Math.round((totalFocus / dailyTarget) * 100), 100);
        const otherHours = Math.round(((snapshot.todayAtAGlance?.activities?.count || 0) * 0.5) * 10) / 10;

        setDashboardMetrics({
          studyHours: snapshot.metrics.studyHours || 0,
          workHours: snapshot.metrics.workHours || 0,
          otherHours,
          progressPercentage: pct,
          mood: snapshot.metrics.mood || 'Productive',
        });
      }
    } catch {
      // Graceful fallback without hardcoded fake data
    }
  }, [user?.dailyFocusGoal]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleSelectModule = (moduleId: string) => {
    switch (moduleId) {
      case 'my-day':
        onOpenMyDayTimeline();
        break;
      case 'my-memories':
        onOpenMemories();
        break;
      case 'my-interview':
        Alert.alert('My Interview', 'AI interview prep & mock practice module.');
        break;
      case 'my-ai':
        Alert.alert('My AI', 'Your personal intelligent assistant & life co-pilot.');
        break;
      case 'my-finance':
        Alert.alert('My Finance', 'Income, expenses, and family budget tracker.');
        break;
      case 'my-learning':
        Alert.alert('My Learning', 'Courses, study roadmap, and skill tracker.');
        break;
      case 'my-knowledge':
        Alert.alert('My Knowledge', 'Personal knowledge base, notes, and resources.');
        break;
      case 'my-places':
        Alert.alert('My Places', 'Places visited, favorite spots, and geo-memories.');
        break;
      case 'my-connect':
        if (onOpenConnect) {
          onOpenConnect();
        } else {
          Alert.alert('My Connect', 'Personal CRM, communication logs, and calls.');
        }
        break;
      case 'my-vault':
        Alert.alert('My Vault', 'Encrypted password manager and secure file vault.');
        break;
      default:
        break;
    }
  };

  const handleAddQuickAction = (category: ActivityCategory) => {
    setQuickLogDefaultCategory(category);
    setQuickLogModalVisible(true);
  };

  const handleSaveActivity = async (entry: {
    category: ActivityCategory;
    title: string;
    details?: string;
    meta?: string;
    time: string;
    durationMinutes?: number;
  }) => {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const created = await myDayService.createActivity({
        logDate: dateStr,
        category: entry.category,
        title: entry.title,
        details: entry.details,
        meta: entry.meta,
        timeString: entry.time,
        durationMinutes: entry.durationMinutes,
      });

      if (created.timerStatus === 'active' && created.endsAt) {
        await scheduleCompletionAlarm(
          created.id,
          created.title,
          created.durationMinutes || entry.durationMinutes || 0,
          created.endsAt
        );
      }

      // Reload dashboard metrics
      loadDashboardData();

      const saveMessage =
        created.timerStatus === 'active' && created.endTime && created.durationMinutes
          ? `"${entry.title}" timer started for ${created.durationMinutes} min. It will auto-stop at ${created.endTime} with a beep alert.`
          : `"${entry.title}" has been recorded into today's timeline!`;

      Alert.alert(
        'Activity Saved',
        saveMessage,
        [
          {
            text: 'View Timeline',
            onPress: onOpenMyDayTimeline,
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Unable to Save Activity', err.message || 'Please check connection.');
    }
  };

  const handleNavTabChange = (tab: DashboardNavTab) => {
    if (tab === 'my-day') {
      onOpenMyDayTimeline();
      return;
    }
    if (tab === 'memories') {
      handleSelectModule('my-memories');
      return;
    }
    if (tab === 'profile') {
      onOpenProfile();
      return;
    }
    setActiveTab(tab);
  };

  return (
    <ScreenContainer backgroundColor="#F4F0FA" barStyle="dark-content">
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Header with Logo, Bell, Avatar & Sunset Mountain Banner */}
          <DashboardHeader
            userName={user?.name || 'Rahul Pal'}
            profileImage={user?.profileImage}
            onNotificationPress={() =>
              Alert.alert('Notifications', 'No new notifications right now.')
            }
            onProfilePress={() => handleNavTabChange('profile')}
          />

          {/* 2. Today's Progress Ring & Today's Mood Cards (Real Backend Metrics) */}
          <ProgressAndMoodCards
            progressPercentage={dashboardMetrics.progressPercentage}
            studyHours={dashboardMetrics.studyHours}
            workHours={dashboardMetrics.workHours}
            otherHours={dashboardMetrics.otherHours}
            mood={dashboardMetrics.mood}
            onMoodPress={() =>
              Alert.alert('Mood Logger', `Current mood: ${dashboardMetrics.mood} 😊`)
            }
          />

          {/* 3. Quick Actions Row */}
          <QuickActionsRow
            onAddActivity={() => handleAddQuickAction('focus')}
            onLogMeal={() => handleAddQuickAction('meal')}
            onStartStudy={() => handleAddQuickAction('focus')}
            onAddMemory={() => handleAddQuickAction('note')}
            onViewAll={() =>
              Alert.alert('Quick Actions', 'Shortcut actions for instant life logging.')
            }
          />

          {/* 4. Personal Space Modules Grid (10 modules) */}
          <PersonalSpaceGrid onSelectModule={handleSelectModule} />
        </ScrollView>

        {/* 5. Floating Bottom Navigation Bar (Elevated Over Content) */}
        <View style={styles.floatingNavWrapper}>
          <FloatingBottomNav
            activeTab={activeTab}
            onChangeTab={handleNavTabChange}
            onCenterActionPress={() => handleAddQuickAction('focus')}
          />
        </View>

        {/* Quick Log Modal */}
        <QuickLogModal
          visible={quickLogModalVisible}
          defaultCategory={quickLogDefaultCategory}
          onClose={() => setQuickLogModalVisible(false)}
          onSave={handleSaveActivity}
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
    paddingBottom: 96,
  },
  floatingNavWrapper: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
});
