import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "./firebaseConfig";

const font = (weight = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

// ── Shared sub-components ─────────────────────────────────────────────────────

/** Section column header inside the 2×2 grid */
const ColHeader = ({ icon, label }: { icon: any; label: string }) => (
  <View className="flex-row items-center mb-2.5">
    <Ionicons name={icon} size={13} color="#3B0A0A" />
    <Text
      style={[
        mono,
        { fontSize: 13, letterSpacing: 0.2, textTransform: "uppercase" },
      ]}
      className="text-[#3B0A0A] ml-1.5"
    >
      {label}
    </Text>
  </View>
);

/** Individual log mini-card inside a column */
const LogCard = ({ children }: { children: React.ReactNode }) => (
  <View className="bg-white border border-[#EDE0E0] rounded p-2.5 mb-2">
    {children}
  </View>
);

const AmPmRow = ({
  am,
  pm,
  color = "#1A0505",
}: {
  am: number;
  pm: number;
  color?: string;
}) => (
  <View className="flex-row items-baseline gap-1 mt-0.5">
    <Text style={[font("700"), { fontSize: 15, color }]}>{am}</Text>
    <Text style={[mono, { fontSize: 13 }]} className="text-[#8C6A6A]">
      am
    </Text>
    <Text style={[mono, { fontSize: 13 }]} className="text-[#D4B8B8] mx-0.5">
      ·
    </Text>
    <Text style={[font("700"), { fontSize: 15, color }]}>{pm}</Text>
    <Text style={[mono, { fontSize: 13 }]} className="text-[#8C6A6A]">
      pm
    </Text>
  </View>
);

const NoPending = () => (
  <Text
    style={[mono, { fontSize: 13, letterSpacing: 1 }]}
    className="text-[#D4B8B8] italic mt-1"
  >
    NO PENDING
  </Text>
);

const NoLogs = () => (
  <Text
    style={[mono, { fontSize: 13, letterSpacing: 1 }]}
    className="text-[#D4B8B8] italic mt-1"
  >
    NO LOGS
  </Text>
);

// ── Record Grid shared by both screens ───────────────────────────────────────
const RecordGrid = ({
  group,
  isPending = false,
}: {
  group: any;
  isPending?: boolean;
}) => (
  <View className="border border-[#EDE0E0] rounded overflow-hidden bg-[#FAF7F7]">
    {/* Top row */}
    <View className="flex-row border-b border-[#EDE0E0]">
      {/* Mortality */}
      <View className="flex-1 border-r border-[#EDE0E0] p-3">
        <ColHeader icon="skull" label="Mortality" />
        {group.mortalityRecords?.length > 0 ? (
          group.mortalityRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <Text
                style={[mono, { fontSize: 13, letterSpacing: 0.8 }]}
                className="text-[#8C6A6A]"
              >
                {rec.date}
              </Text>
              <AmPmRow
                am={rec.ua_am}
                pm={rec.ua_pm}
                color={isPending ? "#C0392B" : "#1A0505"}
              />
              <Text
                style={[mono, { fontSize: 13 }]}
                className="text-[#8C6A6A] mt-1"
                numberOfLines={1}
              >
                {rec.reason}
              </Text>
            </LogCard>
          ))
        ) : isPending ? (
          <NoPending />
        ) : (
          <NoLogs />
        )}
      </View>

      {/* Feeds */}
      <View className="flex-1 p-3">
        <ColHeader icon="nutrition" label="Feeds" />
        {group.feedRecords?.length > 0 ? (
          group.feedRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <Text
                style={[mono, { fontSize: 13, letterSpacing: 0.8 }]}
                className="text-[#8C6A6A]"
              >
                {rec.date}
              </Text>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  },
                ]}
                className="text-[#3B0A0A] mt-0.5"
                numberOfLines={1}
              >
                {rec.feedType}
              </Text>
              <AmPmRow
                am={rec.ua_am}
                pm={rec.ua_pm}
                color={isPending ? "#D35400" : "#1A0505"}
              />
              <Text
                style={[mono, { fontSize: 13 }]}
                className="text-[#8C6A6A] mt-1"
                numberOfLines={1}
              >
                {rec.remarks}
              </Text>
            </LogCard>
          ))
        ) : isPending ? (
          <NoPending />
        ) : (
          <NoLogs />
        )}
      </View>
    </View>

    {/* Bottom row */}
    <View className="flex-row">
      {/* Vitamins */}
      <View className="flex-1 border-r border-[#EDE0E0] p-3">
        <ColHeader icon="medkit" label="Vitamins" />
        {group.vitaminRecords?.length > 0 ? (
          group.vitaminRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <Text
                style={[mono, { fontSize: 13, letterSpacing: 0.8 }]}
                className="text-[#8C6A6A]"
              >
                {rec.date}
              </Text>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  },
                ]}
                className="text-[#3B0A0A] mt-0.5"
                numberOfLines={1}
              >
                {rec.vitaminName}
              </Text>
              <AmPmRow
                am={rec.ua_am}
                pm={rec.ua_pm}
                color={isPending ? "#27AE60" : "#1A0505"}
              />
              {(rec.water_am > 0 || rec.water_pm > 0) && (
                <View className="flex-row items-center mt-1.5 gap-1">
                  <Ionicons name="water" size={9} color="#2471A3" />
                  <Text
                    style={[mono, { fontSize: 13 }]}
                    className="text-[#2471A3]"
                  >
                    {rec.water_am}
                    <Text className="text-[#8C6A6A]"> am</Text>
                    {"  "}·{"  "}
                    {rec.water_pm}
                    <Text className="text-[#8C6A6A]"> pm L</Text>
                  </Text>
                </View>
              )}
              <Text
                style={[mono, { fontSize: 13 }]}
                className="text-[#8C6A6A] mt-1"
                numberOfLines={1}
              >
                {rec.remarks}
              </Text>
            </LogCard>
          ))
        ) : isPending ? (
          <NoPending />
        ) : (
          <NoLogs />
        )}
      </View>

      {/* Weights */}
      <View className="flex-1 p-3">
        <ColHeader icon="scale" label="Weights" />
        {group.weightRecords?.length > 0 ? (
          group.weightRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <View className="flex-row justify-between items-center">
                <Text
                  style={[mono, { fontSize: 13, letterSpacing: 0.8 }]}
                  className="text-[#8C6A6A]"
                >
                  {rec.date}
                </Text>
                <View className="bg-[#F5EDED] border border-[#EDE0E0] rounded px-1.5 py-0.5">
                  <Text
                    style={[mono, { fontSize: 13, letterSpacing: 0.8 }]}
                    className="text-[#3B0A0A]"
                  >
                    D{rec.batchDay}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-baseline gap-0.5 mt-1">
                <Text style={[font("700"), { fontSize: 15, color: "#1A0505" }]}>
                  {rec.averageWeight}
                </Text>
                <Text
                  style={[mono, { fontSize: 13 }]}
                  className="text-[#8C6A6A]"
                >
                  g
                </Text>
              </View>
              <Text
                style={[mono, { fontSize: 13 }]}
                className="text-[#8C6A6A] mt-1"
                numberOfLines={1}
              >
                {rec.remarks}
              </Text>
            </LogCard>
          ))
        ) : isPending ? (
          <NoPending />
        ) : (
          <NoLogs />
        )}
      </View>
    </View>
  </View>
);

