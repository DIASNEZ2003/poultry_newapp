import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller"; // <-- 1. Import the provider
import "./global.css";

export default function RootLayout() {
  useEffect(() => {
    // This listener handles the notification being tapped by the user
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped:", data);
        // You can add navigation logic here if needed
      },
    );

    return () => subscription.remove();
  }, []);

  return (
    <KeyboardProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </KeyboardProvider>
  );
}
