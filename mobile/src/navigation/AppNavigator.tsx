import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  BackHandler,
  ToastAndroid,
  Platform,
} from 'react-native';
import { WelcomeScreen } from '../features/onboarding';
import { SpaceSelectionScreen } from '../features/spaces';
import { AuthScreen, User, authService } from '../features/auth';
import { PersonalDashboardScreen } from '../features/dashboard';
import { MyDayScreen } from '../features/myDay';
import { MyMemoriesScreen } from '../features/memories';
import { ProfileScreen } from '../features/profile';
import {
  UpdateAvailableModal,
  appUpdateService,
  UpdateCheckResult,
} from '../features/updates';
import { colors } from '../theme';

export type CurrentScreen =
  | 'welcome'
  | 'space-selection'
  | 'auth'
  | 'dashboard'
  | 'my-day'
  | 'memories'
  | 'profile';

export const AppNavigator: React.FC = () => {
  const [history, setHistory] = useState<CurrentScreen[]>(['welcome']);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const hasCheckedUpdateRef = useRef(false);

  const currentScreen = history[history.length - 1] || 'space-selection';

  // Animation values
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const selectionOpacity = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;

  // Track double-back to exit on root screen
  const lastBackPressRef = useRef<number>(0);

  // Animate screen transitions smoothly
  const animateScreenTransition = useCallback(() => {
    screenFade.setValue(0.7);
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [screenFade]);

  // Push new screen to history stack
  const navigateTo = useCallback(
    (nextScreen: CurrentScreen) => {
      setHistory(prev => {
        if (prev[prev.length - 1] === nextScreen) return prev;
        return [...prev, nextScreen];
      });
      animateScreenTransition();
    },
    [animateScreenTransition]
  );

  // Pop top screen from history stack (Go Back)
  const goBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, prev.length - 1);
    });
    animateScreenTransition();
  }, [animateScreenTransition]);

  // Reset entire stack to a new root screen (e.g. after login or logout)
  const resetTo = useCallback(
    (rootScreen: CurrentScreen) => {
      setHistory([rootScreen]);
      animateScreenTransition();
    },
    [animateScreenTransition]
  );

  // Called automatically when the welcome animations complete
  const handleWelcomeComplete = () => {
    Animated.parallel([
      Animated.timing(welcomeOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(selectionOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      resetTo('space-selection');
    });
  };

  useEffect(() => {
    const isTestEnv = Boolean(
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        ?.JEST_WORKER_ID
    );
    if (currentScreen === 'welcome' || hasCheckedUpdateRef.current || isTestEnv) return;

    hasCheckedUpdateRef.current = true;
    const controller = new AbortController();

    appUpdateService
      .checkForUpdate(controller.signal)
      .then(result => {
        if (!controller.signal.aborted && result?.hasUpdate) {
          setUpdateInfo(result);
          setUpdateModalVisible(true);
        }
      })
      .catch(() => {
        // Silent fail so offline startup is never blocked
      });

    return () => controller.abort();
  }, [currentScreen]);

  // Android System Back Button & Edge-Swipe Navigation Handler
  useEffect(() => {
    const handleDoubleBackExit = () => {
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };

    const onBackPress = () => {
      // 1. Welcome screen: allow OS to exit or do nothing
      if (currentScreen === 'welcome') {
        return false;
      }

      // 2. If we have a navigation history stack to go back through
      if (history.length > 1) {
        const prevScreen = history[history.length - 2];
        // If the previous screen was welcome animation, treat current as root
        if (prevScreen === 'welcome') {
          return handleDoubleBackExit();
        }

        goBack();
        return true; // Intercepted: navigated to previous page!
      }

      // 3. At root screen (e.g. Space Selection or Dashboard)
      return handleDoubleBackExit();
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backSubscription.remove();
  }, [currentScreen, history, goBack]);

  const handleSelectPersonalSpace = () => {
    const active = authService.getCurrentUser();
    if (active) {
      setCurrentUser(active);
      resetTo('dashboard');
    } else {
      navigateTo('auth');
    }
  };

  const handleBackToSpaces = () => {
    // If user has history, go back; otherwise switch to spaces
    if (history.length > 1) {
      goBack();
    } else {
      navigateTo('space-selection');
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    // Lands directly on Dashboard as the new root (replaces auth in history)
    resetTo('dashboard');
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    resetTo('space-selection');
  };

  return (
    <View style={styles.container}>
      {/* 1. Welcome Screen Layer */}
      {currentScreen === 'welcome' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: welcomeOpacity,
              zIndex: 3,
            },
          ]}
        >
          <WelcomeScreen onAnimationComplete={handleWelcomeComplete} />
        </Animated.View>
      )}

      {/* 2. Space Selection Screen Layer */}
      {currentScreen === 'space-selection' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: screenFade,
              zIndex: 2,
            },
          ]}
        >
          <SpaceSelectionScreen
            onSelectPersonalSpace={handleSelectPersonalSpace}
          />
        </Animated.View>
      )}

      {/* 3. Personal Space Unified Auth Layer (Login / Register) */}
      {currentScreen === 'auth' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: screenFade,
              zIndex: 2,
            },
          ]}
        >
          <AuthScreen
            onBack={handleBackToSpaces}
            onAuthSuccess={handleAuthSuccess}
          />
        </Animated.View>
      )}

      {/* 4. Personal Space Main Dashboard */}
      {currentScreen === 'dashboard' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: screenFade,
              zIndex: 2,
            },
          ]}
        >
          <PersonalDashboardScreen
            user={currentUser}
            onOpenMyDayTimeline={() => navigateTo('my-day')}
            onOpenMemories={() => navigateTo('memories')}
            onOpenProfile={() => navigateTo('profile')}
            onSwitchSpace={() => navigateTo('space-selection')}
            onLogout={handleLogout}
          />
        </Animated.View>
      )}

      {/* 5. My Day Detailed Chronological Timeline */}
      {currentScreen === 'my-day' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: screenFade,
              zIndex: 2,
            },
          ]}
        >
          <MyDayScreen
            user={currentUser}
            onBackToDashboard={goBack}
            onSwitchSpace={() => navigateTo('space-selection')}
            onLogout={handleLogout}
          />
        </Animated.View>
      )}

      {/* 6. My Memories File Vault & Organizer */}
      {currentScreen === 'memories' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: screenFade,
              zIndex: 2,
            },
          ]}
        >
          <MyMemoriesScreen
            user={currentUser}
            onBackToDashboard={goBack}
          />
        </Animated.View>
      )}

      {/* 7. Account & Space Profile Screen */}
      {currentScreen === 'profile' && (
        <Animated.View
          style={[
            styles.fullScreen,
            {
              opacity: screenFade,
              zIndex: 2,
            },
          ]}
        >
          <ProfileScreen
            user={currentUser}
            onBack={goBack}
            onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
            onSwitchSpace={() => navigateTo('space-selection')}
            onLogout={handleLogout}
          />
        </Animated.View>
      )}

      {/* 7. In-App Update Notification & Downloader Modal */}
      <UpdateAvailableModal
        visible={updateModalVisible}
        updateInfo={updateInfo}
        onDismiss={() => setUpdateModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
