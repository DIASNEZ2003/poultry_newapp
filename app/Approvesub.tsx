import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "./firebaseConfig";

const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

// ── Shared helpers ────────────────────────────────────────────────────────────
const ColHeader = ({ icon, label }: { icon: any; label: string }) => (
  <View className="flex-row items-center mb-2.5">
    <Ionicons name={icon} size={13} color="#8C6A6A" />
    <Text
      style={[
        mono,
        { fontSize: 13, letterSpacing: 0.2, textTransform: "uppercase" },
      ]}
      className="text-[#8C6A6A] ml-1.5"
    >
      {label}
    </Text>
  </View>
);

const LogCard = ({ children }: { children: React.ReactNode }) => (
  <View className="bg-white border border-[#EDE0E0] rounded p-2.5 mb-2">
    {children}
  </View>
);

const AmPmRow = ({ am, pm }: { am: number; pm: number }) => (
  <View className="flex-row items-baseline gap-1 mt-0.5">
    <Text style={[font("700"), { fontSize: 15, color: "#1A0505" }]}>{am}</Text>
    <Text style={[mono, { fontSize: 13 }]} className="text-[#8C6A6A]">
      am
    </Text>
    <Text style={[mono, { fontSize: 13 }]} className="text-[#D4B8B8] mx-0.5">
      ·
    </Text>
    <Text style={[font("700"), { fontSize: 15, color: "#1A0505" }]}>{pm}</Text>
    <Text style={[mono, { fontSize: 13 }]} className="text-[#8C6A6A]">
      pm
    </Text>
  </View>
);

const NoLogs = () => (
  <Text
    style={[mono, { fontSize: 13, letterSpacing: 1 }]}
    className="text-[#D4B8B8] italic mt-1"
  >
    NO LOGS
  </Text>
);

