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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const RecordVitamins = () => {
  const router = useRouter();

  // App States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // NEW SHIFT-SPECIFIC LOCK STATES
  const [amSubmitted, setAmSubmitted] = useState(false);
  const [pmSubmitted, setPmSubmitted] = useState(false);

  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [rawBatch, setRawBatch] = useState<any>(null);
  const [assignedPen, setAssignedPen] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(1);

  // Vitamin Tracking States
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedVit, setSelectedVit] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [todayStats, setTodayStats] = useState({
    am: 0,
    pm: 0,
    pendingAm: 0,
    pendingPm: 0,
  });

  // Input States
  const [amCount, setAmCount] = useState("");
  const [pmCount, setPmCount] = useState("");
  const [waterAm, setWaterAm] = useState("");
  const [waterPm, setWaterPm] = useState("");
  const [remarks, setRemarks] = useState("");

  // 1. Fetch User and Active Batch Data
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
        if (activeId) {
          const batchData = batches[activeId];
          setRawBatch(batchData);
          setCurrentDay(calculateCurrentDay(batchData.dateCreated));
        }
      }
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubBatch();
    };
  }, []);

  // 2. Data Processing (Inventory & Today's Stats & Lock Logic)
  useEffect(() => {
    if (!rawBatch || !assignedPen) return;

    const vTotals: any = {};
    if (rawBatch.expenses) {
      Object.values(rawBatch.expenses).forEach((exp: any) => {
        const cat = String(exp.category || exp.type || "").toLowerCase();
        if (
          cat.includes("vitamin") ||
          cat.includes("medicine") ||
          cat.includes("supplement")
        ) {
          const name =
            exp.name || exp.itemName || exp.description || "Unnamed Vitamin";
          vTotals[name] =
            (vTotals[name] || 0) + Number(exp.quantity || exp.amount || 0);
        }
      });
    }

    const vUsed: any = {};
    const vLogs = rawBatch.vitamin_logs || rawBatch.daily_vitamin_logs;
    if (vLogs) {
      Object.values(vLogs).forEach((penLogs: any) => {
        Object.values(penLogs).forEach((log: any) => {
          const name = log.vitaminName;
          if (name && log.status !== "rejected") {
            vUsed[name] =
              (vUsed[name] || 0) +
              Number(log.ua_am || log.am || 0) +
              Number(log.ua_pm || log.pm || 0);
          }
        });
      });
    }

    const invList = Object.keys(vTotals).map((name) => ({
      name,
      remaining: Math.max(0, vTotals[name] - (vUsed[name] || 0)),
    }));
    setInventory(invList);

    const activeVitName =
      selectedVit || (invList.length > 0 ? invList[0].name : null);
    if (!selectedVit && invList.length > 0) setSelectedVit(invList[0].name);

    let tAm = 0,
      tPm = 0,
      pAm = 0,
      pPm = 0;

    let hasAmToday = false;
    let hasPmToday = false;

    const now = new Date();
    const isToday = (log: any) => {
      const d = new Date(log.timestamp || log.dateLabel || log.date);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    };

    if (vLogs?.[assignedPen] && activeVitName) {
      Object.values(vLogs[assignedPen]).forEach((log: any) => {
        if (isToday(log) && log.vitaminName === activeVitName) {
          // Check if AM or PM was already filled today
          if (
            log.ua_am !== undefined ||
            log.am !== undefined ||
            log.water_am !== undefined
          )
            hasAmToday = true;
          if (
            log.ua_pm !== undefined ||
            log.pm !== undefined ||
            log.water_pm !== undefined
          )
            hasPmToday = true;

          if (log.status === "approved") {
            tAm += Number(log.am || 0);
            tPm += Number(log.pm || 0);
          } else {
            pAm += Number(log.ua_am ?? log.am ?? 0);
            pPm += Number(log.ua_pm ?? log.pm ?? 0);
          }
        }
      });
    }

    setAmSubmitted(hasAmToday);
    setPmSubmitted(hasPmToday);

    setTodayStats({ am: tAm, pm: tPm, pendingAm: pAm, pendingPm: pPm });
  }, [rawBatch, assignedPen, selectedVit]);

  const handleSubmit = async () => {
    if (!activeBatchId || !assignedPen || !selectedVit) {
      Alert.alert("Error", "Please select a supplement.");
      return;
    }
    if (!amCount && !pmCount && !waterAm && !waterPm) {
      Alert.alert(
        "Validation",
        "Enter at least one value for vitamins or water.",
      );
      return;
    }
    if (
      ((amCount !== "" || waterAm !== "") && amSubmitted) ||
      ((pmCount !== "" || waterPm !== "") && pmSubmitted)
    ) {
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
        ref(db, `global_batches/${activeBatchId}/vitamin_logs/${assignedPen}`),
      ).key;

      const payload: any = {
        vitaminName: selectedVit,
        remarks: remarks.trim() || "Regular Vitamins & Water",
        timestamp: serverTimestamp(),
        recordedBy: auth.currentUser?.uid,
        dateLabel: new Date().toLocaleDateString(),
        status: "not approved",
      };

      if (amCount !== "") payload.ua_am = Number(amCount);
      if (pmCount !== "") payload.ua_pm = Number(pmCount);
      if (waterAm !== "") payload.water_am = Number(waterAm);
      if (waterPm !== "") payload.water_pm = Number(waterPm);

      await update(batchRef, {
        [`vitamin_logs/${assignedPen}/${newLogKey}`]: payload,
      });
      setShowSuccessModal(true);
      setAmCount("");
      setPmCount("");
      setWaterAm("");
      setWaterPm("");
      setRemarks("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeStock =
    inventory.find((v) => v.name === selectedVit)?.remaining || 0;

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
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
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
              Vitamins & Water
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── INVENTORY STATUS CARD ──────────────────────────────────────── */}
          <View className="bg-white border border-[#EDE0E0] rounded-xl overflow-hidden mb-6 shadow-sm">
            <View className="h-1 bg-[#27AE60]" />
            <View className="p-5">
              <Text
                style={[
                  mono,
                  { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                ]}
                className="uppercase mb-1"
              >
                Current Stock ({selectedVit})
              </Text>
              <Text
                style={[
                  font("700"),
                  { fontSize: 36, letterSpacing: -0.3, color: "#1A0505" },
                ]}
              >
                {activeStock}{" "}
                <Text style={{ fontSize: 18, color: "#8C6A6A" }}>g/mL</Text>
              </Text>

              <View className="flex-row gap-4 mt-5 pt-5 border-t border-[#EDE0E0]">
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                    ]}
                    className="uppercase"
                  >
                    AM Approved
                  </Text>
                  <Text
                    style={[font("700"), { fontSize: 18, color: "#27AE60" }]}
                  >
                    {todayStats.am}{" "}
                    <Text style={[mono, { fontSize: 13, color: "#8C6A6A" }]}>
                      g/mL
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
                    PM Approved
                  </Text>
                  <Text
                    style={[font("700"), { fontSize: 18, color: "#27AE60" }]}
                  >
                    {todayStats.pm}{" "}
                    <Text style={[mono, { fontSize: 13, color: "#8C6A6A" }]}>
                      g/mL
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* BLOCK LOGIC: Only hide form completely if BOTH AM and PM are submitted */}
          {!amSubmitted || !pmSubmitted ? (
            <View className="mb-6">
              <Text
                style={[
                  mono,
                  { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                ]}
                className="uppercase mb-2 ml-1"
              >
                Select Supplement
              </Text>
              <TouchableOpacity
                onPress={() => setDropdownOpen(!dropdownOpen)}
                className="bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-4 flex-row justify-between items-center mb-6"
              >
                <Text
                  style={[
                    font("600"),
                    {
                      fontSize: 15,
                      color: selectedVit ? "#1A0505" : "#D4B8B8",
                    },
                  ]}
                >
                  {selectedVit || "Choose supplement..."}
                </Text>
                <Ionicons
                  name={dropdownOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#8C6A6A"
                />
              </TouchableOpacity>

              {dropdownOpen && (
                <View className="bg-white border border-[#EDE0E0] rounded-xl mt-[-20] mb-6 overflow-hidden shadow-sm z-50">
                  {inventory.map((v, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setSelectedVit(v.name);
                        setDropdownOpen(false);
                      }}
                      className="p-4 border-b border-[#FAF7F7] flex-row justify-between"
                    >
                      <Text style={[font("600"), { color: "#1A0505" }]}>
                        {v.name}
                      </Text>
                      <Text style={[mono, { fontSize: 14, color: "#8C6A6A" }]}>
                        {v.remaining} left
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Vitamin Dosage Inputs */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                        color: amSubmitted ? "#D4B8B8" : "#8C6A6A",
                      },
                    ]}
                    className="uppercase mb-2 ml-1"
                  >
                    AM Dose (g/mL)
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={amSubmitted ? "DONE" : amCount}
                    onChangeText={setAmCount}
                    placeholder="0.0"
                    placeholderTextColor="#D4B8B8"
                    editable={!amSubmitted && !submitting}
                    style={[
                      font("700"),
                      {
                        fontSize: 24,
                        color: amSubmitted ? "#9CA3AF" : "#27AE60",
                        textAlign: "center",
                      },
                    ]}
                    className={`rounded-xl py-4 border ${amSubmitted ? "bg-gray-100 border-gray-200" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                        color: pmSubmitted ? "#D4B8B8" : "#8C6A6A",
                      },
                    ]}
                    className="uppercase mb-2 ml-1"
                  >
                    PM Dose (g/mL)
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={pmSubmitted ? "DONE" : pmCount}
                    onChangeText={setPmCount}
                    placeholder="0.0"
                    placeholderTextColor="#D4B8B8"
                    editable={!pmSubmitted && !submitting}
                    style={[
                      font("700"),
                      {
                        fontSize: 24,
                        color: pmSubmitted ? "#9CA3AF" : "#27AE60",
                        textAlign: "center",
                      },
                    ]}
                    className={`rounded-xl py-4 border ${pmSubmitted ? "bg-gray-100 border-gray-200" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                  />
                </View>
              </View>

              {/* Water Inputs */}
              <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                        color: amSubmitted ? "#D4B8B8" : "#8C6A6A",
                      },
                    ]}
                    className="uppercase mb-2 ml-1"
                  >
                    AM Water (L)
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={amSubmitted ? "DONE" : waterAm}
                    onChangeText={setWaterAm}
                    placeholder="0.0"
                    placeholderTextColor="#D4B8B8"
                    editable={!amSubmitted && !submitting}
                    style={[
                      font("700"),
                      {
                        fontSize: 24,
                        color: amSubmitted ? "#9CA3AF" : "#2471A3",
                        textAlign: "center",
                      },
                    ]}
                    className={`rounded-xl py-4 border ${amSubmitted ? "bg-gray-100 border-gray-200" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                        color: pmSubmitted ? "#D4B8B8" : "#8C6A6A",
                      },
                    ]}
                    className="uppercase mb-2 ml-1"
                  >
                    PM Water (L)
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={pmSubmitted ? "DONE" : waterPm}
                    onChangeText={setWaterPm}
                    placeholder="0.0"
                    placeholderTextColor="#D4B8B8"
                    editable={!pmSubmitted && !submitting}
                    style={[
                      font("700"),
                      {
                        fontSize: 24,
                        color: pmSubmitted ? "#9CA3AF" : "#2471A3",
                        textAlign: "center",
                      },
                    ]}
                    className={`rounded-xl py-4 border ${pmSubmitted ? "bg-gray-100 border-gray-200" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                  />
                </View>
              </View>

              <View className="mt-6">
                <Text
                  style={[
                    mono,
                    { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                  ]}
                  className="uppercase mb-2 ml-1"
                >
                  Remarks
                </Text>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Observation or notes..."
                  placeholderTextColor="#D4B8B8"
                  style={[font("500"), { fontSize: 15, color: "#1A0505" }]}
                  className="bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-4 mb-8"
                />
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={
                  submitting ||
                  (amCount === "" &&
                    waterAm === "" &&
                    pmCount === "" &&
                    waterPm === "")
                }
                className={`mt-10 py-4 rounded-xl flex-row justify-center items-center ${submitting || (amCount === "" && waterAm === "" && pmCount === "" && waterPm === "") ? "bg-[#3B0A0A]/50" : "bg-[#3B0A0A]"}`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons
                      name="save-outline"
                      size={18}
                      color="white"
                      className="mr-2"
                    />
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
                      SAVE RECORD
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* FULL REPORT ALREADY SUBMITTED VIEW */
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
                Daily Log Completed
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
                Both AM and PM logs for {selectedVit} in {assignedPen} have been
                fully recorded for today.
              </Text>
            </View>
          )}

          {/* Pending Alert */}
          {(todayStats.pendingAm > 0 || todayStats.pendingPm > 0) && (
            <View
              className="flex-row items-center bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 mb-10 mt-4"
              style={{ borderLeftWidth: 4, borderLeftColor: "#D35400" }}
            >
              <Ionicons
                name="time"
                size={20}
                color="#D35400"
                className="mr-3"
              />
              <View className="flex-1">
                <Text style={[font("700"), { fontSize: 13, color: "#1A0505" }]}>
                  Pending Approval
                </Text>
                <Text style={[mono, { fontSize: 14, color: "#8C6A6A" }]}>
                  Your records are waiting for technician review.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── SUCCESS MODAL ─────────────────────────────────────────────────── */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-7 items-center shadow-2xl">
            <View className="w-16 h-16 bg-[#F0FDF4] border border-[#A7F3D0] rounded-full items-center justify-center mb-5">
              <Ionicons name="checkmark" size={32} color="#059669" />
            </View>
            <Text style={[font("700"), { fontSize: 20, color: "#1A0505" }]}>
              Record Saved!
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
              The log has been sent to the technician for approval.
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

export default RecordVitamins;
