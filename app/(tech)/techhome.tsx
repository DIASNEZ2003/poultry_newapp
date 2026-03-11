import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../supabaseClient";
import { auth, db } from "../firebaseConfig";

// ── Font helpers ──────────────────────────────────────────────────────────────
const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
// mono now uses system font for readability
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
      ? { icon: "moon-outline", label: "Clear Night" }
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
      borderRadius: 2,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    }}
  >
    <Text
      style={[
        mono,
        {
          fontSize: 14,
          color: filled ? "#FFFFFF" : color,
          letterSpacing: 0.3,
          textTransform: "uppercase",
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
    className="flex-1 bg-white border border-[#EDE0E0] rounded p-3.5 justify-between"
    style={{ minHeight: 80 }}
  >
    <Text
      style={[mono, { fontSize: 13, letterSpacing: 0 }]}
      className="text-[#8C6A6A]"
    >
      {label}
    </Text>
    <View className="flex-row items-end mt-1.5">
      <Text
        style={[
          font("700"),
          { fontSize: 26, color, lineHeight: 28, letterSpacing: -0.3 },
        ]}
      >
        {(value || 0).toLocaleString()}
      </Text>
      <Text
        style={[mono, { fontSize: 13 }]}
        className="text-[#8C6A6A] ml-1 mb-1"
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
    "/penAssignment": "#2471A3",
    "/approve": "#D35400",
    "/Approvesub": "#27AE60",
    "/TechnicianRecords": "#7D3C98",
    profileModal: "#0E7490",
  };
  const ac = colorMap[action.route] || "#3B0A0A";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="w-[48%] bg-white border border-[#EDE0E0] rounded p-4 mb-2"
      style={{ borderLeftWidth: 2, borderLeftColor: ac }}
    >
      <View
        className="w-9 h-9 rounded mb-3.5 items-center justify-center"
        style={{ backgroundColor: `${ac}18` }}
      >
        <Ionicons name={action.icon} size={18} color={ac} />
      </View>
      <Text
        style={[font("700"), { fontSize: 15, letterSpacing: -0.2 }]}
        className="text-[#1A0505]"
      >
        {action.title}
      </Text>
      <Text
        style={[mono, { fontSize: 14, letterSpacing: 0.3 }]}
        className="text-[#8C6A6A] mt-0.5"
        numberOfLines={1}
      >
        {action.subtitle}
      </Text>
    </TouchableOpacity>
  );
};