const ApprovedGrid = ({ group }: { group: any }) => (
  <View className="border border-[#EDE0E0] rounded overflow-hidden bg-[#FAF7F7]">
    {/* Top row */}
    <View className="flex-row border-b border-[#EDE0E0]">
      <View className="flex-1 border-r border-[#EDE0E0] p-3">
        <ColHeader icon="skull" label="Mortality" />
        {group.mortalityRecords?.length > 0 ? (
          group.mortalityRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <AmPmRow am={rec.ua_am} pm={rec.ua_pm} />
              <Text
                style={[mono, { fontSize: 13 }]}
                className="text-[#8C6A6A] mt-1"
                numberOfLines={1}
              >
                {rec.reason}
              </Text>
            </LogCard>
          ))
        ) : (
          <NoLogs />
        )}
      </View>
      <View className="flex-1 p-3">
        <ColHeader icon="nutrition" label="Feeds" />
        {group.feedRecords?.length > 0 ? (
          group.feedRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  },
                ]}
                className="text-[#3B0A0A] mb-0.5"
                numberOfLines={1}
              >
                {rec.feedType}
              </Text>
              <AmPmRow am={rec.ua_am} pm={rec.ua_pm} />
              <Text
                style={[mono, { fontSize: 13 }]}
                className="text-[#8C6A6A] mt-1"
                numberOfLines={1}
              >
                {rec.remarks}
              </Text>
            </LogCard>
          ))
        ) : (
          <NoLogs />
        )}
      </View>
    </View>

    {/* Bottom row */}
    <View className="flex-row">
      <View className="flex-1 border-r border-[#EDE0E0] p-3">
        <ColHeader icon="medkit" label="Vitamins" />
        {group.vitaminRecords?.length > 0 ? (
          group.vitaminRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  },
                ]}
                className="text-[#3B0A0A] mb-0.5"
                numberOfLines={1}
              >
                {rec.vitaminName}
              </Text>
              <AmPmRow am={rec.ua_am} pm={rec.ua_pm} />
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
        ) : (
          <NoLogs />
        )}
      </View>
      <View className="flex-1 p-3">
        <ColHeader icon="scale" label="Weights" />
        {group.weightRecords?.length > 0 ? (
          group.weightRecords.map((rec: any) => (
            <LogCard key={rec.id}>
              <View className="flex-row justify-between items-center">
                <View className="bg-[#F5EDED] border border-[#EDE0E0] rounded px-1.5 py-0.5 mb-1">
                  <Text
                    style={[mono, { fontSize: 13, letterSpacing: 0.8 }]}
                    className="text-[#3B0A0A]"
                  >
                    D{rec.batchDay}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-baseline gap-0.5 mt-0.5">
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
        ) : (
          <NoLogs />
        )}
      </View>
    </View>
  </View>
);

// ── Approvesub ────────────────────────────────────────────────────────────────
const Approvesub = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All"); // New State for Pen Category
  const [usersMap, setUsersMap] = useState({});
  const [groupedDates, setGroupedDates] = useState([]);
  const [availablePens, setAvailablePens] = useState<string[]>([]); // To dynamically hold Pen 1, Pen 2, etc.

  useEffect(() => {
    const unsubUsers = onValue(ref(db, "users"), (snapshot) => {
      if (snapshot.exists()) setUsersMap(snapshot.val());
    });

    const unsubBatches = onValue(ref(db, "global_batches"), (snapshot) => {
      if (snapshot.exists()) {
        const batches = snapshot.val();

        const datesMap: any = {};
        const pensSet = new Set<string>(); // Keep track of unique pens

        Object.entries(batches).forEach(
          ([batchId, batchData]: [string, any]) => {
            const addGroup = (
              penName: string,
              logId: string,
              log: any,
              logType: string,
            ) => {
              if (!penName.toLowerCase().includes("pen")) return;
              if (log.status !== "approved") return;

              const cleanPenName = penName.trim();
              pensSet.add(cleanPenName); // Add to our unique list

              const dateKey = log.dateLabel || "Unknown Date";

              if (!datesMap[dateKey]) {
                datesMap[dateKey] = {
                  timestamp: log.timestamp || 0,
                  pens: {},
                };
              }

              if (log.timestamp > datesMap[dateKey].timestamp) {
                datesMap[dateKey].timestamp = log.timestamp;
              }

              const normPen = cleanPenName.toLowerCase();
              const groupKey = `${batchId}_${normPen}`;

              if (!datesMap[dateKey].pens[groupKey]) {
                datesMap[dateKey].pens[groupKey] = {
                  id: groupKey,
                  batchId,
                  batchName: batchData.batchName || "Unknown Batch",
                  displayPen: cleanPenName,
                  recordedBy: log.recordedBy || null,
                  mortalityRecords: [],
                  feedRecords: [],
                  vitaminRecords: [],
                  weightRecords: [],
                  timestamp: log.timestamp || 0,
                };
              }

              const penGroup = datesMap[dateKey].pens[groupKey];

              if (!penGroup.recordedBy && log.recordedBy)
                penGroup.recordedBy = log.recordedBy;
              if (log.timestamp > penGroup.timestamp)
                penGroup.timestamp = log.timestamp;

              if (
                logType === "mortality" &&
                !penGroup.mortalityRecords.some((r: any) => r.id === logId)
              )
                penGroup.mortalityRecords.push({
                  id: logId,
                  ua_am: Number(log.ua_am ?? log.am ?? 0),
                  ua_pm: Number(log.ua_pm ?? log.pm ?? 0),
                  reason: log.reason || "",
                  timestamp: log.timestamp || 0,
                });
              if (
                logType === "feed" &&
                !penGroup.feedRecords.some((r: any) => r.id === logId)
              )
                penGroup.feedRecords.push({
                  id: logId,
                  feedType: log.feedType || "Unknown",
                  ua_am: Number(log.ua_am ?? log.am ?? 0),
                  ua_pm: Number(log.ua_pm ?? log.pm ?? 0),
                  remarks: log.remarks || "",
                  timestamp: log.timestamp || 0,
                });
              if (
                logType === "vitamin" &&
                !penGroup.vitaminRecords.some((r: any) => r.id === logId)
              )
                penGroup.vitaminRecords.push({
                  id: logId,
                  vitaminName: log.vitaminName || "Unknown",
                  ua_am: Number(log.ua_am ?? log.am ?? 0),
                  ua_pm: Number(log.ua_pm ?? log.pm ?? 0),
                  water_am: Number(log.water_am ?? 0),
                  water_pm: Number(log.water_pm ?? 0),
                  remarks: log.remarks || "",
                  timestamp: log.timestamp || 0,
                });
              if (
                logType === "weight" &&
                !penGroup.weightRecords.some((r: any) => r.id === logId)
              )
                penGroup.weightRecords.push({
                  id: logId,
                  batchDay: log.batchDay || "--",
                  averageWeight: Number(log.averageWeight ?? 0),
                  remarks: log.remarks || "",
                  timestamp: log.timestamp || 0,
                });
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

        // Convert the datesMap to a sorted array, and sub-group by batch
        const result = Object.entries(datesMap)
          .map(([date, dateData]: any) => {
            const allPensForDate = Object.values(dateData.pens);

            const batchesMap: any = {};
            allPensForDate.forEach((penGroup: any) => {
              const batchName = penGroup.batchName || "Unknown Batch";
              if (!batchesMap[batchName]) {
                batchesMap[batchName] = {
                  batchName,
                  pens: [],
                };
              }
              batchesMap[batchName].pens.push(penGroup);
            });

            const sortedBatches = Object.values(batchesMap).map(
              (batchObj: any) => {
                batchObj.pens.forEach((group: any) => {
                  group.mortalityRecords.sort(
                    (a: any, b: any) => b.timestamp - a.timestamp,
                  );
                  group.feedRecords.sort(
                    (a: any, b: any) => b.timestamp - a.timestamp,
                  );
                  group.vitaminRecords.sort(
                    (a: any, b: any) => b.timestamp - a.timestamp,
                  );
                  group.weightRecords.sort(
                    (a: any, b: any) => b.timestamp - a.timestamp,
                  );
                });

                batchObj.pens.sort((a: any, b: any) =>
                  a.displayPen.localeCompare(b.displayPen, undefined, {
                    numeric: true,
                    sensitivity: "base",
                  }),
                );

                return batchObj;
              },
            );

            sortedBatches.sort((a: any, b: any) =>
              a.batchName.localeCompare(b.batchName),
            );

            return {
              date,
              timestamp: dateData.timestamp,
              totalPensForDate: allPensForDate.length,
              batches: sortedBatches,
            };
          })
          .sort((a: any, b: any) => b.timestamp - a.timestamp);

        setGroupedDates(result as any);

        // Sort our unique pens (Pen 1, Pen 2, etc) and set them for the buttons
        const sortedPens = Array.from(pensSet).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
        );
        setAvailablePens(sortedPens);
      } else {
        setGroupedDates([]);
        setAvailablePens([]);
      }
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubBatches();
    };
  }, []);

  // ── FILTERING LOGIC ────────────────────────────────────────────────────────
  const filteredDates = groupedDates
    .map((dateGroup: any) => {
      const q = searchQuery.toLowerCase();

      const filteredBatches = dateGroup.batches
        .map((batch: any) => {
          // Filter by SEARCH and by CATEGORY BUTTON
          const filteredPens = batch.pens.filter((pen: any) => {
            const matchesSearch =
              pen.displayPen.toLowerCase().includes(q) ||
              batch.batchName.toLowerCase().includes(q);

            const matchesCategory =
              selectedCategory === "All" || pen.displayPen === selectedCategory;

            return matchesSearch && matchesCategory;
          });

          return { ...batch, pens: filteredPens };
        })
        .filter((batch: any) => batch.pens.length > 0);

      const newTotal = filteredBatches.reduce(
        (acc: number, b: any) => acc + b.pens.length,
        0,
      );

      return {
        ...dateGroup,
        batches: filteredBatches,
        totalPensForDate: newTotal,
      };
    })
    .filter((dateGroup: any) => dateGroup.batches.length > 0);

  const totalFilteredPens = filteredDates.reduce(
    (acc: number, dateGroup: any) => acc + dateGroup.totalPensForDate,
    0,
  );

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
      <View className="bg-[#3B0A0A] pt-10 pb-4">
        <View className="flex-row items-center px-5 mb-4">
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
              TECH / LOG HISTORY
            </Text>
            <Text
              style={[font("700"), { fontSize: 20, letterSpacing: -0.5 }]}
              className="text-white"
            >
              Approved Records
            </Text>
          </View>
          {totalFilteredPens > 0 && (
            <View className="ml-auto bg-white/10 border border-white/20 rounded px-3 py-1.5 items-center">
              <Text
                style={[font("700"), { fontSize: 18, letterSpacing: -0.5 }]}
                className="text-white"
              >
                {totalFilteredPens}
              </Text>
              <Text
                style={[mono, { fontSize: 13, letterSpacing: 1 }]}
                className="text-white/60"
              >
                PENS
              </Text>
            </View>
          )}
        </View>

        {/* ── SEARCH BAR ───────────────────────────────────────────────────── */}
        <View className="flex-row items-center bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 mx-5 mb-3">
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            placeholder="Search by Batch Name..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-white text-sm"
            style={font("400")}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color="rgba(255,255,255,0.6)"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── CATEGORY BUTTONS (PENS) ──────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-5"
          contentContainerStyle={{ paddingRight: 40 }}
        >
          {/* Default "All" Button */}
          <TouchableOpacity
            onPress={() => setSelectedCategory("All")}
            className={`mr-2 px-4 py-1.5 rounded-full border ${
              selectedCategory === "All"
                ? "bg-white border-white"
                : "bg-transparent border-white/30"
            }`}
          >
            <Text
              style={[
                font(selectedCategory === "All" ? "700" : "400"),
                { fontSize: 13 },
              ]}
              className={
                selectedCategory === "All" ? "text-[#3B0A0A]" : "text-white"
              }
            >
              All Pens
            </Text>
          </TouchableOpacity>

          {/* Dynamic Pen Buttons */}
          {availablePens.map((penName) => (
            <TouchableOpacity
              key={penName}
              onPress={() => setSelectedCategory(penName)}
              className={`mr-2 px-4 py-1.5 rounded-full border ${
                selectedCategory === penName
                  ? "bg-white border-white"
                  : "bg-transparent border-white/30"
              }`}
            >
              <Text
                style={[
                  font(selectedCategory === penName ? "700" : "400"),
                  { fontSize: 13 },
                ]}
                className={
                  selectedCategory === penName ? "text-[#3B0A0A]" : "text-white"
                }
              >
                {penName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── COUNT BAR ─────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-5 py-3 border-b border-[#EDE0E0] bg-[#FAF7F7]">
        <View className="w-1.5 h-1.5 rounded-full bg-[#27AE60] mr-2" />
        <Text
          style={[
            mono,
            { fontSize: 13, letterSpacing: 0.2, textTransform: "uppercase" },
          ]}
          className="text-[#8C6A6A]"
        >
          {searchQuery || selectedCategory !== "All" ? "FOUND " : ""}
          {totalFilteredPens} APPROVED SUBMISSION
          {totalFilteredPens !== 1 ? "S" : ""}
        </Text>
        <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {filteredDates.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-14 h-14 rounded bg-[#FAF7F7] border border-[#EDE0E0] items-center justify-center mb-4">
              <Ionicons
                name="filter-circle-outline"
                size={32}
                color="#D4B8B8"
              />
            </View>
            <Text
              style={[font("700"), { fontSize: 16 }]}
              className="text-[#1A0505]"
            >
              No Matches Found
            </Text>
            <Text
              style={[mono, { fontSize: 14, letterSpacing: 1 }]}
              className="text-[#8C6A6A] mt-2 text-center"
            >
              TRY SELECTING A DIFFERENT CATEGORY OR SEARCH TERM
            </Text>
          </View>
        ) : (
          filteredDates.map((dateGroup: any) => (
            <View key={dateGroup.date} className="mb-6">
              {/* DATE SECTION HEADER */}
              <View className="flex-row items-center bg-[#F5EDED] py-2 px-3 rounded mb-4 border border-[#EDE0E0]">
                <Ionicons name="calendar-outline" size={16} color="#3B0A0A" />
                <Text
                  style={[font("700"), { fontSize: 13, letterSpacing: 0.5 }]}
                  className="text-[#3B0A0A] ml-2"
                >
                  {dateGroup.date}
                </Text>
                <View className="ml-auto bg-white rounded-full px-2 py-0.5 border border-[#EDE0E0]">
                  <Text
                    style={[mono, { fontSize: 13, letterSpacing: 0.5 }]}
                    className="text-[#8C6A6A]"
                  >
                    {dateGroup.totalPensForDate} LOG
                    {dateGroup.totalPensForDate > 1 ? "S" : ""}
                  </Text>
                </View>
              </View>

              {/* BATCH SUBCATEGORY & PENS */}
              {dateGroup.batches.map((batch: any) => (
                <View key={batch.batchName} className="mb-2">
                  {/* CATEGORY / BATCH HEADER */}
                  <View className="flex-row items-center mb-3 ml-2 border-l-2 border-[#8C6A6A] pl-2">
                    <Text
                      style={[
                        font("700"),
                        {
                          fontSize: 14,
                          letterSpacing: 0.2,
                        },
                      ]}
                      className="text-[#8C6A6A]"
                    >
                      {batch.batchName}
                    </Text>
                  </View>

                  {/* PENS (Strictly sorted: Pen 1, Pen 2, Pen 3...) */}
                  {batch.pens.map((group: any) => {
                    const submitter = (usersMap as any)[group.recordedBy] || {};
                    const fullName =
                      submitter.fullName ||
                      submitter.firstName ||
                      "Unknown User";
                    const profileImage =
                      submitter.profileImage || submitter.profilePicture;
                    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      fullName,
                    )}&background=3B0A0A&color=fff&bold=true`;

                    return (
                      <View
                        key={group.id}
                        className="bg-white border border-[#EDE0E0] rounded overflow-hidden mb-4"
                        style={{
                          borderLeftWidth: 2,
                          borderLeftColor: "#27AE60",
                        }}
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
                                {group.displayPen}
                              </Text>
                            </View>
                          </View>
                          {/* Approved badge */}
                          <View className="flex-row items-center bg-[#F0FDF4] border border-[#BBF7D0] rounded px-2.5 py-1.5 gap-1">
                            <Ionicons
                              name="checkmark-circle"
                              size={11}
                              color="#27AE60"
                            />
                            <Text
                              style={[
                                mono,
                                {
                                  fontSize: 13,
                                  letterSpacing: 0.2,
                                  textTransform: "uppercase",
                                },
                              ]}
                              className="text-[#27AE60]"
                            >
                              APPROVED
                            </Text>
                          </View>
                        </View>

                        {/* 2×2 grid */}
                        <View className="p-3">
                          <ApprovedGrid group={group} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Approvesub;
