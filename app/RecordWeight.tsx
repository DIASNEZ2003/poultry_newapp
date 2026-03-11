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

// Helper function to calculate current batch day
const calculateCurrentDay = (dateCreatedStr: string) => {
  if (!dateCreatedStr) return 1;
  const [startYear, startMonth, startDay] = dateCreatedStr
    .split("-")
    .map(Number);
  const start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
  );
  const diffTime = today.getTime() - start.getTime();
  const day = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(day, 30));
};

const RecordWeight = () => {
  const router = useRouter();

  // App States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false); // NEW: Lock logic

  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [assignedPen, setAssignedPen] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(1);

  // Weight Tracking States
  const [todayStats, setTodayStats] = useState({
    approvedWeight: 0,
    pendingWeight: 0,
  });

  // Input States
  const [averageWeight, setAverageWeight] = useState("");
  const [remarks, setRemarks] = useState("");

  // Calculate Scheduled Days (3, 6, 9... 30)
  const isWeighingDay = currentDay % 3 === 0 && currentDay <= 30;
  const nextWeighingDay = Math.min(
    30,
    Math.ceil((currentDay === 0 ? 1 : currentDay + 0.1) / 3) * 3,
  );

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = ref(db, `users/${user.uid}`);
    const unsubUser = onValue(userRef, (snap) => {
      if (snap.exists()) setAssignedPen(snap.val().assignedPen);
    });

    const batchesRef = ref(db, "global_batches");
    const unsubBatch = onValue(batchesRef, (snap) => {
      if (snap.exists()) {
        const batches = snap.val();
        const activeId = Object.keys(batches).find(
          (id) => batches[id].status === "active",
        );

        setActiveBatchId(activeId || null);
        if (activeId && assignedPen) {
          const batchData = batches[activeId];
          const calculatedDay = calculateCurrentDay(batchData.dateCreated);
          setCurrentDay(calculatedDay);

          let appWeight = 0;
          let pendWeight = 0;
          let submissionFound = false; // Lock check flag
          const now = new Date();

          const isToday = (log: any) => {
            const d = new Date(log.timestamp || log.dateLabel || log.date);
            return (
              d.getDate() === now.getDate() &&
              d.getMonth() === now.getMonth() &&
              d.getFullYear() === now.getFullYear()
            );
          };

          if (batchData.weight_logs?.[assignedPen]) {
            Object.values(batchData.weight_logs[assignedPen]).forEach(
              (log: any) => {
                if (isToday(log)) {
                  submissionFound = true; // Set lock if any record exists for today
                  if (log.status === "approved")
                    appWeight = Number(log.averageWeight || 0);
                  else pendWeight = Number(log.averageWeight || 0);
                }
              },
            );
          }
          setAlreadySubmitted(submissionFound); // Disable form if true
          setTodayStats({
            approvedWeight: appWeight,
            pendingWeight: pendWeight,
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
    if (!activeBatchId || !assignedPen) return;
    if (!averageWeight) {
      Alert.alert("Validation", "Please enter the sample weight.");
      return;
    }

    try {
      setSubmitting(true);
      const batchRef = ref(db, `global_batches/${activeBatchId}`);
      const newLogKey = push(
        ref(db, `global_batches/${activeBatchId}/weight_logs/${assignedPen}`),
      ).key;

      const payload = {
        averageWeight: Number(averageWeight),
        remarks: remarks.trim() || "Regular Weighing",
        timestamp: serverTimestamp(),
        recordedBy: auth.currentUser?.uid,
        dateLabel: new Date().toLocaleDateString(),
        batchDay: currentDay,
        status: "not approved",
      };

      await update(batchRef, {
        [`weight_logs/${assignedPen}/${newLogKey}`]: payload,
      });
      setShowSuccessModal(true);
      setAverageWeight("");
      setRemarks("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
      </View>
    );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* HEADER */}
        <View className="bg-[#3B0A0A] pt-10 pb-5 px-5 flex-row items-center">
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
                  color: "rgba(255,255,255,0.6)",
                },
              ]}
              className="uppercase"
            >
              Personnel / Activity
            </Text>
            <Text
              style={[
                font("700"),
                { fontSize: 24, letterSpacing: -0.3, color: "white" },
              ]}
            >
              Record Weight
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* PROGRESS & SCHEDULE CARD */}
          <View className="bg-white border border-[#EDE0E0] rounded-xl overflow-hidden mb-6 shadow-sm">
            <View className="h-1 bg-[#0E7490]" />
            <View className="p-5">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text
                    style={[
                      mono,
                      { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                    ]}
                    className="uppercase"
                  >
                    Batch Progress ({assignedPen})
                  </Text>
                  <Text
                    style={[
                      font("700"),
                      { fontSize: 32, letterSpacing: -0.3, color: "#1A0505" },
                    ]}
                  >
                    Day {currentDay}{" "}
                    <Text style={{ fontSize: 16, color: "#8C6A6A" }}>/ 30</Text>
                  </Text>
                </View>
                <Ionicons name="scale" size={24} color="#0E7490" />
              </View>

              <View
                style={{
                  backgroundColor: isWeighingDay ? "#F0FDF4" : "#FAF7F7",
                  borderColor: isWeighingDay ? "#A7F3D0" : "#EDE0E0",
                }}
                className="flex-row items-center p-3 rounded-lg border"
              >
                <Ionicons
                  name={isWeighingDay ? "checkmark-circle" : "calendar-outline"}
                  size={18}
                  color={isWeighingDay ? "#27AE60" : "#8C6A6A"}
                />
                <View className="ml-3">
                  <Text
                    style={[
                      font("700"),
                      {
                        fontSize: 13,
                        color: isWeighingDay ? "#15803d" : "#1A0505",
                      },
                    ]}
                  >
                    {isWeighingDay ? "Weighing Day" : "Not a Weighing Day"}
                  </Text>
                  {!isWeighingDay && (
                    <Text style={[mono, { fontSize: 14, color: "#8C6A6A" }]}>
                      Next scheduled: Day {nextWeighingDay}
                    </Text>
                  )}
                </View>
              </View>

              <View className="flex-row gap-4 mt-5 pt-5 border-t border-[#EDE0E0]">
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                    ]}
                    className="uppercase"
                  >
                    Approved Today
                  </Text>
                  <Text
                    style={[font("700"), { fontSize: 18, color: "#1A0505" }]}
                  >
                    {todayStats.approvedWeight || "--"}{" "}
                    <Text style={[mono, { fontSize: 13, color: "#8C6A6A" }]}>
                      g
                    </Text>
                  </Text>
                </View>
                <View className="flex-1 border-l border-[#EDE0E0] pl-4">
                  <Text
                    style={[
                      mono,
                      { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                    ]}
                    className="uppercase"
                  >
                    Pending Today
                  </Text>
                  <Text
                    style={[font("700"), { fontSize: 18, color: "#D35400" }]}
                  >
                    {todayStats.pendingWeight || "--"}{" "}
                    <Text style={[mono, { fontSize: 13, color: "#8C6A6A" }]}>
                      g
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* BLOCK LOGIC: Only show form if not already submitted */}
          {!alreadySubmitted ? (
            <View className="mb-6">
              <Text
                style={[
                  mono,
                  { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                ]}
                className="uppercase mb-2 ml-1"
              >
                Average Sample Weight (Grams)
              </Text>
              <TextInput
                keyboardType="numeric"
                value={averageWeight}
                onChangeText={setAverageWeight}
                placeholder="0"
                placeholderTextColor="#D4B8B8"
                editable={isWeighingDay && !submitting}
                style={[
                  font("700"),
                  {
                    fontSize: 32,
                    color: isWeighingDay ? "#0E7490" : "#D4B8B8",
                    textAlign: "center",
                  },
                ]}
                className={`border border-[#EDE0E0] rounded-xl py-6 ${!isWeighingDay ? "bg-gray-50" : "bg-[#FAF7F7]"}`}
              />

              <View className="mt-6">
                <Text
                  style={[
                    mono,
                    { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                  ]}
                  className="uppercase mb-2 ml-1"
                >
                  Remarks / Observation
                </Text>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="How does the flock look?"
                  placeholderTextColor="#D4B8B8"
                  editable={isWeighingDay && !submitting}
                  style={[font("500"), { fontSize: 15, color: "#1A0505" }]}
                  className={`border border-[#EDE0E0] rounded-xl px-4 py-4 ${!isWeighingDay ? "bg-gray-50" : "bg-[#FAF7F7]"}`}
                />
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !isWeighingDay}
                className={`mt-10 py-4 rounded-xl flex-row justify-center items-center ${submitting || !isWeighingDay ? "bg-gray-300" : "bg-[#3B0A0A]"}`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 15,
                        letterSpacing: 0.2,
                        color: "white",
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {isWeighingDay ? "SUBMIT WEIGHT LOG" : "SCHEDULED ONLY"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* WEIGHT LOG ALREADY SUBMITTED VIEW */
            <View className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-6 items-center mb-6">
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
                Weight Log Completed
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
                The weight for {assignedPen} has already been recorded for
                today. New entries are disabled to ensure a single accurate
                measurement per pen.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-7 items-center">
            <View className="w-16 h-16 bg-[#F0FDF4] border border-[#A7F3D0] rounded-full items-center justify-center mb-5">
              <Ionicons name="checkmark" size={32} color="#059669" />
            </View>
            <Text style={[font("700"), { fontSize: 20, color: "#1A0505" }]}>
              Weight Logged!
            </Text>
            <Text
              style={[
                mono,
                {
                  fontSize: 14,
                  color: "#8C6A6A",
                  textAlign: "center",
                  marginTop: 8,
                  marginBottom: 24,
                },
              ]}
            >
              The record has been sent to the technician for approval.
            </Text>
            <TouchableOpacity
              onPress={() => setShowSuccessModal(false)}
              className="bg-[#3B0A0A] w-full py-4 rounded-xl items-center"
            >
              <Text
                style={[
                  mono,
                  { fontSize: 14, color: "white", fontWeight: "bold" },
                ]}
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

export default RecordWeight;