// ── MINIMALIST INSIGHT CARD COMPONENT ─────────────────────────────────────────
const InsightCard = ({
  icon,
  color,
  title,
  description,
  btnText,
  onPress,
  isNotifyPersonnel,
  onNotifyPersonnel,
  notifyPersonnelSent,
}: {
  icon: any;
  color: string;
  title: string;
  description: string;
  btnText?: string;
  onPress?: () => void;
  isNotifyPersonnel?: boolean;
  onNotifyPersonnel?: () => void;
  notifyPersonnelSent?: boolean;
}) => (
  <View
    className="bg-white border border-[#EDE0E0] rounded p-3.5 mb-2.5"
    style={{ borderLeftWidth: 3, borderLeftColor: color }}
  >
    {/* Top row: icon + text + optional action button */}
    <View className="flex-row items-center">
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: `${color}15` }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1 mr-2">
        <Text
          style={[
            font("700"),
            { fontSize: 15, color: "#1A0505", marginBottom: 3 },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            font("400"),
            { fontSize: 14, color: "#6B5050", lineHeight: 20 },
          ]}
        >
          {description}
        </Text>
      </View>
      {btnText && onPress && (
        <TouchableOpacity
          onPress={onPress}
          className="bg-[#FAF7F7] border border-[#EDE0E0] px-3 py-1.5 rounded"
        >
          <Text style={[font("700"), { fontSize: 13, color: "#3B0A0A" }]}>
            {btnText}
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {/* Notify Personnel — full-width button at bottom of alert cards */}
    {isNotifyPersonnel && onNotifyPersonnel && (
      <TouchableOpacity
        onPress={onNotifyPersonnel}
        disabled={notifyPersonnelSent}
        style={{
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 11,
          borderRadius: 8,
          backgroundColor: notifyPersonnelSent ? "#D5F5E3" : "#3B0A0A",
          borderWidth: 1,
          borderColor: notifyPersonnelSent ? "#A9DFBF" : "#3B0A0A",
        }}
      >
        <Ionicons
          name={notifyPersonnelSent ? "checkmark-circle" : "megaphone-outline"}
          size={15}
          color={notifyPersonnelSent ? "#27AE60" : "#FFFFFF"}
        />
        <Text
          style={[
            font("700"),
            {
              fontSize: 13,
              color: notifyPersonnelSent ? "#27AE60" : "#FFFFFF",
            },
          ]}
        >
          {notifyPersonnelSent ? "Personnel Notified" : "Notify Personnel"}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

const PenCard = ({ pen }: { pen: any }) => {
  const pct =
    pen.count > 0 ? Math.min((pen.count / (pen.capacity || 1)) * 100, 100) : 0;
  const statColors = ["#C0392B", "#D35400", "#27AE60"];
  return (
    <View className="bg-white border border-[#EDE0E0] rounded overflow-hidden mb-2.5">
      <View className="flex-row items-center justify-between p-3.5 border-b border-[#EDE0E0]">
        <View className="flex-row items-center">
          <Text
            style={[
              font("700"),
              { fontSize: 16, color: "#3B0A0A", letterSpacing: -0.3 },
            ]}
            className="mr-3"
          >
            P{String(pen.id).padStart(2, "0")}
          </Text>
          <Tag
            label={
              pen.personnelCount > 0
                ? `${pen.personnelCount} Assigned`
                : "Vacant"
            }
            color={pen.personnelCount > 0 ? "#27AE60" : "#D4B8B8"}
            filled={pen.personnelCount > 0}
          />
        </View>
        <View className="items-end">
          <Text
            style={[font("700"), { fontSize: 20, letterSpacing: -0.3 }]}
            className="text-[#1A0505]"
          >
            {(pen.count || 0).toLocaleString()}
          </Text>
          <Text
            style={[mono, { fontSize: 14, letterSpacing: 1 }]}
            className="text-[#8C6A6A]"
          >
            HEADS
          </Text>
        </View>
      </View>
      <View className="h-px bg-[#D4B8B8]">
        <View className="h-full bg-[#3B0A0A]" style={{ width: `${pct}%` }} />
      </View>
      <View className="flex-row">
        {pen.stats.map((stat: any, i: number) => (
          <View
            key={stat.name}
            className="flex-1 py-3 items-center"
            style={{
              borderRightWidth: i < 2 ? 1 : 0,
              borderRightColor: "#EDE0E0",
            }}
          >
            <Text
              style={[
                mono,
                {
                  fontSize: 13,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                },
              ]}
              className="text-[#8C6A6A] mb-1"
            >
              {stat.name}
            </Text>
            <Text style={[font("700"), { fontSize: 14, color: statColors[i] }]}>
              {(stat.value || 0).toLocaleString()}
              <Text style={[mono, { fontSize: 13 }]} className="text-[#8C6A6A]">
                {stat.unit}
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const TechHome = () => {
  const router = useRouter();

  // Dashboard states
  const [firstName, setFirstName] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showProfileMenuModal, setShowProfileMenuModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAllPens, setShowAllPens] = useState(false);

  // Edit Profile States
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [rawBatches, setRawBatches] = useState<any>(null);
  const [rawUsers, setRawUsers] = useState<any>(null);

  // Admin alert & notify personnel
  const [adminAlert, setAdminAlert] = useState<any>(null);
  const [notifyPersonnelSent, setNotifyPersonnelSent] = useState<
    Record<string, boolean>
  >({});

  const [weather, setWeather] = useState({
    temp: "--",
    icon: "sunny-outline",
    label: "Sunny",
    isDay: 1,
  });

  const techActions = [
    {
      id: 1,
      title: "Pen Assign",
      subtitle: "Personnel",
      icon: "grid",
      route: "/penAssignment",
    },
    {
      id: 2,
      title: "Daily Records",
      subtitle: "View & Edit",
      icon: "document-text",
      route: "/approve",
    },
    {
      id: 3,
      title: "Approve",
      subtitle: "Submissions",
      icon: "checkmark-done-circle",
      route: "/Approvesub",
    },
    {
      id: 4,
      title: "Activity Log",
      subtitle: "History Track",
      icon: "time",
      route: "/TechnicianRecords",
    },
  ];

  // Fetch Current User
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      update(userRef, { status: "online" });
      onDisconnect(userRef).update({ status: "offline" });

      const unsubUser = onValue(userRef, (snap) => {
        if (snap.exists()) {
          const d = snap.val();
          setFirstName(d.firstName || "Technician");
          setProfileImage(d.profilePicture || null);
        }
      });
      return () => unsubUser();
    }
  }, []);

  // Load User Data specifically for the Edit Form
  const loadProfileForEdit = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snapshot = await get(ref(db, `users/${user.uid}`));
      if (snapshot.exists()) {
        const data = snapshot.val();
        setEditFirstName(data.firstName || "");
        setEditLastName(data.lastName || "");
      }
      setShowEditProfileModal(true);
    } catch (error) {
      Alert.alert("Error", "Failed to load profile data.");
    }
  };

  // Save the Edited Profile
  const handleSaveProfile = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert("Validation", "First name and last name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await update(ref(db, `users/${user.uid}`), {
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          fullName: `${editFirstName.trim()} ${editLastName.trim()}`,
        });
        Alert.alert("Success", "Profile updated successfully!");
        setShowEditProfileModal(false);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update profile.");
      console.error(error);
    } finally {
      setSavingProfile(false);
    }
  };

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

  // Listen for admin alert — shows as an insight card
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const chatRef = ref(db, `chats/${user.uid}`);
    const unsubChat = onValue(chatRef, (snap) => {
      if (!snap.exists()) return;
      const messages = snap.val();
      let latest: any = null;
      Object.entries(messages).forEach(([key, msg]: any) => {
        if (
          msg?.isAlert === true &&
          (!latest || msg.timestamp > latest.timestamp)
        ) {
          latest = { ...msg, key };
        }
      });
      if (latest) setAdminAlert(latest);
    });
    return () => unsubChat();
  }, []);

  // Send admin alert forward to all personnel
  const handleNotifyPersonnel = async (insightId: string, message: string) => {
    if (!rawUsers) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      const personnel = Object.entries(rawUsers).filter(([, u]: any) => {
        const role = (u?.role || "").toLowerCase();
        return role === "personnel" || role === "personel";
      });
      await Promise.all(
        personnel.map(async ([uid]: any) => {
          const chatId = [user.uid, uid].sort().join("_");
          const chatRef = ref(db, `chats/${chatId}`);
          const newMsgRef = push(chatRef);
          return set(newMsgRef, {
            sender: user.uid,
            senderUid: user.uid,
            text: message,
            timestamp: Date.now(),
            seen: false,
            status: "sent",
            isAlert: true,
          });
        }),
      );
      setNotifyPersonnelSent((prev) => ({ ...prev, [insightId]: true }));
    } catch (err) {
      Alert.alert("Error", "Failed to notify personnel.");
    }
  };

  // Fetch Batches & Users
  useEffect(() => {
    const unsubBatches = onValue(ref(db, "global_batches"), (snap) =>
      setRawBatches(snap.exists() ? snap.val() : {}),
    );
    const unsubUsers = onValue(ref(db, "users"), (snap) =>
      setRawUsers(snap.exists() ? snap.val() : {}),
    );

    return () => {
      unsubBatches();
      unsubUsers();
    };
  }, []);

  // Compute Batch Data & Insights
  const batchData = useMemo(() => {
    if (rawBatches === null || rawUsers === null) return null;

    try {
      const activeBatch = Object.values(rawBatches).find(
        (b: any) => b && String(b.status).toLowerCase() === "active",
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

      let totalMortality = 0,
        feedKilos = 0,
        vitaminGrams = 0,
        currentWeight = 0,
        qtyHarvested = 0,
        pendingRecordsCount = 0;

      // Define "Today" boundary for missing report tracking
      const startOfToday = new Date().setHours(0, 0, 0, 0);

      const checkPending = (logCategory: any) => {
        if (!logCategory) return;
        Object.values(logCategory).forEach((penLogs: any) => {
          Object.values(penLogs || {}).forEach((log: any) => {
            if (log.status === "pending") pendingRecordsCount++;
          });
        });
      };

      // Utility to check if a log was submitted today
      const checkLogForToday = (log: any, updateFlagFn: Function) => {
        if (log.timestamp && log.timestamp >= startOfToday) {
          updateFlagFn(true);
        } else if (log.dateLabel || log.date) {
          const dateStr = log.dateLabel || log.date;
          const logD = new Date(dateStr);
          const todayD = new Date();
          if (
            logD.getDate() === todayD.getDate() &&
            logD.getMonth() === todayD.getMonth() &&
            logD.getFullYear() === todayD.getFullYear()
          ) {
            updateFlagFn(true);
          }
        }
      };

      if (activeBatch.mortality_logs) {
        checkPending(activeBatch.mortality_logs);
      }
      if (activeBatch.feed_logs) {
        checkPending(activeBatch.feed_logs);
      }
      const vLogs = activeBatch.vitamin_logs || activeBatch.daily_vitamin_logs;
      if (vLogs) {
        checkPending(vLogs);
      }
      if (activeBatch.weight_logs) {
        checkPending(activeBatch.weight_logs);
      }

      if (activeBatch.sales) {
        Object.values(activeBatch.sales).forEach((sale: any) => {
          if (sale) qtyHarvested += Number(sale.quantity || 0);
        });
      }

      const startingPop = Number(activeBatch.startingPopulation) || 1000;
      let currentPop = Math.max(0, startingPop - totalMortality - qtyHarvested);
      const penCount = Number(activeBatch.penCount) || 5;
      const capacityPerPen = Math.ceil(startingPop / penCount);

      let unassignedPensCount = 0;

      const pens = Array.from({ length: penCount }, (_, i) => {
        const penIndex = i + 1;
        const keys = [
          `Pen ${penIndex}`,
          `pen ${penIndex}`,
          `Pen_${penIndex}`,
          `pen_${penIndex}`,
        ];

        let penMort = 0,
          penFeed = 0,
          penVit = 0;
        let hasReportToday = false;

        keys.forEach((key) => {
          if (activeBatch.mortality_logs?.[key])
            Object.values(activeBatch.mortality_logs[key]).forEach(
              (log: any) => {
                checkLogForToday(log, (val: boolean) => {
                  hasReportToday = val;
                });
                if (log.status === "approved") {
                  const m = Number(log.am || 0) + Number(log.pm || 0);
                  penMort += m;
                  totalMortality += m;
                }
              },
            );

          if (activeBatch.feed_logs?.[key])
            Object.values(activeBatch.feed_logs[key]).forEach((log: any) => {
              checkLogForToday(log, (val: boolean) => {
                hasReportToday = val;
              });
              if (log.status === "approved") {
                const f = Number(log.am || 0) + Number(log.pm || 0);
                penFeed += f;
                feedKilos += f;
              }
            });

          if (vLogs?.[key])
            Object.values(vLogs[key]).forEach((log: any) => {
              checkLogForToday(log, (val: boolean) => {
                hasReportToday = val;
              });
              if (log.status === "approved") {
                const v =
                  Number(log.am || log.am_amount || 0) +
                  Number(log.pm || log.pm_amount || 0);
                penVit += v;
                vitaminGrams += v;
              }
            });

          if (activeBatch.weight_logs?.[key]) {
            let maxD = -1;
            Object.values(activeBatch.weight_logs[key]).forEach((log: any) => {
              if (log.status === "approved") {
                const d = Number(log.batchDay || log.day || 0);
                if (d > maxD) {
                  maxD = d;
                  currentWeight = Number(log.averageWeight || 0);
                }
              }
            });
          }
        });

        let currentHeads;
        keys.forEach((key) => {
          if (activeBatch.pen_populations?.[key] !== undefined) {
            currentHeads = activeBatch.pen_populations[key];
          }
        });

        if (currentHeads === undefined) {
          currentHeads = Math.floor(startingPop / penCount) - penMort;
        }

        let assignedCount = 0;

        keys.forEach((key) => {
          const p = activeBatch.pens?.[key];
          if (p && (p.assignedTo || p.assignedName || p.personnel)) {
            assignedCount += 1;
          }
        });

        if (assignedCount === 0 && rawUsers) {
          Object.values(rawUsers).forEach((u: any) => {
            if (
              u?.assignedPen &&
              keys.some(
                (k) =>
                  String(k).toLowerCase() ===
                  String(u.assignedPen).toLowerCase(),
              )
            ) {
              assignedCount += 1;
            }
          });
        }

        if (assignedCount === 0) unassignedPensCount++;

        return {
          id: penIndex,
          count: Math.max(0, currentHeads),
          capacity: capacityPerPen || 1,
          personnelCount: assignedCount,
          hasReportToday,
          stats: [
            { name: "Mortality", value: penMort, unit: "hd" },
            { name: "Feeds", value: penFeed, unit: "kg" },
            { name: "Vitamins", value: penVit, unit: "g" },
          ],
        };
      });

      return {
        name: activeBatch.batchName || "Unnamed Batch",
        startingPopulation: startingPop,
        day: currentDay || 1,
        totalDays: totalDaysCount || 30,
        progress: progressPercent || 0,
        harvestDate: activeBatch.expectedCompleteDate
          ? new Date(activeBatch.expectedCompleteDate).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )
          : "N/A",
        pens,
        livePop: currentPop || 0,
        totalMortality: totalMortality || 0,
        totalFeed: feedKilos || 0,
        totalVitamins: vitaminGrams || 0,
        avgWeight: currentWeight || 0,
        unassignedPensCount,
        pendingRecordsCount,
      };
    } catch (e) {
      console.error("Critical error building batch data:", e);
      return false;
    }
  }, [rawBatches, rawUsers]);

  // Generate Array of Actionable Insights for the UI
  const actionableInsights = useMemo(() => {
    if (!batchData) return [];

    const insights: any[] = [];

    // 1. Missing Daily Reports Alert
    const missingPens = batchData.pens
      .filter((p: any) => !p.hasReportToday)
      .map((p: any) => p.id);
    if (missingPens.length > 0) {
      const penText =
        missingPens.length === 1
          ? `Pen ${missingPens[0]}`
          : `Pens ${missingPens.join(", ")}`;
      insights.push({
        id: "missing-reports",
        icon: "document-text-outline",
        color: "#D35400", // Orange warning
        title: "Missing Daily Reports",
        description: `${penText} did not send any reports today. Remind personnel to submit their logs.`,
        isNotifyPersonnel: true,
      });
    }

    // 2. Staffing Alert
    if (batchData.unassignedPensCount > 0) {
      insights.push({
        id: "unassigned-pens",
        icon: "alert-circle",
        color: "#D35400",
        title: "Unassigned Pens Detected",
        description: `${batchData.unassignedPensCount} pen(s) currently have no personnel assigned to them. Assign staff immediately.`,
        btnText: "Assign",
        route: "/penAssignment",
      });
    }

    // 3. Pending Records Alert
    if (batchData.pendingRecordsCount > 0) {
      insights.push({
        id: "pending-records",
        icon: "time",
        color: "#2471A3",
        title: "Unapproved Records Pending",
        description: `There are ${batchData.pendingRecordsCount} log submission(s) waiting for your review and approval.`,
        btnText: "Review",
        route: "/approve",
      });
    }

    // 4. Environmental / Weather Alert
    const T = Number(weather.temp) || 0;
    const isRainy =
      weather.icon === "rainy-outline" ||
      weather.icon === "thunderstorm-outline";

    if (T >= 35) {
      insights.push({
        id: "weather-danger",
        icon: "alert-circle",
        color: "#C0392B",
        title: `${T}°C — Danger Heat Level`,
        description: `Increase water frequency immediately, add electrolytes, and maximize ventilation. Watch for panting and wing-drooping.`,
      });
    } else if (T >= 32) {
      insights.push({
        id: "weather-warning",
        icon: "warning",
        color: "#D35400",
        title: `${T}°C — Heat Stress Likely`,
        description: `Add electrolytes to water now. Increase watering frequency and check pen ventilation.`,
      });
    } else if (isRainy) {
      insights.push({
        id: "weather-rain",
        icon: "rainy",
        color: "#2471A3",
        title: `Rain Detected — Check Pens`,
        description: `Keep an eye on litter moisture. Make sure pen roofs and drainage channels are clear to prevent ammonia buildup.`,
      });
    } else {
      insights.push({
        id: "weather-good",
        icon: "partly-sunny-outline",
        color: "#27AE60",
        title: `${T}°C — Comfortable Conditions`,
        description: `Conditions are ideal. Normal feeding and watering schedule is fine. Keep up the good work.`,
      });
    }

    // 5. Mortality Watch
    const mortalityRate =
      (batchData.totalMortality / batchData.startingPopulation) * 100;
    if (mortalityRate > 5) {
      insights.push({
        id: "health-mort-high",
        icon: "alert-circle",
        color: "#C0392B",
        title: `${batchData.totalMortality} birds lost (${mortalityRate.toFixed(1)}%)`,
        description: `Have the vet or technician check pen conditions and ventilation immediately.`,
      });
    } else if (mortalityRate > 2) {
      insights.push({
        id: "health-mort-watch",
        icon: "warning",
        color: "#D35400",
        title: `${batchData.totalMortality} birds lost so far (${mortalityRate.toFixed(1)}%)`,
        description: `Still within an acceptable range, but monitor daily to catch any potential health issues early.`,
      });
    }

    // 6. Harvest Watch
    if (batchData.day >= 26) {
      insights.push({
        id: "harvest-ready",
        icon: "calendar",
        color: "#27AE60",
        title: `Day ${batchData.day} — Prepare for Harvest`,
        description: `Contact buyers and arrange logistics to secure the best price for this batch.`,
      });
    }

    // 0. Admin alert pinned at top
    if (adminAlert) {
      insights.unshift({
        id: "admin-alert",
        icon: "alert-circle",
        color: "#C0392B",
        title: "Alert from Admin",
        description: adminAlert.text,
        isNotifyPersonnel: true,
      });
    }

    return insights;
  }, [batchData, weather, adminAlert]);

  const uploadProfileImage = async () => {
    try {
      setShowProfileMenuModal(false);
      setUploading(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled) {
        setUploading(false);
        return;
      }
      const response = await fetch(res.assets[0].uri);
      const arrayBuffer = await response.arrayBuffer();
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      const fileName = `${user.uid}_${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await update(ref(db, `users/${user.uid}`), {
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

  if (batchData === null) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
      </View>
    );
  }

  const displayedPens =
    batchData && batchData.pens
      ? showAllPens
        ? batchData.pens
        : batchData.pens.slice(0, 2)
      : [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
        <View className="flex-row justify-between items-center px-5 pt-10 pb-4 border-b border-[#EDE0E0]">
          <View>
            <Text
              style={[mono, { fontSize: 14, letterSpacing: 0.3 }]}
              className="text-[#7A3030] mb-0.5"
            >
              TECH / DASHBOARD
            </Text>
            <Text
              style={[font("700"), { fontSize: 24, letterSpacing: -0.5 }]}
              className="text-[#1A0505]"
            >
              {firstName}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            {/* Weather Mini-Badge */}
            <View className="flex-row items-center gap-1.5 border border-[#EDE0E0] rounded px-2.5 py-1.5 bg-[#FAF7F7]">
              <Ionicons name={weather.icon as any} size={16} color="#3B0A0A" />
              <View>
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 13,
                      letterSpacing: 0,
                      textTransform: "uppercase",
                    },
                  ]}
                  className="text-[#8C6A6A]"
                >
                  {weather.label}
                </Text>
                <Text
                  style={[font("700"), { fontSize: 13, letterSpacing: -0.3 }]}
                  className="text-[#3B0A0A]"
                >
                  {weather.temp}°C
                </Text>
              </View>
            </View>
            {/* Avatar */}
            <TouchableOpacity
              onPress={() => setShowProfileMenuModal(true)}
              className="w-10 h-10 rounded-full border border-[#3B0A0A] overflow-hidden justify-center items-center bg-[#FAF7F7]"
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  className="w-full h-full"
                />
              ) : (
                <Text
                  style={[font("700"), { fontSize: 16 }]}
                  className="text-[#3B0A0A]"
                >
                  {firstName?.[0]}
                </Text>
              )}
              {uploading && (
                <View className="absolute inset-0 bg-black/60 justify-center items-center">
                  <ActivityIndicator size="small" color="#3B0A0A" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 pt-5">
          {batchData !== false ? (
            <>
              {/* ── BATCH BANNER ─────────────────────────────────────────── */}
              <View
                style={{
                  backgroundColor: "#3B0A0A",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 20,
                }}
              >
                <View className="h-0.5 bg-white/20" />
                <View className="p-4">
                  <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center bg-white/15 self-start px-2 py-1 rounded mb-2.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-green-300 mr-1.5" />
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 14,
                              letterSpacing: 0.3,

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
                            fontSize: 22,
                            letterSpacing: -0.3,
                            lineHeight: 24,
                            color: "#FFFFFF",
                          },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {batchData.name}
                      </Text>
                    </View>
                    <View
                      className="bg-white rounded px-3.5 py-2.5 items-center"
                      style={{ minWidth: 60 }}
                    >
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 13,
                            letterSpacing: 0.3,
                            textTransform: "uppercase",
                          },
                        ]}
                        className="text-[#7A3030]"
                      >
                        DAY
                      </Text>
                      <Text
                        style={[
                          font("700"),
                          { fontSize: 26, lineHeight: 28, letterSpacing: -0.5 },
                        ]}
                        className="text-[#3B0A0A]"
                      >
                        {batchData.day}
                      </Text>
                      <Text
                        style={[mono, { fontSize: 13, letterSpacing: 1 }]}
                        className="text-[#7A3030]"
                      >
                        / {batchData.totalDays}
                      </Text>
                    </View>
                  </View>
                  <View className="mb-3.5">
                    <View className="flex-row justify-between mb-1.5">
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 14,
                            letterSpacing: 0.3,
                            color: "rgba(255,255,255,0.7)",
                          },
                        ]}
                      >
                        PROGRESS
                      </Text>
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 14,
                            letterSpacing: 0.3,
                            fontWeight: "bold",
                            color: "#FFFFFF",
                          },
                        ]}
                      >
                        {batchData.progress}%
                      </Text>
                    </View>
                    <View className="h-1 bg-white/20 rounded">
                      <View
                        className="h-full bg-white rounded"
                        style={{ width: `${batchData.progress}%` }}
                      />
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0.3,
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.7)",
                          marginLeft: 6,
                        },
                      ]}
                    >
                      Harvest: {batchData.harvestDate}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── ACTIONABLE INSIGHTS ────────────────────────────────────── */}
              {actionableInsights.length > 0 && (
                <View className="mb-5">
                  <View className="flex-row items-center mb-3.5">
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0,
                          textTransform: "uppercase",
                        },
                      ]}
                      className="text-[#8C6A6A]"
                    >
                      ACTIONABLE INSIGHTS
                    </Text>
                    <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                  </View>

                  {actionableInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      icon={insight.icon}
                      color={insight.color}
                      title={insight.title}
                      description={insight.description}
                      btnText={insight.btnText}
                      onPress={
                        insight.route
                          ? () => router.push(insight.route as any)
                          : undefined
                      }
                      isNotifyPersonnel={insight.isNotifyPersonnel}
                      onNotifyPersonnel={
                        insight.isNotifyPersonnel
                          ? () =>
                              handleNotifyPersonnel(
                                insight.id,
                                insight.description,
                              )
                          : undefined
                      }
                      notifyPersonnelSent={
                        insight.isNotifyPersonnel
                          ? !!notifyPersonnelSent[insight.id]
                          : false
                      }
                    />
                  ))}
                </View>
              )}

              {/* ── MANAGEMENT TOOLS ─────────────────────────────────────── */}
              <View className="mb-5">
                <View className="flex-row items-center mb-3.5">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.3,
                      },
                    ]}
                    className="text-[#8C6A6A]"
                  >
                    MANAGEMENT TOOLS
                  </Text>
                  <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                </View>
                <View className="flex-row flex-wrap justify-between">
                  {techActions.map((a) => (
                    <ActionCard
                      key={a.id}
                      action={a}
                      onPress={() => {
                        if (a.route === "profileModal") {
                          loadProfileForEdit();
                        } else {
                          router.push(a.route as any);
                        }
                      }}
                    />
                  ))}
                </View>
              </View>

              {/* ── FLOCK OVERVIEW ───────────────────────────────────────── */}
              <View className="mb-5">
                <View className="flex-row items-center mb-3.5">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.3,
                      },
                    ]}
                    className="text-[#8C6A6A]"
                  >
                    FLOCK OVERVIEW
                  </Text>
                  <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                </View>
                <View className="flex-row gap-2 mb-2">
                  <StatBlock
                    label="Live Pop."
                    value={batchData.livePop}
                    unit="hd"
                    color="#1A0505"
                  />
                  <StatBlock
                    label="Mortality"
                    value={batchData.totalMortality}
                    unit="hd"
                    color="#C0392B"
                  />
                </View>
                <View className="flex-row gap-2 mb-2">
                  <StatBlock
                    label="Feeds"
                    value={batchData.totalFeed}
                    unit="kg"
                    color="#D35400"
                  />
                  <StatBlock
                    label="Vitamins"
                    value={batchData.totalVitamins}
                    unit="g"
                    color="#27AE60"
                  />
                </View>
                <View
                  style={{
                    backgroundColor: "#3B0A0A",
                    borderRadius: 4,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0,
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.7)",
                          marginBottom: 4,
                        },
                      ]}
                    >
                      AVG BIRD WEIGHT
                    </Text>
                    <View className="flex-row items-end">
                      <Text
                        style={[
                          font("700"),
                          {
                            fontSize: 32,
                            color: "#FFFFFF",
                            letterSpacing: -0.5,
                            lineHeight: 34,
                          },
                        ]}
                      >
                        {(batchData.avgWeight || 0).toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            marginLeft: 6,
                            marginBottom: 4,
                          },
                        ]}
                      >
                        grams
                      </Text>
                    </View>
                  </View>
                  <View
                    className="items-center justify-center bg-white/10 border border-white/20"
                    style={{ width: 52, height: 52, borderRadius: 26 }}
                  >
                    <Ionicons
                      name="egg-outline"
                      size={28}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                </View>
              </View>

              {/* ── PEN DISTRIBUTION ─────────────────────────────────────── */}
              {batchData.pens?.length > 0 && (
                <View className="mb-5">
                  <View className="flex-row items-center mb-3.5">
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0,
                          textTransform: "uppercase",
                        },
                      ]}
                      className="text-[#8C6A6A]"
                    >
                      PEN DISTRIBUTION
                    </Text>
                    <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                    <Text
                      style={[mono, { fontSize: 14, letterSpacing: 1 }]}
                      className="text-[#D4B8B8] ml-3"
                    >
                      {batchData.pens.length} PENS
                    </Text>
                  </View>
                  {displayedPens.map((pen: any) => (
                    <PenCard key={pen.id} pen={pen} />
                  ))}
                  {batchData.pens.length > 2 && (
                    <TouchableOpacity
                      onPress={() => setShowAllPens(!showAllPens)}
                      activeOpacity={0.7}
                      className="flex-row items-center justify-center border border-[#EDE0E0] rounded py-3 bg-[#FAF7F7] mt-1"
                    >
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 14,
                            letterSpacing: 0.3,
                          },
                        ]}
                        className="text-[#8C6A6A] mr-2"
                      >
                        {showAllPens
                          ? "Show Less"
                          : `SHOW ALL ${batchData.pens.length} PENS`}
                      </Text>
                      <Ionicons
                        name={showAllPens ? "chevron-up" : "chevron-down"}
                        size={12}
                        color="#8C6A6A"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <View className="border border-[#EDE0E0] rounded p-10 items-center bg-[#FAF7F7] mb-5">
              <Ionicons name="folder-open-outline" size={40} color="#D4B8B8" />
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  },
                ]}
                className="text-[#8C6A6A] mt-3"
              >
                NO ACTIVE BATCH
              </Text>
              <View className="w-full mt-7">
                <View className="flex-row flex-wrap justify-between">
                  {techActions.map((a) => (
                    <ActionCard
                      key={a.id}
                      action={a}
                      onPress={() => router.push(a.route as any)}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── PROFILE QUICK-MENU MODAL (From Avatar) ─────────────────────────── */}
      <Modal visible={showProfileMenuModal} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={() => setShowProfileMenuModal(false)}
        >
          <View
            className="absolute bg-white border border-[#EDE0E0] rounded overflow-hidden w-44"
            style={{ top: 80, right: 20 }}
          >
            <TouchableOpacity
              onPress={uploadProfileImage}
              className="flex-row items-center p-3.5 border-b border-[#EDE0E0]"
            >
              <Ionicons name="camera-outline" size={16} color="#1A0505" />
              <Text
                style={[font("500"), { fontSize: 13 }]}
                className="text-[#1A0505] ml-2.5"
              >
                Change Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowProfileMenuModal(false);
                loadProfileForEdit();
              }}
              className="flex-row items-center p-3.5 border-b border-[#EDE0E0]"
            >
              <Ionicons name="person-outline" size={16} color="#1A0505" />
              <Text
                style={[font("500"), { fontSize: 13 }]}
                className="text-[#1A0505] ml-2.5"
              >
                Edit Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowProfileMenuModal(false);
                setShowLogoutModal(true);
              }}
              className="flex-row items-center p-3.5"
            >
              <Ionicons name="log-out-outline" size={16} color="#C0392B" />
              <Text
                style={[font("500"), { fontSize: 13 }]}
                className="text-[#C0392B] ml-2.5"
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── LOGOUT MODAL ───────────────────────────────────────────────────── */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white border border-[#EDE0E0] rounded w-full max-w-sm overflow-hidden">
            <View className="h-0.5 bg-[#3B0A0A]" />
            <View className="p-7 items-center">
              <View
                className="bg-[#F5EDED] border border-[#3B0A0A]/25 items-center justify-center mb-4"
                style={{ width: 52, height: 52, borderRadius: 4 }}
              >
                <Ionicons name="log-out-outline" size={24} color="#3B0A0A" />
              </View>
              <Text
                style={[font("700"), { fontSize: 18, letterSpacing: -0.3 }]}
                className="text-[#1A0505] mb-2"
              >
                Sign Out?
              </Text>
              <Text
                style={[
                  mono,
                  { fontSize: 13, letterSpacing: 0.5, lineHeight: 16 },
                ]}
                className="text-[#8C6A6A] text-center mb-6"
              >
                You will need to authenticate again to access your dashboard.
              </Text>
              <View className="flex-row gap-2.5 w-full">
                <TouchableOpacity
                  onPress={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 border border-[#EDE0E0] rounded items-center"
                >
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-[#8C6A6A]"
                  >
                    CANCEL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLogout}
                  className="flex-1 py-3 bg-[#3B0A0A] rounded items-center"
                >
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-white"
                  >
                    SIGN OUT
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── FULL SCREEN EDIT PROFILE MODAL ─────────────────────────────────── */}
      <Modal visible={showEditProfileModal} animationType="slide">
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            {/* Header */}
            <View className="bg-[#3B0A0A] pt-10 pb-5 px-5">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setShowEditProfileModal(false)}
                  className="w-10 h-10 rounded border border-white/20 bg-white/10 items-center justify-center mr-4"
                >
                  <Ionicons name="close" size={20} color="white" />
                </TouchableOpacity>
                <View>
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-white/60 mb-1"
                  >
                    ACCOUNT
                  </Text>
                  <Text
                    style={[font("700"), { fontSize: 24, letterSpacing: -0.3 }]}
                    className="text-white"
                  >
                    Profile Settings
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              className="flex-1 px-5 pt-8"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 60 }}
            >
              {/* Avatar Area */}
              <View className="items-center mb-8">
                <View className="w-24 h-24 rounded-full border-2 border-[#3B0A0A] overflow-hidden justify-center items-center bg-[#FAF7F7] mb-3">
                  {profileImage ? (
                    <Image
                      source={{ uri: profileImage }}
                      className="w-full h-full"
                    />
                  ) : (
                    <Text
                      style={[font("700"), { fontSize: 32, color: "#3B0A0A" }]}
                    >
                      {editFirstName?.[0] || "?"}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={uploadProfileImage}>
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-[#0E7490] font-bold"
                  >
                    CHANGE PICTURE
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <View className="mb-6">
                <View className="mb-4">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-[#8C6A6A] mb-2 ml-1"
                  >
                    FIRST NAME
                  </Text>
                  <View className="flex-row items-center bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-3.5">
                    <Ionicons name="person-outline" size={18} color="#8C6A6A" />
                    <TextInput
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="Enter First Name"
                      placeholderTextColor="#D4B8B8"
                      style={[font("600"), { fontSize: 15, color: "#1A0505" }]}
                      className="flex-1 ml-3"
                    />
                  </View>
                </View>

                <View className="mb-8">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-[#8C6A6A] mb-2 ml-1"
                  >
                    LAST NAME
                  </Text>
                  <View className="flex-row items-center bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-3.5">
                    <Ionicons name="person-outline" size={18} color="#8C6A6A" />
                    <TextInput
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Enter Last Name"
                      placeholderTextColor="#D4B8B8"
                      style={[font("600"), { fontSize: 15, color: "#1A0505" }]}
                      className="flex-1 ml-3"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  className={`py-4 rounded-xl items-center justify-center flex-row shadow-sm ${
                    savingProfile ? "bg-[#3B0A0A]/70" : "bg-[#3B0A0A]"
                  }`}
                >
                  {savingProfile ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                      className="mr-2"
                    />
                  ) : (
                    <Ionicons
                      name="save-outline"
                      size={20}
                      color="#FFFFFF"
                      className="mr-2"
                    />
                  )}
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.3,

                        fontWeight: "bold",
                      },
                    ]}
                    className="text-white"
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default TechHome;
