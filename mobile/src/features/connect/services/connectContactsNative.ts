import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { ConnectContacts } = NativeModules;

export interface RawPhoneContact {
  name: string;
  phone: string;
}

export const connectContactsNative = {
  requestPermission: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    try {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
      if (already) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Access',
          message:
            'Life OS needs access to your contacts to discover which of your friends are on Life OS, just like WhatsApp.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        }
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  },

  hasPermission: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
    } catch {
      return false;
    }
  },

  getPhoneContacts: async (): Promise<RawPhoneContact[]> => {
    if (Platform.OS !== 'android' || !ConnectContacts?.getPhoneContacts) {
      return [];
    }
    try {
      const contacts = await ConnectContacts.getPhoneContacts();
      return Array.isArray(contacts) ? contacts : [];
    } catch {
      return [];
    }
  },
};
