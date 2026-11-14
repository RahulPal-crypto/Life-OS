import { NativeModules } from 'react-native';

interface NativeConnectCall {
  startRinging: (isIncoming: boolean) => Promise<boolean>;
  stopRinging: () => Promise<boolean>;
  setCallMode: (inCall: boolean) => Promise<boolean>;
  setSpeakerphoneOn: (on: boolean) => Promise<boolean>;
  isSpeakerphoneOn: () => Promise<boolean>;
  setMicrophoneMute: (muted: boolean) => Promise<boolean>;
  isMicrophoneMute: () => Promise<boolean>;
}

const nativeCall: NativeConnectCall | undefined = NativeModules?.ConnectCall;

export const connectCallNative = {
  async startRinging(isIncoming: boolean): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.startRinging(isIncoming);
      } catch {
        // Fallback
      }
    }
    return true;
  },

  async stopRinging(): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.stopRinging();
      } catch {
        // Fallback
      }
    }
    return true;
  },

  async setCallMode(inCall: boolean): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.setCallMode(inCall);
      } catch {
        // Fallback
      }
    }
    return true;
  },

  async setSpeakerphoneOn(on: boolean): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.setSpeakerphoneOn(on);
      } catch {
        // Fallback
      }
    }
    return on;
  },

  async isSpeakerphoneOn(): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.isSpeakerphoneOn();
      } catch {
        // Fallback
      }
    }
    return false;
  },

  async setMicrophoneMute(muted: boolean): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.setMicrophoneMute(muted);
      } catch {
        // Fallback
      }
    }
    return muted;
  },

  async isMicrophoneMute(): Promise<boolean> {
    if (nativeCall) {
      try {
        return await nativeCall.isMicrophoneMute();
      } catch {
        // Fallback
      }
    }
    return false;
  },
};
