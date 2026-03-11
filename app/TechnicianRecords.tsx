import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as XLSX from "xlsx";
import { db } from "./firebaseConfig";

const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

// ── Colour map per record type ────────────────────────────────────────────────
const TYPE_META: Record<string, { color: string; icon: any; unit: string }> = {
  Mortality: { color: "#C0392B", icon: "skull", unit: "hd" },
  Feeds: { color: "#D35400", icon: "nutrition", unit: "kg" },
  Vitamins: { color: "#27AE60", icon: "medkit", unit: "dose" },
  Water: { color: "#2471A3", icon: "water", unit: "L" },
  Weight: { color: "#7D3C98", icon: "scale", unit: "g" },
  "Used Items": { color: "#0E7490", icon: "construct", unit: "pcs" },
};

const TYPES = Object.keys(TYPE_META);

// ── Stat mini-block (Now Larger & More Readable) ──────────────────────────────
const PenStat = ({ label, value, unit, color }: any) => (
  <View
    className="flex-1 bg-white border border-[#EDE0E0] rounded-lg p-3.5 items-center"
    style={{ minWidth: 80 }}
  >
    <Text
      style={[
        mono,
        { fontSize: 14, letterSpacing: 0.2, textTransform: "uppercase" },
      ]}
      className="text-[#8C6A6A] mb-1.5"
    >
      {label}
    </Text>
    <Text style={[font("700"), { fontSize: 24, color, letterSpacing: -0.5 }]}>
      {(value || 0).toLocaleString()}
    </Text>
    <Text style={[mono, { fontSize: 14 }]} className="text-[#8C6A6A] mt-0.5">
      {unit}
    </Text>
  </View>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const TechnicianRecords = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchIdx, setSelectedBatchIdx] = useState(0);
  const [selectedPen, setSelectedPen] = useState<number | "all">("all");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, "global_batches"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .sort(
            (a: any, b: any) =>
              new Date(b.dateCreated).getTime() -
              new Date(a.dateCreated).getTime(),
          );
        setBatches(list as any);
      } else {
        setBatches([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const batch = batches[selectedBatchIdx];
  const penCount = Number(batch?.penCount || 5);
  const penNumbers = Array.from({ length: penCount }, (_, i) => i + 1);

  // ── Flatten all approved records for the selected batch + pen ──────────────
  const records = (() => {
    if (!batch) return [];
    const flat: any[] = [];

    const parsePenLogs = (logNode: any, callback: Function) => {
      if (!logNode) return;
      Object.entries(logNode).forEach(([penKey, logs]: any) => {
        const match = penKey.match(/\d+/);
        const penNum = match ? Number(match[0]) : null;
        if (selectedPen !== "all" && penNum !== selectedPen) return;
        Object.entries(logs).forEach(([logId, log]: any) => {
          if (log.status !== "approved") return;
          callback(log, penNum || 0, logId);
        });
      });
    };

    // Mortality
    parsePenLogs(
      batch.mortality_logs,
      (log: any, penNum: number, id: string) => {
        const total = Number(log.am || 0) + Number(log.pm || 0);
        flat.push({
          id: `m-${id}`,
          type: "Mortality",
          penNum,
          date: log.dateLabel || log.date || "",
          subtitle: `${total} heads (${log.am || 0} am · ${log.pm || 0} pm)`,
          timestamp: log.timestamp || 0,
        });
      },
    );

    // Feeds
    parsePenLogs(batch.feed_logs, (log: any, penNum: number, id: string) => {
      const total = Number(log.am || 0) + Number(log.pm || 0);
      flat.push({
        id: `f-${id}`,
        type: "Feeds",
        penNum,
        date: log.dateLabel || log.date || "",
        subtitle: `${log.feedType || "Feed"}: ${total} kg`,
        timestamp: log.timestamp || 0,
      });
    });

    // Vitamins + Water
    const vLogs = batch.vitamin_logs || batch.daily_vitamin_logs;
    parsePenLogs(vLogs, (log: any, penNum: number, id: string) => {
      const vTotal =
        Number(log.am || log.am_amount || 0) +
        Number(log.pm || log.pm_amount || 0);
      if (vTotal > 0)
        flat.push({
          id: `v-${id}`,
          type: "Vitamins",
          penNum,
          date: log.dateLabel || log.date || "",
          subtitle: `${log.vitaminName || "Supplement"}: ${vTotal} dose`,
          timestamp: log.timestamp || 0,
        });
      const wTotal = Number(log.water_am || 0) + Number(log.water_pm || 0);
      if (wTotal > 0)
        flat.push({
          id: `w-${id}`,
          type: "Water",
          penNum,
          date: log.dateLabel || log.date || "",
          subtitle: `Water: ${wTotal} L`,
          timestamp: log.timestamp || 0,
        });
    });

    // Weight
    parsePenLogs(batch.weight_logs, (log: any, penNum: number, id: string) => {
      flat.push({
        id: `wt-${id}`,
        type: "Weight",
        penNum,
        date: log.dateLabel || log.date || "",
        subtitle: `Avg ${log.averageWeight || 0} g — Day ${log.batchDay || "--"}`,
        timestamp: log.timestamp || 0,
      });
    });

    // Used Items
    parsePenLogs(batch.item_logs, (log: any, penNum: number, id: string) => {
      const total = Number(log.ua_am || 0) + Number(log.ua_pm || 0);
      flat.push({
        id: `ui-${id}`,
        type: "Used Items",
        penNum,
        date: log.dateLabel || log.date || "",
        subtitle: `${log.itemName || "Item"}: ${total} ${log.unit || "pcs"}`,
        timestamp: log.timestamp || 0,
      });
    });

    return flat
      .filter((r) => selectedType === "All" || r.type === selectedType)
      .sort((a, b) => b.timestamp - a.timestamp);
  })();

  // ── Per-pen summary stats ─────────────────────────────────────────────────
  const getPenStats = (penNum: number) => {
    if (!batch)
      return {
        mortality: 0,
        feed: 0,
        vitamins: 0,
        water: 0,
        weight: 0,
        usedItems: 0,
      };
    let mortality = 0,
      feed = 0,
      vitamins = 0,
      water = 0,
      weight = 0,
      usedItems = 0;
    const keys = [
      `Pen ${penNum}`,
      `pen ${penNum}`,
      `Pen_${penNum}`,
      `pen_${penNum}`,
    ];
    const match = (k: string) =>
      keys.some((key) => key.toLowerCase() === k.toLowerCase());

    if (batch.mortality_logs)
      Object.entries(batch.mortality_logs).forEach(([k, logs]: any) => {
        if (match(k))
          Object.values(logs).forEach((l: any) => {
            if (l.status === "approved")
              mortality += Number(l.am || 0) + Number(l.pm || 0);
          });
      });
    if (batch.feed_logs)
      Object.entries(batch.feed_logs).forEach(([k, logs]: any) => {
        if (match(k))
          Object.values(logs).forEach((l: any) => {
            if (l.status === "approved")
              feed += Number(l.am || 0) + Number(l.pm || 0);
          });
      });
    const vLogs = batch.vitamin_logs || batch.daily_vitamin_logs;
    if (vLogs)
      Object.entries(vLogs).forEach(([k, logs]: any) => {
        if (match(k))
          Object.values(logs).forEach((l: any) => {
            if (l.status === "approved") {
              vitamins +=
                Number(l.am || l.am_amount || 0) +
                Number(l.pm || l.pm_amount || 0);
              water += Number(l.water_am || 0) + Number(l.water_pm || 0);
            }
          });
      });
    if (batch.weight_logs) {
      let maxW = 0;
      Object.entries(batch.weight_logs).forEach(([k, logs]: any) => {
        if (match(k))
          Object.values(logs).forEach((l: any) => {
            if (l.status === "approved") {
              const w = Number(l.averageWeight || 0);
              if (w > maxW) maxW = w;
            }
          });
      });
      weight = maxW;
    }
    if (batch.item_logs)
      Object.entries(batch.item_logs).forEach(([k, logs]: any) => {
        if (match(k))
          Object.values(logs).forEach((l: any) => {
            if (l.status === "approved")
              usedItems += Number(l.ua_am || 0) + Number(l.ua_pm || 0);
          });
      });
    return { mortality, feed, vitamins, water, weight, usedItems };
  };

  // ── Export to Excel (same sheets as admin Records.jsx) ───────────────────
  const handleExportExcel = async () => {
    if (!batch) return;
    setExporting(true);
    try {
      const bName = batch.batchName || "Batch";
      const mortalityData: any[] = [];
      const feedsData: any[] = [];
      const vitaminsData: any[] = [];
      const waterData: any[] = [];
      const weightData: any[] = [];
      const usedItemsData: any[] = [];
      const expensesData: any[] = [];
      const salesData: any[] = [];

      const extractPenLogs = (logNode: any, callback: Function) => {
        if (!logNode) return;
        Object.entries(logNode).forEach(([penKey, logs]: any) => {
          const match = penKey.match(/\d+/);
          const pLabel = match ? `Pen ${match[0]}` : "All Pens";
          if (
            selectedPen !== "all" &&
            match &&
            Number(match[0]) !== selectedPen
          )
            return;
          Object.entries(logs).forEach(([logId, log]: any) => {
            if (log.status === "approved") callback(log, pLabel, logId);
          });
        });
      };

      extractPenLogs(batch.mortality_logs, (log: any, p: string) =>
        mortalityData.push({
          Batch: bName,
          Pen: p,
          Date: log.dateLabel || log.date || "",
          "AM Deaths": Number(log.am || 0),
          "PM Deaths": Number(log.pm || 0),
          "Total Deaths": Number(log.am || 0) + Number(log.pm || 0),
          "Updated By": log.updaterName || "—",
        }),
      );

      extractPenLogs(batch.feed_logs, (log: any, p: string) =>
        feedsData.push({
          Batch: bName,
          Pen: p,
          Date: log.dateLabel || log.date || "",
          "Feed Type": log.feedType || "Feed",
          "AM (kg)": Number(log.am || 0),
          "PM (kg)": Number(log.pm || 0),
          "Total (kg)": Number(log.am || 0) + Number(log.pm || 0),
          "Updated By": log.updaterName || "—",
        }),
      );

      const vLogs = batch.vitamin_logs || batch.daily_vitamin_logs;
      extractPenLogs(vLogs, (log: any, p: string) => {
        const vAm = Number(log.am || log.am_amount || 0);
        const vPm = Number(log.pm || log.pm_amount || 0);
        if (vAm + vPm > 0)
          vitaminsData.push({
            Batch: bName,
            Pen: p,
            Date: log.dateLabel || log.date || "",
            Vitamin: log.vitaminName || "Supplement",
            "AM Dose": vAm,
            "PM Dose": vPm,
            "Total Dose": vAm + vPm,
            "Updated By": log.updaterName || "—",
          });
        const wAm = Number(log.water_am || 0);
        const wPm = Number(log.water_pm || 0);
        if (wAm + wPm > 0)
          waterData.push({
            Batch: bName,
            Pen: p,
            Date: log.dateLabel || log.date || "",
            "AM Water (L)": wAm,
            "PM Water (L)": wPm,
            "Total (L)": wAm + wPm,
            "Updated By": log.updaterName || "—",
          });
      });

      extractPenLogs(batch.weight_logs, (log: any, p: string) =>
        weightData.push({
          Batch: bName,
          Pen: p,
          Date: log.dateLabel || log.date || "",
          "Avg Weight (g)": Number(log.averageWeight || 0),
          "Batch Day": log.batchDay || "—",
          "Updated By": log.updaterName || "—",
        }),
      );

      extractPenLogs(batch.item_logs, (log: any, p: string) =>
        usedItemsData.push({
          Batch: bName,
          Pen: p,
          Date: log.dateLabel || log.date || "",
          "Item Name": log.itemName || "Item",
          "Amount Used": Number(log.ua_am || 0) + Number(log.ua_pm || 0),
          Unit: log.unit || "pcs",
          Remarks: log.remarks || "",
          "Updated By": log.updaterName || "—",
        }),
      );

      // Expenses & Sales only when viewing all pens
      if (selectedPen === "all") {
        if (batch.expenses)
          Object.values(batch.expenses).forEach((exp: any) =>
            expensesData.push({
              Batch: bName,
              Date: exp.date || "",
              Category: exp.category || "",
              Item: exp.itemName || exp.description || "",
              Quantity: Number(exp.quantity || 0),
              "Amount (PHP)": Number(exp.amount || 0),
            }),
          );
        if (batch.sales)
          Object.values(batch.sales).forEach((sale: any) =>
            salesData.push({
              Batch: bName,
              Date: sale.dateOfPurchase || "",
              Buyer: sale.buyerName || "",
              "Heads Sold": Number(sale.quantity || 0),
              "Total (PHP)": Number(sale.totalAmount || 0),
            }),
          );
      }

      const wb = XLSX.utils.book_new();
      const toSheet = (data: any[]) =>
        XLSX.utils.json_to_sheet(data.length ? data : [{ Message: "No Data" }]);

      XLSX.utils.book_append_sheet(wb, toSheet(mortalityData), "Mortality");
      XLSX.utils.book_append_sheet(wb, toSheet(feedsData), "Feeds");
      XLSX.utils.book_append_sheet(wb, toSheet(vitaminsData), "Vitamins");
      XLSX.utils.book_append_sheet(wb, toSheet(waterData), "Water");
      XLSX.utils.book_append_sheet(wb, toSheet(weightData), "Weight");
      XLSX.utils.book_append_sheet(wb, toSheet(usedItemsData), "Used Items");
      if (selectedPen === "all") {
        XLSX.utils.book_append_sheet(wb, toSheet(expensesData), "Expenses");
        XLSX.utils.book_append_sheet(wb, toSheet(salesData), "Sales");
      }

      const penSlug = selectedPen === "all" ? "AllPens" : `Pen${selectedPen}`;
      const batchSlug = (batch.batchName || "Batch").replace(/\s+/g, "_");
      const fileName = `Farm_Records_${batchSlug}_${penSlug}.xlsx`;

      // Write using expo-file-system/legacy (works on Expo 54)
      const wbBase64: string = XLSX.write(wb, {
        type: "base64",
        bookType: "xlsx",
      });
      const uri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, wbBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: `Export: ${fileName}`,
          UTI: "com.microsoft.excel.xlsx",
        });
      } else {
        Alert.alert("Saved", `File saved to: ${uri}`);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      Alert.alert(
        "Export Failed",
        err.message || "Could not generate the file.",
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading)
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
          LOADING RECORDS...
        </Text>
      </View>
    );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View className="bg-[#3B0A0A] pt-10 pb-5 px-5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.push("/techhome")
            }
            className="w-10 h-10 rounded border border-white/20 bg-white/10 items-center justify-center mr-4"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                mono,
                {
                  fontSize: 14,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                },
              ]}
              className="text-white/60 mb-1"
            >
              TECH / ACTIVITY LOG
            </Text>
            <Text
              style={[font("700"), { fontSize: 24, letterSpacing: -0.5 }]}
              className="text-white"
            >
              Batch Records
            </Text>
          </View>

          {/* Export to Excel */}
          {batch && (
            <TouchableOpacity
              onPress={handleExportExcel}
              disabled={exporting}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 8,
              }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={[font("700"), { fontSize: 13, color: "#FFFFFF" }]}>
                {exporting ? "Exporting..." : "Export"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* ── BATCH SELECTOR (Bigger Buttons) ──────────────────────────────── */}
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
          {batches.length === 0 ? (
            <Text style={[mono, { fontSize: 14 }]} className="text-[#8C6A6A]">
              No batches found
            </Text>
          ) : (
            batches.map((b: any, idx: number) => {
              const isSelected = idx === selectedBatchIdx;
              const isActive = b.status === "active";
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => {
                    setSelectedBatchIdx(idx);
                    setSelectedPen("all");
                  }}
                  className={`rounded-lg px-4 py-3 border ${isSelected ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-white border-[#EDE0E0]"}`}
                >
                  <View className="flex-row items-center gap-2">
                    {isActive && (
                      <View className="w-2 h-2 rounded-full bg-green-400" />
                    )}
                    <Text
                      style={[
                        font(isSelected ? "700" : "500"),
                        {
                          fontSize: 13,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        },
                      ]}
                      className={isSelected ? "text-white" : "text-[#8C6A6A]"}
                    >
                      {b.batchName || "Unnamed"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {!batch ? (
          <View className="items-center py-20">
            <Ionicons name="folder-open-outline" size={48} color="#D4B8B8" />
            <Text
              style={[
                mono,
                {
                  fontSize: 14,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                },
              ]}
              className="text-[#8C6A6A] mt-4"
            >
              NO BATCH SELECTED
            </Text>
          </View>
        ) : (
          <>
            {/* ── PEN TABS (Bigger Buttons) ──────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="border-b border-[#EDE0E0]"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 8,
              }}
            >
              {/* All pens tab */}
              <TouchableOpacity
                onPress={() => setSelectedPen("all")}
                className={`px-5 py-2.5 rounded-lg border ${selectedPen === "all" ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-white border-[#EDE0E0]"}`}
              >
                <Text
                  style={[
                    font(selectedPen === "all" ? "700" : "500"),
                    {
                      fontSize: 14,
                      letterSpacing: 0.2,
                    },
                  ]}
                  className={
                    selectedPen === "all" ? "text-white" : "text-[#8C6A6A]"
                  }
                >
                  ALL PENS
                </Text>
              </TouchableOpacity>
              {penNumbers.map((num) => {
                const isSelected = selectedPen === num;
                return (
                  <TouchableOpacity
                    key={num}
                    onPress={() => setSelectedPen(num)}
                    className={`px-5 py-2.5 rounded-lg border ${isSelected ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-white border-[#EDE0E0]"}`}
                  >
                    <Text
                      style={[
                        font(isSelected ? "700" : "500"),
                        {
                          fontSize: 14,
                          letterSpacing: 0.2,
                        },
                      ]}
                      className={isSelected ? "text-white" : "text-[#8C6A6A]"}
                    >
                      P{String(num).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── PEN SUMMARY CARDS ────────────────────────────────────────── */}
            {selectedPen !== "all" &&
              (() => {
                const stats = getPenStats(selectedPen as number);
                return (
                  <View className="px-5 pt-6 pb-2">
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
                        PEN {String(selectedPen).padStart(2, "0")} SUMMARY
                      </Text>
                      <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                    </View>
                    <View className="flex-row gap-3 mb-3">
                      <PenStat
                        label="Mortality"
                        value={stats.mortality}
                        unit="hd"
                        color="#C0392B"
                      />
                      <PenStat
                        label="Feeds"
                        value={stats.feed}
                        unit="kg"
                        color="#D35400"
                      />
                      <PenStat
                        label="Vitamins"
                        value={stats.vitamins}
                        unit="dose"
                        color="#27AE60"
                      />
                    </View>
                    <View className="flex-row gap-3 mb-2">
                      <PenStat
                        label="Water"
                        value={stats.water}
                        unit="L"
                        color="#2471A3"
                      />
                      <PenStat
                        label="Avg Wt"
                        value={stats.weight}
                        unit="g"
                        color="#7D3C98"
                      />
                      <PenStat
                        label="Items"
                        value={stats.usedItems}
                        unit="pcs"
                        color="#0E7490"
                      />
                    </View>
                  </View>
                );
              })()}

            {/* ── ALL PENS OVERVIEW GRID ──────────────────────────────────── */}
            {selectedPen === "all" && (
              <View className="px-5 pt-6 pb-2">
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
                    PEN OVERVIEW
                  </Text>
                  <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                  <Text
                    style={[mono, { fontSize: 14, letterSpacing: 1 }]}
                    className="text-[#D4B8B8] ml-3"
                  >
                    {penCount} PENS
                  </Text>
                </View>
                {penNumbers.map((num) => {
                  const stats = getPenStats(num);
                  const isOpen = expandedSection === `pen-${num}`;
                  return (
                    <TouchableOpacity
                      key={num}
                      onPress={() =>
                        setExpandedSection(isOpen ? null : `pen-${num}`)
                      }
                      activeOpacity={0.8}
                      className="bg-white border border-[#EDE0E0] rounded-xl overflow-hidden mb-3"
                      style={{ borderLeftWidth: 3, borderLeftColor: "#3B0A0A" }}
                    >
                      <View className="flex-row items-center justify-between px-5 py-4">
                        <View className="flex-row items-center">
                          <Text
                            style={[
                              font("700"),
                              {
                                fontSize: 18,
                                color: "#3B0A0A",
                                letterSpacing: -0.3,
                              },
                            ]}
                            className="mr-4"
                          >
                            P{String(num).padStart(2, "0")}
                          </Text>
                          <View className="flex-row gap-4">
                            <Text
                              style={[font("600"), { fontSize: 13 }]}
                              className="text-[#C0392B]"
                            >
                              {stats.mortality}
                              <Text className="text-[#8C6A6A]"> hd</Text>
                            </Text>
                            <Text
                              style={[font("600"), { fontSize: 13 }]}
                              className="text-[#D35400]"
                            >
                              {stats.feed}
                              <Text className="text-[#8C6A6A]"> kg</Text>
                            </Text>
                            <Text
                              style={[font("600"), { fontSize: 13 }]}
                              className="text-[#27AE60]"
                            >
                              {stats.vitamins}
                              <Text className="text-[#8C6A6A]"> dose</Text>
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#8C6A6A"
                        />
                      </View>
                      {isOpen && (
                        <View className="px-4 pb-4 border-t border-[#EDE0E0]">
                          <View className="flex-row gap-3 pt-4 mb-3">
                            <PenStat
                              label="Mortality"
                              value={stats.mortality}
                              unit="hd"
                              color="#C0392B"
                            />
                            <PenStat
                              label="Feeds"
                              value={stats.feed}
                              unit="kg"
                              color="#D35400"
                            />
                            <PenStat
                              label="Vitamins"
                              value={stats.vitamins}
                              unit="dose"
                              color="#27AE60"
                            />
                          </View>
                          <View className="flex-row gap-3">
                            <PenStat
                              label="Water"
                              value={stats.water}
                              unit="L"
                              color="#2471A3"
                            />
                            <PenStat
                              label="Avg Wt"
                              value={stats.weight}
                              unit="g"
                              color="#7D3C98"
                            />
                            <PenStat
                              label="Items"
                              value={stats.usedItems}
                              unit="pcs"
                              color="#0E7490"
                            />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── TYPE FILTER PILLS ──────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 8,
              }}
              className="border-t border-[#EDE0E0] mt-2"
            >
              {["All", ...TYPES].map((t) => {
                const isSelected = selectedType === t;
                const m = TYPE_META[t];
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setSelectedType(t)}
                    className={`px-4 py-2 rounded-full border ${isSelected ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-white border-[#EDE0E0]"}`}
                  >
                    <Text
                      style={[
                        font(isSelected ? "700" : "500"),
                        {
                          fontSize: 14,
                          letterSpacing: 0.2,
                          color: isSelected ? "#FFFFFF" : m?.color || "#8C6A6A",
                        },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── LOG LIST ───────────────────────────────────────────────── */}
            <View className="px-5 mt-2">
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
                  {records.length} RECORDS
                </Text>
                <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
                <Text
                  style={[mono, { fontSize: 14, letterSpacing: 1 }]}
                  className="text-[#D4B8B8] ml-3"
                >
                  APPROVED ONLY
                </Text>
              </View>

              {records.length === 0 ? (
                <View className="items-center py-16 border border-[#EDE0E0] rounded-xl bg-[#FAF7F7]">
                  <Ionicons
                    name="document-text-outline"
                    size={40}
                    color="#D4B8B8"
                  />
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 14,
                        letterSpacing: 0.2,
                      },
                    ]}
                    className="text-[#8C6A6A] mt-4"
                  >
                    NO APPROVED RECORDS
                  </Text>
                </View>
              ) : (
                <View className="bg-white border border-[#EDE0E0] rounded-xl overflow-hidden shadow-sm">
                  {records.map((item, idx) => (
                    <View
                      key={item.id}
                      className={`px-4 ${idx < records.length - 1 ? "border-b border-[#EDE0E0]" : ""}`}
                    >
                      <View className="flex-row items-center py-4">
                        {/* Pen badge */}
                        <View
                          className="bg-[#F5EDED] border border-[#EDE0E0] rounded-lg px-3 py-2 mr-4 items-center justify-center"
                          style={{ minWidth: 44 }}
                        >
                          <Text
                            style={[
                              mono,
                              {
                                fontSize: 14,
                                letterSpacing: 0.2,
                                marginBottom: 2,
                              },
                            ]}
                            className="text-[#8C6A6A]"
                          >
                            PEN
                          </Text>
                          <Text
                            style={[
                              font("700"),
                              {
                                fontSize: 15,
                                color: "#3B0A0A",
                                lineHeight: 18,
                              },
                            ]}
                          >
                            {item.penNum || "–"}
                          </Text>
                        </View>

                        {/* Type icon */}
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center mr-4"
                          style={{
                            backgroundColor: `${(TYPE_META[item.type] || { color: "#8C6A6A" }).color}15`,
                          }}
                        >
                          <Ionicons
                            name={
                              (TYPE_META[item.type] || { icon: "document" })
                                .icon
                            }
                            size={18}
                            color={
                              (TYPE_META[item.type] || { color: "#8C6A6A" })
                                .color
                            }
                          />
                        </View>

                        {/* Content */}
                        <View className="flex-1 mr-3">
                          <Text
                            style={[
                              font("700"),
                              { fontSize: 15, letterSpacing: -0.2 },
                            ]}
                            className="text-[#1A0505] mb-1"
                          >
                            {item.subtitle}
                          </Text>
                          <Text
                            style={[mono, { fontSize: 14, letterSpacing: 0.5 }]}
                            className="text-[#8C6A6A]"
                          >
                            {item.date}
                          </Text>
                        </View>

                        {/* Type pill */}
                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: (
                              TYPE_META[item.type] || { color: "#8C6A6A" }
                            ).color,
                            backgroundColor: `${(TYPE_META[item.type] || { color: "#8C6A6A" }).color}08`,
                            borderRadius: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={[
                              font("700"),
                              {
                                fontSize: 14,
                                letterSpacing: 0.2,
                                color: (
                                  TYPE_META[item.type] || { color: "#8C6A6A" }
                                ).color,
                              },
                            ]}
                          >
                            {item.type}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TechnicianRecords;
