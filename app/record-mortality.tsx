import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onValue, push, ref, serverTimestamp, update } from "firebase/database";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { auth, db } from "./firebaseConfig";

// ── Font helpers ──────────────────────────────────────────────────────────────
const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

const RecordMortality = () => {
  const router = useRouter();

  // App States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [assignedPen, setAssignedPen] = useState<string | null>(null);

  // NEW SHIFT-SPECIFIC LOCK STATES
  const [amSubmitted, setAmSubmitted] = useState(false);
  const [pmSubmitted, setPmSubmitted] = useState(false);

  const [penStats, setPenStats] = useState({
    currentPop: 0,
    am: 0,
    pm: 0,
    pendingAm: 0,
    pendingPm: 0,
  });

  // Input States
  const [amCount, setAmCount] = useState("");
  const [pmCount, setPmCount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Get Personnel's Assigned Pen
    const userRef = ref(db, `users/${user.uid}`);
    const unsubUser = onValue(userRef, (snap) => {
      if (snap.exists()) {
        setAssignedPen(snap.val().assignedPen); // e.g. "Pen 1"
      }
    });

    // 2. Get Active Batch and calculate/read population
    const batchesRef = ref(db, "global_batches");
    const unsubBatch = onValue(batchesRef, (snap) => {
      if (snap.exists()) {
        const batches = snap.val();
        const activeId = Object.keys(batches).find(
          (id) => batches[id].status === "active",
        );

        setActiveBatchId(activeId || null);

        if (activeId && assignedPen) {
          const activeBatch = batches[activeId];
          const logs = activeBatch.mortality_logs?.[assignedPen] || {};

          let allTimeMortality = 0;
          let todayAmApproved = 0;
          let todayPmApproved = 0;
          let todayAmPending = 0;
          let todayPmPending = 0;

          let hasAmToday = false;
          let hasPmToday = false;

          const now = new Date();

          // Helper to check if a log belongs to TODAY
          const isLogToday = (log: any) => {
            if (log.timestamp && typeof log.timestamp === "number") {
              const logDate = new Date(log.timestamp);
              return (
                logDate.getDate() === now.getDate() &&
                logDate.getMonth() === now.getMonth() &&
                logDate.getFullYear() === now.getFullYear()
              );
            }
            if (log.dateLabel || log.date) {
              const logDateStr = log.dateLabel || log.date;
              const logDate = new Date(logDateStr);
              if (!isNaN(logDate.getTime())) {
                return (
                  logDate.getDate() === now.getDate() &&
                  logDate.getMonth() === now.getMonth() &&
                  logDate.getFullYear() === now.getFullYear()
                );
              } else {
                return logDateStr === now.toLocaleDateString();
              }
            }
            return false;
          };

          // Process logs
          Object.values(logs).forEach((log: any) => {
            const isToday = isLogToday(log);
            const isPending =
              log.status === "pending_approval" ||
              log.status === "not approved" ||
              log.status === "pending";
            const isApproved = log.status === "approved";

            // Determine if AM or PM keys exist in this log
            const amVal = Number(log.ua_am ?? log.am ?? 0);
            const pmVal = Number(log.ua_pm ?? log.pm ?? 0);

            if (isToday) {
              if (log.ua_am !== undefined || log.am !== undefined)
                hasAmToday = true;
              if (log.ua_pm !== undefined || log.pm !== undefined)
                hasPmToday = true;
            }

            if (isApproved) {
              allTimeMortality += amVal + pmVal; // Always accumulate for total population calc
              if (isToday) {
                todayAmApproved += amVal;
                todayPmApproved += pmVal;
              }
            } else if (isPending && isToday) {
              todayAmPending += amVal;
              todayPmPending += pmVal;
            }
          });

          // Set Individual Locks
          setAmSubmitted(hasAmToday);
          setPmSubmitted(hasPmToday);

          const formattedPenKey = assignedPen.toLowerCase().replace(" ", "_");
          let currentPenPop = activeBatch.pen_populations?.[formattedPenKey];

          // Fallback if pen_populations is missing
          if (currentPenPop === undefined) {
            const totalStart = Number(activeBatch.startingPopulation) || 0;
            const penCount = Number(activeBatch.penCount) || 1;
            const startingPerPen = Math.floor(totalStart / penCount);
            currentPenPop = startingPerPen - allTimeMortality;
          }

          setPenStats({
            currentPop: currentPenPop,
            am: todayAmApproved,
            pm: todayPmApproved,
            pendingAm: todayAmPending,
            pendingPm: todayPmPending,
          });
        }
      }
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubBatch();
    };
  }, [assignedPen]);

  const handleSubmit = async () => {
    if (!activeBatchId || !assignedPen) {
      Alert.alert("Error", "No active batch or pen assigned.");
      return;
    }

    if (!amCount && !pmCount) {
      Alert.alert(
        "Validation",
        "Please enter the number of deaths for either AM or PM.",
      );
      return;
    }

    if ((amCount !== "" && amSubmitted) || (pmCount !== "" && pmSubmitted)) {
      Alert.alert(
        "Error",
        "You have already submitted data for this shift today.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const batchRef = ref(db, `global_batches/${activeBatchId}`);
      const newLogKey = push(
        ref(
          db,
          `global_batches/${activeBatchId}/mortality_logs/${assignedPen}`,
        ),
      ).key;

      const updates: any = {};
      const payload: any = {
        reason: reason.trim() || "Routine check",
        timestamp: serverTimestamp(),
        recordedBy: auth.currentUser?.uid,
        dateLabel: new Date().toLocaleDateString(),
        status: "not approved",
      };

      // ONLY attach the shift data the user actually typed in
      if (amCount !== "") payload.ua_am = Number(amCount);
      if (pmCount !== "") payload.ua_pm = Number(pmCount);

      updates[`mortality_logs/${assignedPen}/${newLogKey}`] = payload;

      await update(batchRef, updates);

      setShowSuccessModal(true);

      setAmCount("");
      setPmCount("");
      setReason("");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
        <Text
          style={[
            mono,
            { fontSize: 14, letterSpacing: 0.2, textTransform: "uppercase" },
          ]}
          className="text-[#8C6A6A] mt-4"
        >
          LOADING DATA...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <View className="bg-[#3B0A0A] pt-10 pb-5 px-5">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded border border-white/20 bg-white/10 items-center justify-center mr-4"
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 14,
                    letterSpacing: 0.2,
                  },
                ]}
                className="text-white/60 mb-1"
              >
                PERSONNEL / ACTIVITY
              </Text>
              <Text
                style={[font("700"), { fontSize: 24, letterSpacing: -0.5 }]}
                className="text-white"
              >
                Log Mortality
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* ── PEN STATS CARD ──────────────────────────────────────────────── */}
          <View className="bg-white border border-[#EDE0E0] rounded-xl overflow-hidden mb-6 shadow-sm">
            <View className="h-1 bg-[#C0392B]" />
            <View className="p-5">
              <View className="flex-row justify-between items-start mb-1">
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 14,
                      letterSpacing: 0.2,
                    },
                  ]}
                  className="text-[#8C6A6A]"
                >
                  LIVE POPULATION ({assignedPen || "UNASSIGNED"})
                </Text>
                <Ionicons name="stats-chart" size={16} color="#8C6A6A" />
              </View>
              <Text
                style={[
                  font("700"),
                  { fontSize: 36, letterSpacing: -0.3, color: "#1A0505" },
                ]}
              >
                {(penStats.currentPop || 0).toLocaleString()}
              </Text>

              <View className="flex-row gap-4 mt-5 pt-5 border-t border-[#EDE0E0]">
                {/* AM Stats */}
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                        color: "#8C6A6A",
                        textTransform: "uppercase",
                      },
                    ]}
                  >
                    AM RECORDED TODAY
                  </Text>
                  <View className="flex-row items-baseline mt-1.5 gap-1.5">
                    <Text
                      style={[font("700"), { fontSize: 20, color: "#C0392B" }]}
                    >
                      {penStats.am}
                    </Text>
                    <Text style={[mono, { fontSize: 13, color: "#8C6A6A" }]}>
                      APRV
                    </Text>
                  </View>
                  {penStats.pendingAm > 0 && (
                    <Text
                      style={[
                        mono,
                        { fontSize: 13, color: "#D35400", marginTop: 4 },
                      ]}
                    >
                      + {penStats.pendingAm} PENDING
                    </Text>
                  )}
                </View>

                {/* PM Stats */}
                <View className="flex-1 border-l border-[#EDE0E0] pl-4">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                        color: "#8C6A6A",
                        textTransform: "uppercase",
                      },
                    ]}
                  >
                    PM RECORDED TODAY
                  </Text>
                  <View className="flex-row items-baseline mt-1.5 gap-1.5">
                    <Text
                      style={[font("700"), { fontSize: 20, color: "#C0392B" }]}
                    >
                      {penStats.pm}
                    </Text>
                    <Text style={[mono, { fontSize: 13, color: "#8C6A6A" }]}>
                      APRV
                    </Text>
                  </View>
                  {penStats.pendingPm > 0 && (
                    <Text
                      style={[
                        mono,
                        { fontSize: 13, color: "#D35400", marginTop: 4 },
                      ]}
                    >
                      + {penStats.pendingPm} PENDING
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* BLOCK LOGIC: Only hide form completely if BOTH AM and PM are submitted */}
          {!amSubmitted || !pmSubmitted ? (
            <View className="mb-6">
              <View className="flex-row items-center mb-4">
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 14,
                      letterSpacing: 0.2,
                    },
                  ]}
                  className="text-[#8C6A6A]"
                >
                  NEW REPORT
                </Text>
                <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
              </View>

              <View className="flex-row justify-between mb-5 gap-4">
                {/* AM Input */}
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                      },
                    ]}
                    className={`${amSubmitted ? "text-[#D4B8B8]" : "text-[#8C6A6A]"} mb-2 ml-1`}
                  >
                    MORNING (AM)
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={amSubmitted ? "DONE" : amCount}
                    onChangeText={setAmCount}
                    placeholder="0"
                    placeholderTextColor="#D4B8B8"
                    editable={!amSubmitted && !submitting}
                    style={[
                      font("700"),
                      {
                        fontSize: 24,
                        color: amSubmitted ? "#9CA3AF" : "#C0392B",
                        textAlign: "center",
                      },
                    ]}
                    className={`rounded-xl py-4 border ${amSubmitted ? "bg-gray-100 border-gray-200" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                  />
                </View>

                {/* PM Input */}
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                      },
                    ]}
                    className={`${pmSubmitted ? "text-[#D4B8B8]" : "text-[#8C6A6A]"} mb-2 ml-1`}
                  >
                    AFTERNOON (PM)
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={pmSubmitted ? "DONE" : pmCount}
                    onChangeText={setPmCount}
                    placeholder="0"
                    placeholderTextColor="#D4B8B8"
                    editable={!pmSubmitted && !submitting}
                    style={[
                      font("700"),
                      {
                        fontSize: 24,
                        color: pmSubmitted ? "#9CA3AF" : "#C0392B",
                        textAlign: "center",
                      },
                    ]}
                    className={`rounded-xl py-4 border ${pmSubmitted ? "bg-gray-100 border-gray-200" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                  />
                </View>
              </View>

              {/* Reason Input */}
              <View className="mb-6">
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 14,
                      letterSpacing: 0.2,
                    },
                  ]}
                  className="text-[#8C6A6A] mb-2 ml-1"
                >
                  REASON / NOTES
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Found sick or weak"
                  placeholderTextColor="#D4B8B8"
                  style={[font("500"), { fontSize: 15, color: "#1A0505" }]}
                  className="bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-4"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || (amCount === "" && pmCount === "")}
                className={`py-4 rounded-xl items-center justify-center flex-row shadow-sm ${
                  submitting || (amCount === "" && pmCount === "")
                    ? "bg-[#3B0A0A]/50"
                    : "bg-[#3B0A0A]"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                    className="mr-2"
                  />
                ) : (
                  <Ionicons
                    name="paper-plane-outline"
                    size={18}
                    color="#FFFFFF"
                    className="mr-2"
                  />
                )}
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 15,
                      letterSpacing: 0.2,
                      fontWeight: "bold",
                    },
                  ]}
                  className="text-white"
                >
                  {submitting ? "SUBMITTING..." : "SUBMIT REPORT"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* FULL REPORT ALREADY SUBMITTED VIEW */
            <View className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-6 items-center">
              <Ionicons
                name="checkmark-done-circle"
                size={48}
                color="#16A34A"
              />
              <Text
                style={[
                  font("700"),
                  { fontSize: 18, color: "#16A34A", marginTop: 10 },
                ]}
              >
                Report Completed
              </Text>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 14,
                    color: "#15803D",
                    textAlign: "center",
                    marginTop: 5,
                  },
                ]}
              >
                Both AM and PM mortality records for {assignedPen} have been
                submitted for today.
              </Text>
            </View>
          )}

          {/* ── PENDING ALERT (Insight Card Style) ──────────────────────────── */}
          {(penStats.pendingAm > 0 || penStats.pendingPm > 0) && (
            <View
              className="flex-row items-center bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 mb-6 mt-4"
              style={{ borderLeftWidth: 4, borderLeftColor: "#D35400" }}
            >
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-[#FEF3C7]">
                <Ionicons name="time" size={20} color="#D35400" />
              </View>
              <View className="flex-1">
                <Text
                  style={[
                    font("700"),
                    { fontSize: 13, color: "#1A0505", marginBottom: 2 },
                  ]}
                >
                  Pending Approval
                </Text>
                <Text
                  style={[
                    mono,
                    { fontSize: 14, color: "#8C6A6A", lineHeight: 20 },
                  ]}
                >
                  You have unapproved mortality records waiting for technician
                  review.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── CUSTOM SUCCESS MODAL ─────────────────────────────────────────── */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-7 items-center shadow-2xl">
            <View className="w-16 h-16 bg-[#F0FDF4] border border-[#A7F3D0] rounded-full items-center justify-center mb-5">
              <Ionicons name="checkmark" size={32} color="#059669" />
            </View>
            <Text
              style={[font("700"), { fontSize: 20, letterSpacing: -0.3 }]}
              className="text-[#1A0505] mb-2"
            >
              Report Sent!
            </Text>
            <Text
              style={[
                mono,
                { fontSize: 14, letterSpacing: 0.5, lineHeight: 22 },
              ]}
              className="text-[#8C6A6A] text-center mb-6"
            >
              Your mortality record was successfully sent to the technician for
              approval.
            </Text>

            <TouchableOpacity
              onPress={() => setShowSuccessModal(false)}
              className="bg-[#3B0A0A] w-full py-4 rounded-xl items-center"
            >
              <Text
                style={[
                  mono,
                  {
                    fontSize: 14,
                    letterSpacing: 0.2,
                    fontWeight: "bold",
                  },
                ]}
                className="text-white"
              >
                DONE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default RecordMortality;
