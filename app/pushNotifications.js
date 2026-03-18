// pushNotifications.js
// Works on real device builds (npx expo run:android / eas build)
// Does NOT work in Expo Go for background notifications

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Show banner + sound even when app is open ────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Ask permission + get Expo Push Token ─────────────────────────────────────
// The token is what lets Expo's servers deliver notifications to this device.
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log("Must use a physical device for push notifications.");
    return null;
  }

  // Android notification channel (required for Android 8+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3B0A0A",
      sound: "default",
    });
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied.");
    return null;
  }

  // ── Get the token ────────────────────────────────────────────────────────
  try {
    const projectId = "59b6b8ee-eac0-4e75-89bb-6514fb0f4865";
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("✅ Expo Push Token:", token);
    return token;
  } catch (err) {
    console.warn("Could not get push token:", err.message);
    return null;
  }
}

// ── Send a push notification via Expo's push API ─────────────────────────────
// Call this on the SENDER's device, passing the RECEIVER's saved pushToken.
// Expo's server handles delivery even when the receiver's app is closed.
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
) {
  if (!expoPushToken) return;

    const message = {
      to: expoPushToken,
      sound: "default",
      title: title || "Poultry Management System",
      body,
      data: { type: "message" },
      // Android specific — makes it show as a heads-up notification
      priority: "high",
      channelId: "default",
      // These fields are crucial for background delivery
      _displayInForeground: true,
      shouldShowAlert: true,
    };

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    const data = await res.json();
    if (data?.data?.status === "error") {
      console.warn("Push notification error:", data.data.message);
    }
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}