// ── PendingApprovals ──────────────────────────────────────────────────────────
const PendingApprovals = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rawBatches, setRawBatches] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [groupedRecords, setGroupedRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState("approve");
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [mortalityToDeduct, setMortalityToDeduct] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubUsers = onValue(ref(db, "users"), (snapshot) => {
      if (snapshot.exists()) setUsersMap(snapshot.val());
    });

    const unsubBatches = onValue(ref(db, "global_batches"), (snapshot) => {
      if (snapshot.exists()) {
        const batches = snapshot.val();
        setRawBatches(batches);
        const groups: any = {};

        Object.entries(batches).forEach(
          ([batchId, batchData]: [string, any]) => {
            const addGroup = (
              penName: string,
              logId: string,
              log: any,
              logType: string,
            ) => {
              if (!penName.toLowerCase().includes("pen")) return;
              if (
                log.status !== "not approved" &&
                log.status !== "pending_approval"
              )
                return;
              const normPen = penName.trim().toLowerCase();
              const groupKey = `${batchId}_${normPen}`;
              if (!groups[groupKey]) {
                groups[groupKey] = {
                  id: groupKey,
                  batchId,
                  batchName: batchData.batchName || "Unknown Batch",
                  displayPen: penName.trim(),
                  recordedBy: log.recordedBy || null,
                  mortalityRecords: [],
                  feedRecords: [],
                  vitaminRecords: [],
                  weightRecords: [],
                  timestamp: log.timestamp || 0,
                };
              }
              if (!groups[groupKey].recordedBy && log.recordedBy)
                groups[groupKey].recordedBy = log.recordedBy;
              if (log.timestamp > groups[groupKey].timestamp)
                groups[groupKey].timestamp = log.timestamp;

              if (
                logType === "mortality" &&
                !groups[groupKey].mortalityRecords.some(
                  (r: any) => r.id === logId,
                )
              ) {
                groups[groupKey].mortalityRecords.push({
                  id: logId,
                  date: log.dateLabel || "Unknown Date",
                  ua_am: Number(log.ua_am ?? log.am ?? 0),
                  ua_pm: Number(log.ua_pm ?? log.pm ?? 0),
                  reason: log.reason || "No reason",
                });
              }
              if (
                logType === "feed" &&
                !groups[groupKey].feedRecords.some((r: any) => r.id === logId)
              ) {
                groups[groupKey].feedRecords.push({
                  id: logId,
                  date: log.dateLabel || "Unknown Date",
                  feedType: log.feedType || "Unknown",
                  ua_am: Number(log.ua_am ?? log.am ?? 0),
                  ua_pm: Number(log.ua_pm ?? log.pm ?? 0),
                  remarks: log.remarks || "",
                });
              }
              if (
                logType === "vitamin" &&
                !groups[groupKey].vitaminRecords.some(
                  (r: any) => r.id === logId,
                )
              ) {
                groups[groupKey].vitaminRecords.push({
                  id: logId,
                  date: log.dateLabel || "Unknown Date",
                  vitaminName: log.vitaminName || "Unknown",
                  ua_am: Number(log.ua_am ?? log.am ?? 0),
                  ua_pm: Number(log.ua_pm ?? log.pm ?? 0),
                  water_am: Number(log.water_am ?? 0),
                  water_pm: Number(log.water_pm ?? 0),
                  remarks: log.remarks || "",
                });
              }
              if (
                logType === "weight" &&
                !groups[groupKey].weightRecords.some((r: any) => r.id === logId)
              ) {
                groups[groupKey].weightRecords.push({
                  id: logId,
                  date: log.dateLabel || "Unknown Date",
                  batchDay: log.batchDay || "--",
                  averageWeight: Number(log.averageWeight ?? 0),
                  remarks: log.remarks || "",
                });
              }
            };

            if (batchData.mortality_logs)
              Object.entries(batchData.mortality_logs).forEach(
                ([pen, logs]: any) =>
                  Object.entries(logs).forEach(([id, log]: any) =>
                    addGroup(pen, id, log, "mortality"),
                  ),
              );
            if (batchData.feed_logs)
              Object.entries(batchData.feed_logs).forEach(([pen, logs]: any) =>
                Object.entries(logs).forEach(([id, log]: any) =>
                  addGroup(pen, id, log, "feed"),
                ),
              );
            if (batchData.vitamin_logs)
              Object.entries(batchData.vitamin_logs).forEach(
                ([pen, logs]: any) =>
                  Object.entries(logs).forEach(([id, log]: any) =>
                    addGroup(pen, id, log, "vitamin"),
                  ),
              );
            if (batchData.weight_logs)
              Object.entries(batchData.weight_logs).forEach(
                ([pen, logs]: any) =>
                  Object.entries(logs).forEach(([id, log]: any) =>
                    addGroup(pen, id, log, "weight"),
                  ),
              );
          },
        );

        setGroupedRecords(
          Object.values(groups).sort(
            (a: any, b: any) => b.timestamp - a.timestamp,
          ) as any,
        );
      } else {
        setGroupedRecords([]);
      }
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubBatches();
    };
  }, []);

  const openApproveModal = (group: any) => {
    let total = 0;
    group.mortalityRecords.forEach((r: any) => {
      total += r.ua_am + r.ua_pm;
    });
    setMortalityToDeduct(total);
    setSelectedGroup(group);
    setModalType("approve");
    setModalVisible(true);
  };

  const openRejectModal = (group: any) => {
    setSelectedGroup(group);
    setModalType("reject");
    setModalVisible(true);
  };

  const closeModal = () => {
    if (isProcessing) return;
    setModalVisible(false);
    setSelectedGroup(null);
  };

  const executeApprove = async () => {
    if (!selectedGroup) return;
    try {
      setIsProcessing(true);
      const updates: any = {};
      const batch = (rawBatches as any)[selectedGroup.batchId];
      const penKeyExact = selectedGroup.displayPen
        .toLowerCase()
        .replace(" ", "_");

      if (mortalityToDeduct > 0) {
        let currentPop =
          batch?.pen_populations?.[penKeyExact] ??
          Math.floor(
            Number(batch?.startingPopulation || 0) /
              Number(batch?.penCount || 1),
          );
        updates[
          `global_batches/${selectedGroup.batchId}/pen_populations/${penKeyExact}`
        ] = Math.max(0, currentPop - mortalityToDeduct);
        let globalPop =
          batch?.livePopulation ?? Number(batch?.startingPopulation || 0);
        updates[`global_batches/${selectedGroup.batchId}/livePopulation`] =
          Math.max(0, globalPop - mortalityToDeduct);
      }

      const expenseBalances: any = {};
      if (batch?.expenses)
        Object.entries(batch.expenses).forEach(([id, exp]: any) => {
          expenseBalances[id] = Number(exp.quantity || 0);
        });

      selectedGroup.mortalityRecords.forEach((rec: any) => {
        const base = `global_batches/${selectedGroup.batchId}/mortality_logs/${selectedGroup.displayPen}/${rec.id}`;
        updates[`${base}/am`] = rec.ua_am;
        updates[`${base}/pm`] = rec.ua_pm;
        updates[`${base}/status`] = "approved";
      });

      selectedGroup.feedRecords.forEach((rec: any) => {
        const base = `global_batches/${selectedGroup.batchId}/feed_logs/${selectedGroup.displayPen}/${rec.id}`;
        updates[`${base}/am`] = rec.ua_am;
        updates[`${base}/pm`] = rec.ua_pm;
        updates[`${base}/status`] = "approved";
        let toDeduct = rec.ua_am + rec.ua_pm;
        if (batch?.expenses)
          Object.entries(batch.expenses).forEach(([id, exp]: any) => {
            if (
              exp.category === "Feeds" &&
              (exp.feedType === rec.feedType ||
                exp.itemName === rec.feedType) &&
              toDeduct > 0 &&
              expenseBalances[id] > 0
            ) {
              const d = Math.min(toDeduct, expenseBalances[id]);
              expenseBalances[id] -= d;
              toDeduct -= d;
              updates[
                `global_batches/${selectedGroup.batchId}/expenses/${id}/quantity`
              ] = expenseBalances[id];
            }
          });
      });

      selectedGroup.vitaminRecords?.forEach((rec: any) => {
        const base = `global_batches/${selectedGroup.batchId}/vitamin_logs/${selectedGroup.displayPen}/${rec.id}`;
        updates[`${base}/am`] = rec.ua_am;
        updates[`${base}/pm`] = rec.ua_pm;
        updates[`${base}/status`] = "approved";
        let toDeduct = rec.ua_am + rec.ua_pm;
        if (batch?.expenses)
          Object.entries(batch.expenses).forEach(([id, exp]: any) => {
            if (
              exp.category === "Vitamins" &&
              exp.itemName === rec.vitaminName &&
              toDeduct > 0 &&
              expenseBalances[id] > 0
            ) {
              const d = Math.min(toDeduct, expenseBalances[id]);
              expenseBalances[id] -= d;
              toDeduct -= d;
              updates[
                `global_batches/${selectedGroup.batchId}/expenses/${id}/quantity`
              ] = expenseBalances[id];
            }
          });
      });

      let latestWeight = 0;
      selectedGroup.weightRecords?.forEach((rec: any) => {
        updates[
          `global_batches/${selectedGroup.batchId}/weight_logs/${selectedGroup.displayPen}/${rec.id}/status`
        ] = "approved";
        if (rec.averageWeight > latestWeight) latestWeight = rec.averageWeight;
      });
      if (latestWeight > 0)
        updates[
          `global_batches/${selectedGroup.batchId}/pen_weights/${penKeyExact}`
        ] = latestWeight;

      await update(ref(db), updates);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      closeModal();
    }
  };

  const executeReject = async () => {
    if (!selectedGroup) return;
    try {
      setIsProcessing(true);
      const updates: any = {};
      selectedGroup.mortalityRecords.forEach((r: any) => {
        updates[
          `global_batches/${selectedGroup.batchId}/mortality_logs/${selectedGroup.displayPen}/${r.id}/status`
        ] = "rejected";
      });
      selectedGroup.feedRecords.forEach((r: any) => {
        updates[
          `global_batches/${selectedGroup.batchId}/feed_logs/${selectedGroup.displayPen}/${r.id}/status`
        ] = "rejected";
      });
      selectedGroup.vitaminRecords?.forEach((r: any) => {
        updates[
          `global_batches/${selectedGroup.batchId}/vitamin_logs/${selectedGroup.displayPen}/${r.id}/status`
        ] = "rejected";
      });
      selectedGroup.weightRecords?.forEach((r: any) => {
        updates[
          `global_batches/${selectedGroup.batchId}/weight_logs/${selectedGroup.displayPen}/${r.id}/status`
        ] = "rejected";
      });
      await update(ref(db), updates);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      closeModal();
    }
  };

  if (loading)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
        <Text
          style={[
            mono,
            { fontSize: 13, letterSpacing: 0.2, textTransform: "uppercase" },
          ]}
          className="text-[#8C6A6A] mt-4"
        >
          SYNCING RECORDS...
        </Text>
      </View>
    );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View className="bg-[#3B0A0A] pt-10 pb-5 px-5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded border border-white/20 bg-white/10 items-center justify-center mr-4"
          >
            <Ionicons name="arrow-back" size={18} color="white" />
          </TouchableOpacity>
          <View>
            <Text
              style={[
                mono,
                {
                  fontSize: 13,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                },
              ]}
              className="text-white/60 mb-0.5"
            >
              TECH / APPROVALS
            </Text>
            <Text
              style={[font("700"), { fontSize: 20, letterSpacing: -0.5 }]}
              className="text-white"
            >
              Pending Approvals
            </Text>
          </View>
          {groupedRecords.length > 0 && (
            <View className="ml-auto bg-white rounded px-3 py-1.5 items-center">
              <Text
                style={[font("700"), { fontSize: 18, letterSpacing: -0.5 }]}
                className="text-[#3B0A0A]"
              >
                {groupedRecords.length}
              </Text>
              <Text
                style={[mono, { fontSize: 13, letterSpacing: 1 }]}
                className="text-[#7A3030]"
              >
                PENDING
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── COUNT BAR ─────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-5 py-3 border-b border-[#EDE0E0] bg-[#FAF7F7]">
        <Text
          style={[
            mono,
            { fontSize: 13, letterSpacing: 0.2, textTransform: "uppercase" },
          ]}
          className="text-[#8C6A6A]"
        >
          {groupedRecords.length} SUBMISSION
          {groupedRecords.length !== 1 ? "S" : ""} AWAITING REVIEW
        </Text>
        <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {groupedRecords.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-14 h-14 rounded bg-[#F5EDED] border border-[#EDE0E0] items-center justify-center mb-4">
              <Ionicons name="checkmark-done" size={28} color="#3B0A0A" />
            </View>
            <Text
              style={[font("700"), { fontSize: 16 }]}
              className="text-[#1A0505]"
            >
              All caught up!
            </Text>
            <Text
              style={[mono, { fontSize: 14, letterSpacing: 1 }]}
              className="text-[#8C6A6A] mt-2 text-center"
            >
              NO PENDING LOGS RIGHT NOW
            </Text>
          </View>
        ) : (
          groupedRecords.map((group: any) => {
            const submitter = (usersMap as any)[group.recordedBy] || {};
            const fullName =
              submitter.fullName || submitter.firstName || "Unknown User";
            const profileImage =
              submitter.profileImage || submitter.profilePicture;
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B0A0A&color=fff&bold=true`;

            return (
              <View
                key={group.id}
                className="bg-white border border-[#EDE0E0] rounded overflow-hidden mb-4"
                style={{ borderLeftWidth: 2, borderLeftColor: "#3B0A0A" }}
              >
                {/* Card header */}
                <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-[#EDE0E0]">
                  <View className="flex-row items-center flex-1 mr-3">
                    <View className="w-10 h-10 rounded bg-[#F5EDED] border border-[#EDE0E0] overflow-hidden items-center justify-center mr-3">
                      <Image
                        source={{ uri: profileImage || fallbackAvatar }}
                        className="w-full h-full"
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={[
                          font("700"),
                          { fontSize: 14, letterSpacing: -0.2 },
                        ]}
                        className="text-[#1A0505]"
                        numberOfLines={1}
                      >
                        {fullName}
                      </Text>
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 13,
                            letterSpacing: 0.2,
                            textTransform: "uppercase",
                          },
                        ]}
                        className="text-[#8C6A6A] mt-0.5"
                        numberOfLines={1}
                      >
                        {group.batchName} · {group.displayPen}
                      </Text>
                    </View>
                  </View>
                  {/* Action required tag */}
                  <View className="bg-[#F5EDED] border border-[#EDE0E0] rounded px-2.5 py-1.5">
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0.2,
                          textTransform: "uppercase",
                        },
                      ]}
                      className="text-[#3B0A0A]"
                    >
                      REVIEW
                    </Text>
                  </View>
                </View>

                {/* 2×2 grid */}
                <View className="p-3">
                  <RecordGrid group={group} isPending={true} />
                </View>

                {/* Action buttons */}
                <View className="flex-row gap-2 px-3 pb-3">
                  <TouchableOpacity
                    onPress={() => openRejectModal(group)}
                    className="flex-1 py-3 border border-[#EDE0E0] rounded items-center"
                  >
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0.2,
                          textTransform: "uppercase",
                        },
                      ]}
                      className="text-[#8C6A6A]"
                    >
                      REJECT
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openApproveModal(group)}
                    className="flex-[2] py-3 bg-[#3B0A0A] rounded items-center flex-row justify-center gap-1.5"
                  >
                    <Ionicons name="checkmark-done" size={14} color="white" />
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0.2,
                          textTransform: "uppercase",
                        },
                      ]}
                      className="text-white"
                    >
                      APPROVE ALL
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── CONFIRMATION MODAL ────────────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white border border-[#EDE0E0] rounded w-full max-w-sm overflow-hidden">
            <View className="h-0.5 bg-[#3B0A0A]" />
            <View className="p-6 items-center">
              <View className="w-14 h-14 rounded bg-[#F5EDED] border border-[#EDE0E0] items-center justify-center mb-4">
                <Ionicons
                  name={modalType === "approve" ? "checkmark-done" : "close"}
                  size={28}
                  color="#3B0A0A"
                />
              </View>
              <Text
                style={[font("700"), { fontSize: 18, letterSpacing: -0.3 }]}
                className="text-[#1A0505] mb-2 text-center"
              >
                {modalType === "approve"
                  ? "Approve Submission?"
                  : "Reject Records?"}
              </Text>
              <Text
                style={[
                  mono,
                  { fontSize: 14, letterSpacing: 0.5, lineHeight: 15 },
                ]}
                className="text-[#8C6A6A] text-center mb-2"
              >
                {modalType === "approve"
                  ? `Approve all pending logs for ${selectedGroup?.displayPen}?`
                  : `Discard all pending logs for ${selectedGroup?.displayPen}?`}
              </Text>
              {modalType === "approve" && mortalityToDeduct > 0 && (
                <View className="bg-[#F5EDED] border border-[#EDE0E0] rounded px-4 py-2.5 mt-1 mb-1 w-full">
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.2,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-[#3B0A0A] text-center"
                  >
                    DEDUCTS {mortalityToDeduct} HEADS FROM LIVE POPULATION
                  </Text>
                </View>
              )}
              <View className="flex-row gap-2.5 w-full mt-4">
                <TouchableOpacity
                  onPress={closeModal}
                  disabled={isProcessing}
                  className="flex-1 py-3 border border-[#EDE0E0] rounded items-center"
                >
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
                    CANCEL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={
                    modalType === "approve" ? executeApprove : executeReject
                  }
                  disabled={isProcessing}
                  className="flex-[1.5] py-3 bg-[#3B0A0A] rounded items-center"
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 14,
                          letterSpacing: 0.2,
                        },
                      ]}
                      className="text-white"
                    >
                      {modalType === "approve" ? "YES, APPROVE" : "YES, REJECT"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PendingApprovals;
