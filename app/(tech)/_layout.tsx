import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { auth, db } from "../firebaseConfig";

export default function TabLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const chatRef = ref(db, `chats/${user.uid}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const count = Object.values(data).filter(
          (msg: any) => msg.sender === "admin" && msg.seen !== true,
        ).length;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    });
    return () => unsubscribe();
  }, []);

  const TAB_HEIGHT = Platform.OS === "ios" ? 80 : 60;
  const PADDING_BOTTOM = Platform.OS === "ios" ? 20 : 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#7f1d1d",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true, // This works perfectly on Android now!
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "bold",
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          // REMOVED: position: "absolute", bottom, left, right.
          // Leaving it relative fixes the Android Keyboard bug!
          height: TAB_HEIGHT,
          paddingBottom: PADDING_BOTTOM,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 5,
          elevation: 5,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="techhome"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="techMesenger"
        options={{
          title: "Messenger",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#ef4444",
            color: "white",
            fontSize: 10,
            lineHeight: 15,
          },
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-ellipses" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="penAssignment"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
