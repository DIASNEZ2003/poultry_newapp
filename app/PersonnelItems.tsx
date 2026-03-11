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

// ── Main Component ────────────────────────────────────────────────────────────
const PersonnelItems = () => {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [assignedPen, setAssignedPen] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [useModal, setUseModal] = useState({
    isOpen: false,
    item: null as any,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [quantityUsed, setQuantityUsed] = useState("");
  const [remarks, setRemarks] = useState("");

  // Firebase Realtime DB Sync
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

        if (activeId && batches[activeId].expenses) {
          const inventoryItems = Object.entries(batches[activeId].expenses)
            .filter(([_, exp]: any) => exp.category === "Items")
            .map(([key, exp]: any) => ({
              id: key,
              ...exp,
              itemName: exp.itemName || exp.name || "Unnamed Item",
              quantity: exp.quantity || exp.amount || 0,
              unit: exp.unit || exp.suffix || "pcs",
            }));
          setItems(inventoryItems);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubBatch();
    };
  }, []);

  const handleLogUsage = async () => {
    if (!activeBatchId || !useModal.item || !quantityUsed) {
      Alert.alert("Missing Input", "Please enter the amount used.");
      return;
    }

    try {
      const user = auth.currentUser;
      const logPath = "item_logs";
      const penTarget = assignedPen || "General";
      const batchRef = ref(db, `global_batches/${activeBatchId}`);
      const newLogKey = push(
        ref(db, `global_batches/${activeBatchId}/${logPath}/${penTarget}`),
      ).key;

      const payload = {
        itemName: useModal.item.itemName,
        category: "Items",
        ua_am: parseFloat(quantityUsed),
        ua_pm: 0,
        unit: useModal.item.unit,
        remarks: remarks.trim() || "Regular Usage",
        dateLabel: new Date().toLocaleDateString(),
        timestamp: serverTimestamp(),
        recordedBy: user?.uid,
        status: "not approved",
      };

      await update(batchRef, {
        [`${logPath}/${penTarget}/${newLogKey}`]: payload,
      });
      setSuccessMessage(`${useModal.item.itemName} usage logged!`);
      setUseModal({ isOpen: false, item: null });
      setQuantityUsed("");
      setRemarks("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const filteredItems = items.filter((i) =>
    i.itemName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
      </View>
    );

  return (
    <SafeAreaView className="flex-1 bg-white">
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
            Personnel / Inventory
          </Text>
          <Text
            style={[
              font("700"),
              { fontSize: 24, letterSpacing: -0.3, color: "white" },
            ]}
          >
            Tools & Items
          </Text>
        </View>
      </View>

      {/* ── SEARCH BAR ───────────────────────────────────────────────────── */}
      <View className="px-5 py-4 border-b border-[#EDE0E0] bg-[#FAF7F7]">
        <View className="flex-row items-center bg-white border border-[#EDE0E0] rounded-xl px-4 py-3 shadow-sm">
          <Ionicons name="search" size={18} color="#8C6A6A" />
          <TextInput
            placeholder="Search tools..."
            placeholderTextColor="#D4B8B8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={[font("500"), { fontSize: 14, color: "#1A0505" }]}
            className="flex-1 ml-3"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── STATUS BANNER ───────────────────────────────────────────────── */}
        <View className="bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl p-4 mb-6 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-4">
            <Ionicons name="construct-outline" size={20} color="#0E7490" />
          </View>
          <View className="flex-1">
            <Text style={[font("700"), { fontSize: 14, color: "#1A0505" }]}>
              {assignedPen || "General Farm"}
            </Text>
            <Text
              style={[mono, { fontSize: 14, color: "#8C6A6A" }]}
              className="uppercase mt-0.5"
            >
              Logging for {assignedPen ? "your assigned pen" : "general use"}
            </Text>
          </View>
        </View>

        {/* ── ITEM LIST ───────────────────────────────────────────────────── */}
        {filteredItems.length === 0 ? (
          <View className="items-center py-20">
            <Ionicons name="cube-outline" size={48} color="#D4B8B8" />
            <Text
              style={[mono, { fontSize: 14, color: "#8C6A6A" }]}
              className="mt-4 uppercase"
            >
              No items in inventory
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setUseModal({ isOpen: true, item })}
              activeOpacity={0.8}
              className="bg-white border border-[#EDE0E0] rounded-xl mb-4 overflow-hidden shadow-sm"
              style={{ borderLeftWidth: 3, borderLeftColor: "#0E7490" }}
            >
              <View className="flex-row items-center justify-between p-5">
                <View className="flex-1">
                  <Text
                    style={[font("700"), { fontSize: 16, color: "#1A0505" }]}
                  >
                    {item.itemName}
                  </Text>
                  <View className="flex-row items-center mt-2">
                    <Text style={[mono, { fontSize: 14, color: "#8C6A6A" }]}>
                      Supplied:{" "}
                    </Text>
                    <Text
                      style={[font("700"), { fontSize: 14, color: "#0E7490" }]}
                    >
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                </View>
                <View className="bg-[#FAF7F7] p-3 rounded-lg border border-[#EDE0E0]">
                  <Ionicons
                    name="remove-circle-outline"
                    size={20}
                    color="#0E7490"
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ── LOG USAGE MODAL ──────────────────────────────────────────────── */}
      <Modal visible={useModal.isOpen} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View className="bg-white rounded-t-3xl p-6">
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text
                    style={[mono, { fontSize: 14, color: "#8C6A6A" }]}
                    className="uppercase"
                  >
                    Logging Usage
                  </Text>
                  <Text
                    style={[font("700"), { fontSize: 20, color: "#1A0505" }]}
                  >
                    {useModal.item?.itemName}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setUseModal({ isOpen: false, item: null })}
                  className="p-2"
                >
                  <Ionicons name="close" size={24} color="#8C6A6A" />
                </TouchableOpacity>
              </View>

              <View className="mb-5">
                <Text
                  style={[
                    mono,
                    { fontSize: 14, letterSpacing: 0.2, color: "#8C6A6A" },
                  ]}
                  className="uppercase mb-2 ml-1"
                >
                  Quantity Used ({useModal.item?.unit})
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={quantityUsed}
                  onChangeText={setQuantityUsed}
                  placeholder="0.0"
                  placeholderTextColor="#D4B8B8"
                  style={[
                    font("700"),
                    { fontSize: 24, color: "#0E7490", textAlign: "center" },
                  ]}
                  className="bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl py-4"
                />
              </View>

              <View className="mb-8">
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
                  placeholder="What was this used for?"
                  placeholderTextColor="#D4B8B8"
                  style={[font("500"), { fontSize: 15, color: "#1A0505" }]}
                  className="bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-4"
                />
              </View>

              <TouchableOpacity
                onPress={handleLogUsage}
                className="bg-[#3B0A0A] py-4 rounded-xl items-center shadow-md mb-4"
              >
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
                  CONFIRM USAGE
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── SUCCESS MODAL ────────────────────────────────────────────────── */}
      <Modal visible={!!successMessage} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-7 items-center shadow-2xl">
            <View className="w-16 h-16 bg-[#F0FDF4] border border-[#A7F3D0] rounded-full items-center justify-center mb-5">
              <Ionicons name="checkmark" size={32} color="#059669" />
            </View>
            <Text style={[font("700"), { fontSize: 20, color: "#1A0505" }]}>
              Success!
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
              {successMessage}
            </Text>
            <TouchableOpacity
              onPress={() => setSuccessMessage("")}
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

export default PersonnelItems;
