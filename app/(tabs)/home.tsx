import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { onDisconnect, onValue, ref, update } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../supabaseClient";
import { auth, db } from "../firebaseConfig";
import { registerForPushNotificationsAsync } from "../pushNotifications"; // <-- ADDED THIS IMPORT

// ── Font helpers ──────────────────────────────────────────────────────────────
const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const calculateDaysStrict = (startDateStr: string) => {
  if (!startDateStr) return 1;
  const [sY, sM, sD] = startDateStr.split("-").map(Number);
  const start = new Date(sY, sM - 1, sD, 12, 0, 0);
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
  );
  return (
    Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
};

const getWeatherInfo = (code: number, isDay: number) => {
  const night = isDay === 0;
  if (code <= 2)
    return night
      ? { icon: "moon-outline", label: "Clear" }
      : { icon: "sunny-outline", label: "Sunny" };
  if (code === 3 || (code >= 45 && code <= 48))
    return { icon: "cloud-outline", label: "Cloudy" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return { icon: "rainy-outline", label: "Rain" };
  if (code >= 95) return { icon: "thunderstorm-outline", label: "Storm" };
  return { icon: "cloud-outline", label: "Cloudy" };
};

// ── Sub-components ────────────────────────────────────────────────────────────
const Tag = ({
  label,
  color,
  filled,
}: {
  label: string;
  color: string;
  filled?: boolean;
}) => (
  <View
    style={{
      backgroundColor: filled ? color : "transparent",
      borderWidth: 1,
      borderColor: color,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: "flex-start",
    }}
  >
    <Text
      style={[
        mono,
        {
          fontSize: 14,
          color: filled ? "#FFFFFF" : color,
          letterSpacing: 0.2,
          textTransform: "uppercase",
          fontWeight: "bold",
        },
      ]}
    >
      {label}
    </Text>
  </View>
);

const StatBlock = ({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) => (
  <View
    style={{
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#EDE0E0",
      borderRadius: 8,
      padding: 14,
      justifyContent: "space-between",
      minHeight: 90,
    }}
  >
    <Text
      style={[mono, { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" }]}
    >
      {label}
    </Text>
    <View
      style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}
    >
      <Text
        style={[
          font("700"),
          { fontSize: 28, color, lineHeight: 30, letterSpacing: -0.5 },
        ]}
      >
        {(value || 0).toLocaleString()}
      </Text>
      <Text
        style={[
          mono,
          { fontSize: 14, color: "#8C6A6A", marginLeft: 6, marginBottom: 2 },
        ]}
      >
        {unit}
      </Text>
    </View>
  </View>
);

const ActionCard = ({
  action,
  onPress,
}: {
  action: any;
  onPress: () => void;
}) => {
  const colorMap: Record<string, string> = {
    "/record-mortality": "#C0392B",
    "/RecordFeeds": "#D35400",
    "/RecordVitamins": "#27AE60",
    RecordWeight: "#0E7490",
    "/PersonnelItems": "#2471A3",
    "/PersonnelRecords": "#7D3C98",
  };
  const ac = colorMap[action.route] || "#3B0A0A";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        width: "48%",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EDE0E0",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: ac,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          marginBottom: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${ac}18`,
        }}
      >
        <Ionicons name={action.icon} size={20} color={ac} />
      </View>
      <Text
        style={[
          font("700"),
          { fontSize: 15, letterSpacing: -0.2, color: "#1A0505" },
        ]}
      >
        {action.title}
      </Text>
      <Text
        style={[
          mono,
          { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A", marginTop: 4 },
        ]}
        numberOfLines={1}
      >
        {action.subtitle}
      </Text>
    </TouchableOpacity>
  );
};

// ── Insight Card ─────────────────────────────────────────────────────────────
const InsightCard = ({
  icon,
  color,
  title,
  description,
  btnText,
  onPress,
  isTechAlert,
}: {
  icon: any;
  color: string;
  title: string;
  description: string;
  btnText?: string;
  onPress?: () => void;
  isTechAlert?: boolean;
}) => (
  <View
    style={{
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#EDE0E0",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: color,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
          backgroundColor: `${color}18`,
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginRight: 8 }}>
        {isTechAlert && (
          <Text
            style={[
              mono,
              {
                fontSize: 13,
                letterSpacing: 0.2,
                color,
                textTransform: "uppercase",
                marginBottom: 3,
              },
            ]}
          >
            FROM TECHNICIAN
          </Text>
        )}
        <Text
          style={[
            font("700"),
            { fontSize: 14, color: "#1A0505", marginBottom: 3 },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[mono, { fontSize: 14, color: "#8C6A6A", lineHeight: 20 }]}
        >
          {description}
        </Text>
      </View>
      {btnText && onPress && (
        <TouchableOpacity
          onPress={onPress}
          style={{
            backgroundColor: "#FAF7F7",
            borderWidth: 1,
            borderColor: "#EDE0E0",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Text
            style={[
              mono,
              {
                fontSize: 14,
                letterSpacing: 0.2,
                color: "#3B0A0A",
                fontWeight: "bold",
              },
            ]}
          >
            {btnText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ── Main Component ────────────────────────────────────────────────────────────
const Home = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [assignedPen, setAssignedPen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [rawBatches, setRawBatches] = useState<any>(null);
  // ── NEW: store the full alert object so we can read its batchDay field
  const [techAlertObj, setTechAlertObj] = useState<any>(null);
  const [insightsOpen, setInsightsOpen] = useState(true);

  const [weather, setWeather] = useState({
    temp: "--",
    icon: "sunny-outline",
    label: "Sunny",
    isDay: 1,
  });

  const personnelActions = [
    {
      id: 1,
      title: "Mortality",
      subtitle: "Log dead",
      icon: "skull",
      route: "/record-mortality",
    },
    {
      id: 2,
      title: "Feeds",
      subtitle: "Log intake",
      icon: "nutrition",
      route: "/RecordFeeds",
    },
    {
      id: 3,
      title: "Vitamins",
      subtitle: "Log usage",
      icon: "flask",
      route: "/RecordVitamins",
    },
    {
      id: 4,
      title: "Weight",
      subtitle: "Log growth",
      icon: "bar-chart",
      route: "RecordWeight",
    },
    {
      id: 5,
      title: "Inventory",
      subtitle: "Manage items",
      icon: "layers",
      route: "/PersonnelItems",
    },
    {
      id: 6,
      title: "Activity Log",
      subtitle: "History trail",
      icon: "time",
      route: "/PersonnelRecords",
    },
  ];

  // Fetch Current User & Register for Push Notifications
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    update(userRef, { status: "online" });
    onDisconnect(userRef).update({ status: "offline" });
    const unsubUser = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setFirstName(d.firstName || "Personnel");
        setProfileImage(d.profilePicture || null);
        setAssignedPen(d.assignedPen || null);
      }
    });

    // --- NEW PUSH NOTIFICATION CODE ---
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        update(userRef, { pushToken: token });
      }
    });
    // ----------------------------------

    return () => unsubUser();
  }, []);

  // Fetch Weather
  useEffect(() => {
    const unsubWeather = onValue(ref(db, "current_weather"), (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        const isDay = d.isDay !== undefined ? d.isDay : 1;
        const info = getWeatherInfo(d.weatherCode ?? 0, isDay);
        setWeather({
          temp: d.temperature ?? "--",
          icon: info.icon,
          label: info.label,
          isDay,
        });
      }
    });
    return () => unsubWeather();
  }, []);

  // Fetch Batches
  useEffect(() => {
    const unsubBatches = onValue(ref(db, "global_batches"), (snap) => {
      setRawBatches(snap.exists() ? snap.val() : {});
      setLoading(false);
    });
    return () => unsubBatches();
  }, []);

  // ── Listen for technician alert — store full object to read batchDay ────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubUsers = onValue(ref(db, "users"), (snap) => {
      if (!snap.exists()) return;
      const all = snap.val();
      const techEntry = Object.entries(all).find(([, u]: any) => {
        const role = (u?.role || "").toLowerCase();
        return role === "user" || role === "tech" || role === "technician";
      });
      if (!techEntry) return;

      const techUid = techEntry[0];
      const chatId = [user.uid, techUid].sort().join("_");

      const unsubChat = onValue(ref(db, `chats/${chatId}`), (chatSnap) => {
        if (!chatSnap.exists()) return;
        const messages = chatSnap.val();

        // Find the latest unread isAlert message
        let latest: any = null;
        Object.values(messages).forEach((msg: any) => {
          if (msg?.isAlert === true && !msg?.seen) {
            if (!latest || msg.timestamp > latest.timestamp) {
              latest = msg;
            }
          }
        });

        // Store the full object (text + batchDay)
        setTechAlertObj(latest || null);
      });

      return () => unsubChat();
    });

    return () => unsubUsers();
  }, []);

  // Batch data engine
  const batchData = useMemo(() => {
    if (rawBatches === null) return null;
    try {
      const activeBatch = Object.values(rawBatches).find(
        (b: any) =>
          b && b.status && String(b.status).toLowerCase() === "active",
      ) as any;
      if (!activeBatch) return false;

      const currentDay = calculateDaysStrict(activeBatch.dateCreated);
      const startTs = new Date(activeBatch.dateCreated || Date.now()).getTime();
      const harvestTs = new Date(
        activeBatch.expectedCompleteDate || Date.now(),
      ).getTime();
      const totalDaysCount = Math.max(
        1,
        Math.ceil((harvestTs - startTs) / (1000 * 60 * 60 * 24)),
      );
      const progressPercent = Math.min(
        100,
        Math.max(0, Math.round(((currentDay - 1) / totalDaysCount) * 100)),
      );

      let globalMortality = 0;
      if (activeBatch.mortality_logs) {
        Object.values(activeBatch.mortality_logs).forEach((penLogs: any) => {
          Object.values(penLogs || {}).forEach((log: any) => {
            if (log.status === "approved")
              globalMortality += Number(log.am || 0) + Number(log.pm || 0);
          });
        });
      }

      const startingPop = Number(activeBatch.startingPopulation) || 0;
      const penCount = Number(activeBatch.penCount) || 5;
      let myPenCount = Math.floor(startingPop / penCount);
      let myPenMortality = 0;

      let amMortalityLogged = false,
        pmMortalityLogged = false;
      let amFeedsLogged = false,
        pmFeedsLogged = false;
      let amVitaminsLogged = false,
        pmVitaminsLogged = false;
      let todayWeightLogged = false;

      const now = new Date();
      const isToday = (log: any) => {
        const d = new Date(log.timestamp || log.dateLabel || log.date);
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      };

      if (assignedPen) {
        const keys = [
          assignedPen,
          assignedPen.toLowerCase(),
          assignedPen.replace(" ", "_").toLowerCase(),
        ];
        if (activeBatch.pen_populations) {
          keys.forEach((k) => {
            if (activeBatch.pen_populations[k] !== undefined)
              myPenCount = activeBatch.pen_populations[k];
          });
        }
        if (activeBatch.mortality_logs) {
          keys.forEach((k) => {
            if (activeBatch.mortality_logs[k]) {
              Object.values(activeBatch.mortality_logs[k]).forEach(
                (log: any) => {
                  if (isToday(log)) {
                    if (log.ua_am !== undefined || log.am !== undefined)
                      amMortalityLogged = true;
                    if (log.ua_pm !== undefined || log.pm !== undefined)
                      pmMortalityLogged = true;
                  }
                  if (log.status === "approved")
                    myPenMortality += Number(log.am || 0) + Number(log.pm || 0);
                },
              );
            }
          });
        }
        if (activeBatch.feed_logs) {
          keys.forEach((k) => {
            if (activeBatch.feed_logs[k]) {
              Object.values(activeBatch.feed_logs[k]).forEach((log: any) => {
                if (isToday(log)) {
                  if (log.ua_am !== undefined || log.am !== undefined)
                    amFeedsLogged = true;
                  if (log.ua_pm !== undefined || log.pm !== undefined)
                    pmFeedsLogged = true;
                }
              });
            }
          });
        }
        const vLogs =
          activeBatch.vitamin_logs || activeBatch.daily_vitamin_logs;
        if (vLogs) {
          keys.forEach((k) => {
            if (vLogs[k]) {
              Object.values(vLogs[k]).forEach((log: any) => {
                if (isToday(log)) {
                  if (
                    log.ua_am !== undefined ||
                    log.am !== undefined ||
                    log.water_am !== undefined
                  )
                    amVitaminsLogged = true;
                  if (
                    log.ua_pm !== undefined ||
                    log.pm !== undefined ||
                    log.water_pm !== undefined
                  )
                    pmVitaminsLogged = true;
                }
              });
            }
          });
        }
        if (activeBatch.weight_logs) {
          keys.forEach((k) => {
            if (activeBatch.weight_logs[k]) {
              Object.values(activeBatch.weight_logs[k]).forEach((log: any) => {
                if (isToday(log)) todayWeightLogged = true;
              });
            }
          });
        }
      }

      return {
        name: activeBatch.batchName || "Unnamed Batch",
        day: currentDay || 1,
        totalDays: totalDaysCount || 30,
        progress: progressPercent || 0,
        harvestDate: activeBatch.expectedCompleteDate
          ? new Date(activeBatch.expectedCompleteDate).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )
          : "N/A",
        myPenStats: {
          count: Math.max(0, myPenCount - myPenMortality),
          mortality: myPenMortality,
          amMortalityLogged,
          pmMortalityLogged,
          amFeedsLogged,
          pmFeedsLogged,
          amVitaminsLogged,
          pmVitaminsLogged,
          todayWeightLogged,
        },
      };
    } catch (e) {
      return false;
    }
  }, [rawBatches, assignedPen]);

  // ── Smart Insights ───────────────────────────────────────────────────────────
  const actionableInsights = useMemo(() => {
    if (!batchData || !batchData.myPenStats || !assignedPen) return [];

    const currentDay = (batchData as any).day as number;
    const insights: any[] = [];
    const currentHour = new Date().getHours();
    const showAMShift = currentHour >= 6;
    const showPMShift = currentHour >= 13;

    // 0. Tech alert
    if (techAlertObj) {
      const alertTs = techAlertObj.timestamp;
      const sentDate = alertTs ? new Date(alertTs) : null;
      const todayDate = new Date();
      const sentToday =
        sentDate &&
        sentDate.getDate() === todayDate.getDate() &&
        sentDate.getMonth() === todayDate.getMonth() &&
        sentDate.getFullYear() === todayDate.getFullYear();
      if (sentToday) {
        insights.push({
          id: "tech-alert",
          icon: "megaphone",
          color: "#C0392B",
          title: `Day ${currentDay} — Message from Technician`,
          description:
            techAlertObj.text?.replace(/^📢\s*/, "") || techAlertObj.text,
          isTechAlert: true,
        });
      }
    }

    // 1. Missing AM logs
    if (showAMShift) {
      if (!batchData.myPenStats.amMortalityLogged)
        insights.push({
          id: "am-mortality",
          icon: "skull",
          color: "#C0392B",
          title: `Day ${currentDay} — Morning Mortality`,
          description: `You haven't recorded the AM mortality check for ${assignedPen}.`,
          btnText: "RECORD",
          route: "/record-mortality",
        });
      if (!batchData.myPenStats.amFeedsLogged)
        insights.push({
          id: "am-feeds",
          icon: "nutrition",
          color: "#D35400",
          title: `Day ${currentDay} — Morning Feeds`,
          description: `You haven't recorded the AM feed usage for ${assignedPen}.`,
          btnText: "RECORD",
          route: "/RecordFeeds",
        });
      if (!batchData.myPenStats.amVitaminsLogged)
        insights.push({
          id: "am-vitamins",
          icon: "flask",
          color: "#27AE60",
          title: `Day ${currentDay} — Morning Vitamins`,
          description: `You haven't recorded AM vitamins or water for ${assignedPen}.`,
          btnText: "RECORD",
          route: "/RecordVitamins",
        });
    }

    // 2. Missing PM logs
    if (showPMShift) {
      if (!batchData.myPenStats.pmMortalityLogged)
        insights.push({
          id: "pm-mortality",
          icon: "skull",
          color: "#C0392B",
          title: `Day ${currentDay} — Afternoon Mortality`,
          description: `You haven't recorded the PM mortality check for ${assignedPen}.`,
          btnText: "RECORD",
          route: "/record-mortality",
        });
      if (!batchData.myPenStats.pmFeedsLogged)
        insights.push({
          id: "pm-feeds",
          icon: "nutrition",
          color: "#D35400",
          title: `Day ${currentDay} — Afternoon Feeds`,
          description: `You haven't recorded the PM feed usage for ${assignedPen}.`,
          btnText: "RECORD",
          route: "/RecordFeeds",
        });
      if (!batchData.myPenStats.pmVitaminsLogged)
        insights.push({
          id: "pm-vitamins",
          icon: "flask",
          color: "#27AE60",
          title: `Day ${currentDay} — Afternoon Vitamins`,
          description: `You haven't recorded PM vitamins or water for ${assignedPen}.`,
          btnText: "RECORD",
          route: "/RecordVitamins",
        });
    }

    // 3. Scheduled weighing day
    if (
      batchData.day > 0 &&
      batchData.day % 3 === 0 &&
      batchData.day <= 30 &&
      !batchData.myPenStats.todayWeightLogged
    ) {
      insights.push({
        id: "missing-weight",
        icon: "scale",
        color: "#0E7490",
        title: `Day ${currentDay} — Scheduled Weighing`,
        description:
          "Today is a scheduled weighing day. Please record the average sample weight.",
        btnText: "WEIGH",
        route: "RecordWeight",
      });
    }

    // 4. High pen mortality
    const startPop =
      batchData.myPenStats.count + batchData.myPenStats.mortality;
    if (startPop > 0) {
      const mortalityRate = (batchData.myPenStats.mortality / startPop) * 100;
      if (mortalityRate > 5)
        insights.push({
          id: "health-mort-high",
          icon: "alert-circle",
          color: "#C0392B",
          title: `Day ${currentDay} — High Pen Mortality (${mortalityRate.toFixed(1)}%)`,
          description: `Your assigned pen has lost ${batchData.myPenStats.mortality} birds. Notify the technician immediately.`,
        });
    }

    // 5. Weather
    const T = Number(weather.temp) || 0;
    const isRainy =
      weather.icon === "rainy-outline" ||
      weather.icon === "thunderstorm-outline";

    if (T >= 35) {
      insights.push({
        id: "weather-danger",
        icon: "alert-circle",
        color: "#C0392B",
        title: `Day ${currentDay} — ${T}°C Danger Heat Level`,
        description: `Increase water frequency immediately, add electrolytes, and maximize ventilation. Watch for panting and wing-drooping.`,
      });
    } else if (T >= 32) {
      insights.push({
        id: "weather-warning",
        icon: "warning",
        color: "#D35400",
        title: `Day ${currentDay} — ${T}°C Heat Stress Likely`,
        description: `Add electrolytes to water now. Increase watering frequency and check pen ventilation.`,
      });
    } else if (isRainy) {
      insights.push({
        id: "weather-rain",
        icon: "rainy",
        color: "#2471A3",
        title: `Day ${currentDay} — Rain Detected`,
        description: `Keep an eye on litter moisture. Make sure pen roofs and drainage channels are clear to prevent ammonia buildup.`,
      });
    } else {
      insights.push({
        id: "weather-good",
        icon: weather.icon === "sunny-outline" ? "sunny" : "partly-sunny",
        color: "#27AE60",
        title: `Day ${currentDay} — ${T}°C Comfortable Conditions`,
        description: `Conditions are ideal. Normal feeding and watering schedule is fine. Keep up the good work.`,
      });
    }

    return insights;
  }, [batchData, weather, assignedPen, techAlertObj]);

  const uploadProfileImage = async () => {
    try {
      setShowProfileModal(false);
      setUploading(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled) return setUploading(false);
      const response = await fetch(res.assets[0].uri);
      const arrayBuffer = await response.arrayBuffer();
      const user = auth.currentUser;
      const fileName = `${user?.uid}_${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await update(ref(db, `users/${user?.uid}`), {
        profilePicture: data.publicUrl,
      });
      Alert.alert("Success", "Profile photo updated!");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    const user = auth.currentUser;
    if (user) await update(ref(db, `users/${user.uid}`), { status: "offline" });
    await signOut(auth);
    router.replace("/");
  };

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <ActivityIndicator size="large" color="#3B0A0A" />
      </View>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 40,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#EDE0E0",
          }}
        >
          <View>
            <Text
              style={[
                mono,
                {
                  fontSize: 14,
                  letterSpacing: 0.2,
                  color: "#7A3030",
                  marginBottom: 4,
                },
              ]}
            >
              PERSONNEL / DASHBOARD
            </Text>
            <Text
              style={[
                font("700"),
                { fontSize: 24, letterSpacing: -0.3, color: "#1A0505" },
              ]}
            >
              {firstName}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: "#EDE0E0",
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: "#FAF7F7",
              }}
            >
              <Ionicons name={weather.icon as any} size={16} color="#3B0A0A" />
              <View>
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 13,
                      letterSpacing: 0.2,
                      textTransform: "uppercase",
                      color: "#8C6A6A",
                    },
                  ]}
                >
                  {weather.label}
                </Text>
                <Text
                  style={[
                    font("700"),
                    { fontSize: 14, letterSpacing: -0.3, color: "#3B0A0A" },
                  ]}
                >
                  {weather.temp}°C
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowProfileModal(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: "#3B0A0A",
                overflow: "hidden",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#FAF7F7",
              }}
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <Text style={[font("700"), { fontSize: 18, color: "#3B0A0A" }]}>
                  {firstName?.[0]}
                </Text>
              )}
              {uploading && (
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {batchData ? (
            <>
              {/* ── ACTIVE BATCH BANNER ───────────────────────────────────── */}
              <View
                style={{
                  backgroundColor: "#3B0A0A",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 24,
                }}
              >
                <View
                  style={{
                    height: 4,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                />
                <View style={{ padding: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 20,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "rgba(255,255,255,0.15)",
                          alignSelf: "flex-start",
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 4,
                          marginBottom: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: "#4ade80",
                            marginRight: 8,
                          }}
                        />
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 14,
                              letterSpacing: 0.2,
                              color: "#FFFFFF",
                            },
                          ]}
                        >
                          ACTIVE BATCH
                        </Text>
                      </View>
                      <Text
                        style={[
                          font("700"),
                          {
                            fontSize: 24,
                            letterSpacing: -0.3,
                            lineHeight: 28,
                            color: "#FFFFFF",
                          },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {(batchData as any).name}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        alignItems: "center",
                        minWidth: 70,
                      }}
                    >
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 13,
                            letterSpacing: 0.2,
                            color: "#7A3030",
                          },
                        ]}
                      >
                        DAY
                      </Text>
                      <Text
                        style={[
                          font("700"),
                          { fontSize: 32, lineHeight: 34, color: "#3B0A0A" },
                        ]}
                      >
                        {(batchData as any).day}
                      </Text>
                      <Text style={[mono, { fontSize: 14, color: "#7A3030" }]}>
                        / {(batchData as any).totalDays}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginBottom: 4 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={[
                          mono,
                          { fontSize: 14, color: "rgba(255,255,255,0.7)" },
                        ]}
                      >
                        PROGRESS
                      </Text>
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 14,
                            fontWeight: "bold",
                            color: "#FFFFFF",
                          },
                        ]}
                      >
                        {(batchData as any).progress}%
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 6,
                        backgroundColor: "rgba(255,255,255,0.2)",
                        borderRadius: 3,
                      }}
                    >
                      <View
                        style={{
                          height: "100%",
                          width: `${(batchData as any).progress}%`,
                          backgroundColor: "#FFFFFF",
                          borderRadius: 3,
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* ── ACTIONABLE INSIGHTS ────────────────────────────────────── */}
              {actionableInsights.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <TouchableOpacity
                    onPress={() => setInsightsOpen((o) => !o)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: insightsOpen ? 16 : 0,
                    }}
                  >
                    <Text
                      style={[
                        mono,
                        { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                      ]}
                    >
                      ACTIONABLE INSIGHTS
                    </Text>
                    {actionableInsights.filter((i) => i.color === "#C0392B")
                      .length > 0 && (
                      <View
                        style={{
                          marginLeft: 8,
                          backgroundColor: "#C0392B",
                          borderRadius: 10,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 13,
                              color: "#FFFFFF",
                              letterSpacing: 0.5,
                            },
                          ]}
                        >
                          {
                            actionableInsights.filter(
                              (i) => i.color === "#C0392B",
                            ).length
                          }
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: "#EDE0E0",
                        marginLeft: 8,
                      }}
                    />
                    <Ionicons
                      name={insightsOpen ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#8C6A6A"
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>

                  {insightsOpen &&
                    actionableInsights.map((insight) => (
                      <InsightCard
                        key={insight.id}
                        icon={insight.icon}
                        color={insight.color}
                        title={insight.title}
                        description={insight.description}
                        btnText={insight.btnText}
                        isTechAlert={insight.isTechAlert}
                        onPress={
                          insight.route
                            ? () => router.push(insight.route as any)
                            : undefined
                        }
                      />
                    ))}
                </View>
              )}

              {/* ── MY PEN SECTION ─────────────────────────────────────────── */}
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={[
                      mono,
                      { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                    ]}
                  >
                    MY PEN OVERVIEW
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: "#EDE0E0",
                      marginLeft: 8,
                    }}
                  />
                </View>
                <View
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#EDE0E0",
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <View style={{ height: 4, backgroundColor: "#3B0A0A" }} />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 16,
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          backgroundColor: "#F5EDED",
                          borderWidth: 1,
                          borderColor: "#EDE0E0",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 16,
                        }}
                      >
                        <Ionicons
                          name="home-outline"
                          size={22}
                          color="#3B0A0A"
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 14,
                              letterSpacing: 0.2,
                              color: "#8C6A6A",
                              marginBottom: 4,
                            },
                          ]}
                        >
                          ASSIGNED PEN
                        </Text>
                        <Text
                          style={[
                            font("700"),
                            { fontSize: 20, color: "#1A0505" },
                          ]}
                        >
                          {assignedPen ?? "Unassigned"}
                        </Text>
                      </View>
                    </View>
                    {assignedPen ? (
                      <Tag label="Live" color="#27AE60" filled />
                    ) : (
                      <Tag label="Vacant" color="#D4B8B8" filled />
                    )}
                  </View>
                </View>
                {assignedPen && (
                  <View
                    style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                  >
                    <StatBlock
                      label="Live Pop."
                      value={(batchData as any).myPenStats.count}
                      unit="hd"
                      color="#0E7490"
                    />
                    <StatBlock
                      label="Mortality"
                      value={(batchData as any).myPenStats.mortality}
                      unit="hd"
                      color="#C0392B"
                    />
                  </View>
                )}
              </View>

              {/* ── MANAGEMENT TOOLS ─────────────────────────────────────── */}
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={[
                      mono,
                      { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                    ]}
                  >
                    MANAGEMENT TOOLS
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: "#EDE0E0",
                      marginLeft: 8,
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                  }}
                >
                  {personnelActions.map((a) => (
                    <ActionCard
                      key={a.id}
                      action={a}
                      onPress={() => router.push(a.route as any)}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#EDE0E0",
                borderRadius: 12,
                padding: 40,
                alignItems: "center",
                backgroundColor: "#FAF7F7",
                marginBottom: 24,
              }}
            >
              <Ionicons name="folder-open-outline" size={48} color="#D4B8B8" />
              <Text
                style={[
                  mono,
                  {
                    fontSize: 14,
                    letterSpacing: 0.2,
                    color: "#8C6A6A",
                    marginTop: 16,
                  },
                ]}
              >
                NO ACTIVE BATCH
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── PROFILE MODAL ──────────────────────────────────────────────────── */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <View
            style={{
              position: "absolute",
              top: 90,
              right: 20,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EDE0E0",
              borderRadius: 12,
              overflow: "hidden",
              width: 192,
            }}
          >
            <TouchableOpacity
              onPress={uploadProfileImage}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#EDE0E0",
              }}
            >
              <Ionicons name="camera-outline" size={18} color="#1A0505" />
              <Text
                style={[
                  font("600"),
                  { fontSize: 14, color: "#1A0505", marginLeft: 12 },
                ]}
              >
                Change Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowProfileModal(false);
                router.push("/PersonnelProfile");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#EDE0E0",
              }}
            >
              <Ionicons name="person-outline" size={18} color="#1A0505" />
              <Text
                style={[
                  font("600"),
                  { fontSize: 14, color: "#1A0505", marginLeft: 12 },
                ]}
              >
                Edit Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowProfileModal(false);
                setShowLogoutModal(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#C0392B" />
              <Text
                style={[
                  font("600"),
                  { fontSize: 14, color: "#C0392B", marginLeft: 12 },
                ]}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── LOGOUT MODAL ───────────────────────────────────────────────────── */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EDE0E0",
              borderRadius: 12,
              width: "100%",
              maxWidth: 384,
              overflow: "hidden",
            }}
          >
            <View style={{ height: 4, backgroundColor: "#3B0A0A" }} />
            <View style={{ padding: 32, alignItems: "center" }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  backgroundColor: "#F5EDED",
                  borderWidth: 1,
                  borderColor: "rgba(59,10,10,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Ionicons name="log-out-outline" size={28} color="#3B0A0A" />
              </View>
              <Text
                style={[
                  font("700"),
                  { fontSize: 20, color: "#1A0505", marginBottom: 8 },
                ]}
              >
                Sign Out?
              </Text>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 14,
                    textAlign: "center",
                    color: "#8C6A6A",
                    marginBottom: 32,
                  },
                ]}
              >
                You will need to authenticate again to access your dashboard.
              </Text>
              <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                <TouchableOpacity
                  onPress={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderWidth: 1,
                    borderColor: "#EDE0E0",
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={[mono, { fontSize: 14, color: "#8C6A6A" }]}>
                    CANCEL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLogout}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    backgroundColor: "#3B0A0A",
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={[mono, { fontSize: 14, color: "#FFFFFF" }]}>
                    SIGN OUT
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
