import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "./firebaseConfig";

// ── Design System Helpers ─────────────────────────────────────────────────────
const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

const TYPE_META: Record<string, { color: string; icon: any; unit: string }> = {
  Mortality: { color: "#C0392B", icon: "skull", unit: "hd" },
  Feeds: { color: "#D35400", icon: "nutrition", unit: "kg" },
  Vitamins: { color: "#27AE60", icon: "medkit", unit: "dose" },
  Water: { color: "#2471A3", icon: "water", unit: "L" },
  Weight: { color: "#7D3C98", icon: "scale", unit: "g" },
  "Used Items": { color: "#0E7490", icon: "construct", unit: "pcs" },
};

const TYPES = Object.keys(TYPE_META);

// ── Stat Block Component ──────────────────────────────────────────────────────
const StatCard = ({ label, value, unit, color }: any) => (
  <View
    className="flex-1 bg-white border border-[#EDE0E0] rounded-xl p-4 items-center shadow-sm"
    style={{ minWidth: "45%" }}
  >
    <Text
      style={[mono, { fontSize: 14, letterSpacing: 1.5 }]}
      className="text-[#8C6A6A] mb-2 uppercase"
    >
      {label}
    </Text>
    <Text style={[font("700"), { fontSize: 28, color, letterSpacing: -1 }]}>
      {(value || 0).toLocaleString()}
    </Text>
    <Text style={[mono, { fontSize: 14 }]} className="text-[#8C6A6A] mt-1">
      {unit}
    </Text>
  </View>
);

const PersonnelRecords = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assignedPen, setAssignedPen] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchIdx, setSelectedBatchIdx] = useState(0);
  const [selectedType, setSelectedType] = useState<string>("All");

  // 1. Fetch User's Assigned Pen & All Batches
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch User Profile
    onValue(ref(db, `users/${user.uid}`), (userSnap) => {
      if (userSnap.exists()) {
        const pen = userSnap.val().assignedPen; // e.g. "Pen 1"
        setAssignedPen(pen);

        // Fetch Batches once we know the pen
        onValue(ref(db, "global_batches"), (batchSnap) => {
          if (batchSnap.exists()) {
            const data = batchSnap.val();
            const list = Object.keys(data)
              .map((key) => ({ id: key, ...data[key] }))
              .sort(
                (a: any, b: any) =>
                  new Date(b.dateCreated).getTime() -
                  new Date(a.dateCreated).getTime(),
              );
            setBatches(list);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const batch = batches[selectedBatchIdx];

  // 2. Filter Records strictly by the Personnel's Assigned Pen
  const records = (() => {
    if (!batch || !assignedPen) return [];
    const flat: any[] = [];

    const getLogsForMyPen = (logNode: any, callback: Function) => {
      if (!logNode) return;
      // Match the assignedPen key specifically
      const logs = logNode[assignedPen] || logNode[assignedPen.toLowerCase()];
      if (logs) {
        Object.entries(logs).forEach(([logId, log]: any) => {
          if (log.status === "approved") {
            callback(log, logId);
          }
        });
      }
    };

    // Extract Data
    getLogsForMyPen(batch.mortality_logs, (l: any, id: string) => {
      const total = Number(l.am || 0) + Number(l.pm || 0);
      flat.push({
        id,
        type: "Mortality",
        date: l.dateLabel || l.date,
        subtitle: `${total} hd (${l.am || 0} am · ${l.pm || 0} pm)`,
        ts: l.timestamp || 0,
      });
    });

    getLogsForMyPen(batch.feed_logs, (l: any, id: string) => {
      const total = Number(l.am || 0) + Number(l.pm || 0);
      flat.push({
        id,
        type: "Feeds",
        date: l.dateLabel || l.date,
        subtitle: `${l.feedType || "Feed"}: ${total} kg`,
        ts: l.timestamp || 0,
      });
    });

    const vLogs = batch.vitamin_logs || batch.daily_vitamin_logs;
    getLogsForMyPen(vLogs, (l: any, id: string) => {
      const vT =
        Number(l.am || l.am_amount || 0) + Number(l.pm || l.pm_amount || 0);
      if (vT > 0)
        flat.push({
          id: `v-${id}`,
          type: "Vitamins",
          date: l.dateLabel || l.date,
          subtitle: `${l.vitaminName || "Vit"}: ${vT} dose`,
          ts: l.timestamp || 0,
        });
      const wT = Number(l.water_am || 0) + Number(l.water_pm || 0);
      if (wT > 0)
        flat.push({
          id: `w-${id}`,
          type: "Water",
          date: l.dateLabel || l.date,
          subtitle: `Watering: ${wT} L`,
          ts: l.timestamp || 0,
        });
    });

    getLogsForMyPen(batch.weight_logs, (l: any, id: string) => {
      flat.push({
        id,
        type: "Weight",
        date: l.dateLabel || l.date,
        subtitle: `Avg ${l.averageWeight}g (Day ${l.batchDay || "--"})`,
        ts: l.timestamp || 0,
      });
    });

    getLogsForMyPen(batch.item_logs, (l: any, id: string) => {
      const total = Number(l.ua_am || 0) + Number(l.ua_pm || 0);
      flat.push({
        id,
        type: "Used Items",
        date: l.dateLabel || l.date,
        subtitle: `${l.itemName}: ${total} ${l.unit || "pcs"}`,
        ts: l.timestamp || 0,
      });
    });

    return flat
      .filter((r) => selectedType === "All" || r.type === selectedType)
      .sort((a, b) => b.ts - a.ts);
  })();

  // 3. Totals for the Top Cards
  const penSummary = (() => {
    const sum = { mortality: 0, feed: 0, vitamins: 0 };
    records.forEach((r) => {
      if (r.type === "Mortality") sum.mortality += parseInt(r.subtitle);
      if (r.type === "Feeds") sum.feed += parseFloat(r.subtitle.split(": ")[1]);
      if (r.type === "Vitamins")
        sum.vitamins += parseFloat(r.subtitle.split(": ")[1]);
    });
    return sum;
  })();

  if (loading)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
        <Text
          style={[mono, { fontSize: 14, marginTop: 10 }]}
          className="text-[#8C6A6A]"
        >
          Syncing records...
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
            className="w-10 h-10 rounded border border-white/20 bg-white/10 items-center justify-center mr-4"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text
              style={[mono, { fontSize: 14, letterSpacing: 2 }]}
              className="text-white/60 mb-1 uppercase"
            >
              Personnel / History
            </Text>
            <Text
              style={[font("700"), { fontSize: 24, letterSpacing: -0.5 }]}
              className="text-white"
            >
              {assignedPen || "My Records"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* ── BATCH SELECTOR ──────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-[#EDE0E0] bg-[#FAF7F7]"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 14,
            gap: 10,
          }}
        >
          {batches.map((b: any, idx: number) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => setSelectedBatchIdx(idx)}
              className={`rounded-lg px-5 py-3 border ${idx === selectedBatchIdx ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-white border-[#EDE0E0]"}`}
            >
              <Text
                style={[
                  mono,
                  {
                    fontSize: 15,
                    color: idx === selectedBatchIdx ? "white" : "#8C6A6A",
                  },
                ]}
              >
                {b.batchName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="px-5 mt-6">
          {/* ── TOP STATS ─────────────────────────────────────────────────── */}
          <View className="flex-row gap-3 mb-6 flex-wrap">
            <StatCard
              label="Mortality"
              value={penSummary.mortality}
              unit="hd"
              color="#C0392B"
            />
            <StatCard
              label="Feeds"
              value={penSummary.feed}
              unit="kg"
              color="#D35400"
            />
          </View>

          {/* ── TYPE FILTERS ──────────────────────────────────────────────── */}
          <View className="flex-row items-center mb-4">
            <Text
              style={[mono, { fontSize: 14, letterSpacing: 1 }]}
              className="text-[#8C6A6A] uppercase"
            >
              Filter by type
            </Text>
            <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {["All", ...TYPES].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                className={`px-4 py-2 rounded-full border ${selectedType === t ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-white border-[#EDE0E0]"}`}
              >
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 14,
                      color: selectedType === t ? "white" : "#8C6A6A",
                    },
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── RECORDS LIST ──────────────────────────────────────────────── */}
          <View className="mt-6">
            <View className="flex-row items-center mb-4">
              <Text
                style={[mono, { fontSize: 14, letterSpacing: 2 }]}
                className="text-[#8C6A6A] uppercase"
              >
                Activity log
              </Text>
              <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
            </View>

            {records.length === 0 ? (
              <View className="items-center py-16 border border-[#EDE0E0] rounded-2xl bg-[#FAF7F7]">
                <Ionicons
                  name="document-text-outline"
                  size={40}
                  color="#D4B8B8"
                />
                <Text
                  style={[mono, { fontSize: 14 }]}
                  className="text-[#8C6A6A] mt-4 uppercase"
                >
                  No approved records found
                </Text>
              </View>
            ) : (
              records.map((item) => (
                <View
                  key={item.id}
                  className="bg-white border border-[#EDE0E0] rounded-xl mb-3 overflow-hidden shadow-sm"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: TYPE_META[item.type]?.color || "#3B0A0A",
                  }}
                >
                  <View className="flex-row items-center p-4">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mr-4"
                      style={{
                        backgroundColor: `${TYPE_META[item.type]?.color}15`,
                      }}
                    >
                      <Ionicons
                        name={TYPE_META[item.type]?.icon || "document"}
                        size={18}
                        color={TYPE_META[item.type]?.color}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={[
                          font("700"),
                          { fontSize: 15, color: "#1A0505" },
                        ]}
                      >
                        {item.subtitle}
                      </Text>
                      <Text
                        style={[
                          mono,
                          { fontSize: 14, color: "#8C6A6A", marginTop: 2 },
                        ]}
                      >
                        {item.date}
                      </Text>
                    </View>
                    <View className="px-2 py-1 bg-gray-50 border border-gray-100 rounded">
                      <Text
                        style={[mono, { fontSize: 13, color: "#8C6A6A" }]}
                        className="uppercase"
                      >
                        {item.type}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PersonnelRecords;
