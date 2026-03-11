import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

// ── Font helpers ──────────────────────────────────────────────────────────────
const font = (weight = "400") => ({
  fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
};

// ── Main Component ────────────────────────────────────────────────────────────
const PenAssignment = () => {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<"assigned" | "unassigned">(
    "assigned",
  );
  const [penFilter, setPenFilter] = useState<number | "all">("all");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPenSelectModal, setShowPenSelectModal] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<any>(null);

  useEffect(() => {
    const unsubBatches = onValue(ref(db, "global_batches"), (snapshot) => {
      if (snapshot.exists()) {
        const batches = snapshot.val();
        const entry = Object.entries(batches).find(
          ([_, b]: [string, any]) => b.status === "active",
        );
        if (entry) setActiveBatch({ id: entry[0], ...(entry[1] as any) });
      }
    });

    const unsubUsers = onValue(ref(db, "users"), (snapshot) => {
      if (snapshot.exists()) {
        const users = snapshot.val();
        const arr = Object.entries(users)
          .map(([id, data]: [string, any]) => ({ id, ...data }))
          .filter((u: any) => u.role === "personnel");
        setPersonnelList(arr);
      }
      setLoading(false);
    });

    return () => {
      unsubBatches();
      unsubUsers();
    };
  }, []);

  const penNumbers = Array.from(
    { length: activeBatch?.penCount || 0 },
    (_, i) => i + 1,
  );

  const handleAssignPen = async (penNumber: number) => {
    if (!activeBatch || !selectedPersonnel) return;
    try {
      setShowAssignModal(false);
      setLoading(true);
      const updates: any = {};
      if (selectedPersonnel.assignedPen) {
        const oldKey = selectedPersonnel.assignedPen.replace(" ", "_");
        updates[`global_batches/${activeBatch.id}/pens/${oldKey}/assignedTo`] =
          null;
        updates[
          `global_batches/${activeBatch.id}/pens/${oldKey}/assignedName`
        ] = null;
      }
      updates[
        `global_batches/${activeBatch.id}/pens/Pen_${penNumber}/assignedTo`
      ] = selectedPersonnel.id;
      updates[
        `global_batches/${activeBatch.id}/pens/Pen_${penNumber}/assignedName`
      ] = selectedPersonnel.fullName || selectedPersonnel.firstName;
      updates[`users/${selectedPersonnel.id}/assignedPen`] = `Pen ${penNumber}`;
      updates[`users/${selectedPersonnel.id}/activeBatch`] = activeBatch.id;
      await update(ref(db), updates);
      Alert.alert("Success", `Assigned to Pen ${penNumber}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!activeBatch || !selectedPersonnel?.assignedPen) return;
    Alert.alert(
      "Remove Assignment",
      "Are you sure you want to unassign this person?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setShowAssignModal(false);
              setLoading(true);
              const updates: any = {};
              const penKey = selectedPersonnel.assignedPen.replace(" ", "_");
              updates[
                `global_batches/${activeBatch.id}/pens/${penKey}/assignedTo`
              ] = null;
              updates[
                `global_batches/${activeBatch.id}/pens/${penKey}/assignedName`
              ] = null;
              updates[`users/${selectedPersonnel.id}/assignedPen`] = null;
              updates[`users/${selectedPersonnel.id}/activeBatch`] = null;
              await update(ref(db), updates);
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleGoBack = () =>
    router.canGoBack() ? router.back() : router.push("/techhome");

  const filteredPersonnel = personnelList
    .filter((p) =>
      statusFilter === "assigned" ? !!p.assignedPen : !p.assignedPen,
    )
    .filter((p) =>
      penFilter === "all" ? true : p.assignedPen === `Pen ${penFilter}`,
    )
    .sort((a, b) =>
      (a.fullName || a.firstName).localeCompare(b.fullName || b.firstName),
    );

  if (loading && personnelList.length === 0)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B0A0A" />
      </View>
    );

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <View className="bg-[#3B0A0A] pt-10 pb-5 px-5">
        {/* Back + Title */}
        <View className="flex-row items-center mb-5">
          <TouchableOpacity
            onPress={handleGoBack}
            className="w-9 h-9 rounded border border-white/20 bg-white/10 items-center justify-center mr-4"
          >
            <Ionicons name="arrow-back" size={18} color="white" />
          </TouchableOpacity>
          <View>
            <Text
              style={[
                mono,
                { fontSize: 8, letterSpacing: 2, textTransform: "uppercase" },
              ]}
              className="text-white/60 mb-0.5"
            >
              TECH / PEN MANAGEMENT
            </Text>
            <Text
              style={[font("700"), { fontSize: 20, letterSpacing: -0.5 }]}
              className="text-white"
            >
              Pen Assignment
            </Text>
          </View>

          {/* Batch pill */}
          {activeBatch && (
            <View className="ml-auto bg-white/10 border border-white/20 rounded px-3 py-1.5">
              <Text
                style={[
                  mono,
                  {
                    fontSize: 7,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  },
                ]}
                className="text-white/60"
              >
                BATCH
              </Text>
              <Text
                style={[font("700"), { fontSize: 11, letterSpacing: -0.2 }]}
                className="text-white"
                numberOfLines={1}
              >
                {activeBatch.batchName || "Active"}
              </Text>
            </View>
          )}
        </View>

        {/* ── FILTER ROW ───────────────────────────────────────────────────── */}
        <View className="flex-row gap-2">
          {/* Assigned / Unassigned toggle */}
          <View className="flex-row flex-1 bg-black/20 rounded p-0.5">
            {(["assigned", "unassigned"] as const).map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setStatusFilter(val)}
                className={`flex-1 py-2 rounded items-center ${statusFilter === val ? "bg-white" : ""}`}
              >
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 8,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    },
                  ]}
                  className={
                    statusFilter === val ? "text-[#3B0A0A]" : "text-white/70"
                  }
                >
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pen filter button */}
          <TouchableOpacity
            onPress={() => setShowPenSelectModal(true)}
            className="flex-row items-center bg-black/20 border border-white/10 rounded px-3 py-2 gap-2"
          >
            <Text
              style={[
                mono,
                { fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" },
              ]}
              className="text-white/80"
            >
              {penFilter === "all" ? "ALL PENS" : `PEN ${penFilter}`}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color="rgba(255,255,255,0.6)"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── COUNT BAR ───────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-5 py-3 border-b border-[#EDE0E0] bg-[#FAF7F7]">
        <Text
          style={[
            mono,
            { fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" },
          ]}
          className="text-[#8C6A6A]"
        >
          {filteredPersonnel.length} PERSONNEL
        </Text>
        <View className="flex-1 h-px bg-[#EDE0E0] ml-3" />
        <Text
          style={[
            mono,
            { fontSize: 8, letterSpacing: 1, textTransform: "uppercase" },
          ]}
          className="text-[#D4B8B8] ml-3"
        >
          {statusFilter === "assigned" ? "ASSIGNED" : "UNASSIGNED"}
        </Text>
      </View>

      {/* ── PERSONNEL LIST ──────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="px-5 pt-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {filteredPersonnel.length === 0 ? (
          <View className="items-center py-16">
            <Ionicons name="people-outline" size={40} color="#D4B8B8" />
            <Text
              style={[
                mono,
                { fontSize: 9, letterSpacing: 2, textTransform: "uppercase" },
              ]}
              className="text-[#8C6A6A] mt-3"
            >
              NO PERSONNEL FOUND
            </Text>
          </View>
        ) : (
          filteredPersonnel.map((personnel) => (
            <View
              key={personnel.id}
              className="bg-white border border-[#EDE0E0] rounded overflow-hidden mb-3"
              style={{
                borderLeftWidth: 2,
                borderLeftColor: personnel.assignedPen ? "#3B0A0A" : "#D4B8B8",
              }}
            >
              <View className="flex-row items-center justify-between p-4">
                {/* Avatar */}
                <View className="w-11 h-11 rounded bg-[#F5EDED] border border-[#EDE0E0] overflow-hidden items-center justify-center mr-3">
                  {personnel.profilePicture ? (
                    <Image
                      source={{ uri: personnel.profilePicture }}
                      className="w-full h-full"
                    />
                  ) : (
                    <Text
                      style={[font("700"), { fontSize: 16 }]}
                      className="text-[#3B0A0A]"
                    >
                      {personnel.firstName?.[0]}
                    </Text>
                  )}
                </View>

                {/* Info */}
                <View className="flex-1">
                  <Text
                    style={[font("700"), { fontSize: 14, letterSpacing: -0.2 }]}
                    className="text-[#1A0505]"
                  >
                    {personnel.fullName || personnel.firstName}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    {personnel.assignedPen ? (
                      <>
                        <View className="w-1.5 h-1.5 rounded-full bg-[#3B0A0A] mr-1.5" />
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 8,
                              letterSpacing: 1.2,
                              textTransform: "uppercase",
                            },
                          ]}
                          className="text-[#3B0A0A]"
                        >
                          {personnel.assignedPen}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View className="w-1.5 h-1.5 rounded-full bg-[#D4B8B8] mr-1.5" />
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 8,
                              letterSpacing: 1.2,
                              textTransform: "uppercase",
                            },
                          ]}
                          className="text-[#D4B8B8]"
                        >
                          UNASSIGNED
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Action button */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPersonnel(personnel);
                    setShowAssignModal(true);
                  }}
                  className={`px-4 py-2 rounded items-center justify-center ${personnel.assignedPen ? "bg-[#F5EDED] border border-[#EDE0E0]" : "bg-[#3B0A0A]"}`}
                >
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 8,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                      },
                    ]}
                    className={
                      personnel.assignedPen ? "text-[#3B0A0A]" : "text-white"
                    }
                  >
                    {personnel.assignedPen ? "EDIT" : "ASSIGN"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── ASSIGN PEN MODAL ────────────────────────────────────────────────── */}
      <Modal visible={showAssignModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white border border-[#EDE0E0] rounded w-full max-w-sm overflow-hidden">
            {/* Maroon top stripe */}
            <View className="h-0.5 bg-[#3B0A0A]" />

            {/* Modal header */}
            <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-[#EDE0E0]">
              <View>
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 8,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                    },
                  ]}
                  className="text-[#8C6A6A] mb-0.5"
                >
                  ASSIGN TO
                </Text>
                <Text
                  style={[font("700"), { fontSize: 16, letterSpacing: -0.3 }]}
                  className="text-[#1A0505]"
                >
                  {selectedPersonnel?.fullName || selectedPersonnel?.firstName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={20} color="#8C6A6A" />
              </TouchableOpacity>
            </View>

            {/* Pen grid */}
            <ScrollView
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                padding: 12,
                gap: 8,
              }}
              style={{ maxHeight: 280 }}
            >
              {penNumbers.map((num) => {
                const isSelected =
                  selectedPersonnel?.assignedPen === `Pen ${num}`;
                return (
                  <TouchableOpacity
                    key={num}
                    onPress={() => handleAssignPen(num)}
                    className={`items-center justify-center rounded border ${isSelected ? "bg-[#3B0A0A] border-[#3B0A0A]" : "bg-[#FAF7F7] border-[#EDE0E0]"}`}
                    style={{ width: "30%", aspectRatio: 1 }}
                  >
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 8,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                        },
                      ]}
                      className={
                        isSelected ? "text-white/60" : "text-[#8C6A6A]"
                      }
                    >
                      PEN
                    </Text>
                    <Text
                      style={[font("700"), { fontSize: 22, letterSpacing: -1 }]}
                      className={isSelected ? "text-white" : "text-[#3B0A0A]"}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Remove assignment */}
            {selectedPersonnel?.assignedPen && (
              <View className="px-4 pb-4">
                <TouchableOpacity
                  onPress={handleRemoveAssignment}
                  className="flex-row items-center justify-center py-3 border border-[#EDE0E0] rounded gap-2"
                >
                  <Ionicons
                    name="remove-circle-outline"
                    size={15}
                    color="#8C6A6A"
                  />
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 8,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                      },
                    ]}
                    className="text-[#8C6A6A]"
                  >
                    REMOVE ASSIGNMENT
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── PEN FILTER MODAL ────────────────────────────────────────────────── */}
      <Modal visible={showPenSelectModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowPenSelectModal(false)}
          className="flex-1 bg-black/60 justify-center items-center px-6"
        >
          <View
            className="bg-white border border-[#EDE0E0] rounded w-full max-w-xs overflow-hidden"
            style={{ maxHeight: "65%" }}
          >
            <View className="h-0.5 bg-[#3B0A0A]" />
            <View className="px-5 pt-5 pb-3 border-b border-[#EDE0E0]">
              <Text
                style={[
                  mono,
                  { fontSize: 8, letterSpacing: 2, textTransform: "uppercase" },
                ]}
                className="text-[#8C6A6A]"
              >
                FILTER BY PEN
              </Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* All pens option */}
              <TouchableOpacity
                onPress={() => {
                  setPenFilter("all");
                  setShowPenSelectModal(false);
                }}
                className="flex-row items-center justify-between px-5 py-4 border-b border-[#EDE0E0]"
              >
                <Text
                  style={[font("700"), { fontSize: 13 }]}
                  className={
                    penFilter === "all" ? "text-[#3B0A0A]" : "text-[#8C6A6A]"
                  }
                >
                  All Pens
                </Text>
                {penFilter === "all" && (
                  <Ionicons name="checkmark" size={16} color="#3B0A0A" />
                )}
              </TouchableOpacity>
              {penNumbers.map((num) => (
                <TouchableOpacity
                  key={num}
                  onPress={() => {
                    setPenFilter(num);
                    setShowPenSelectModal(false);
                  }}
                  className="flex-row items-center justify-between px-5 py-4 border-b border-[#EDE0E0]"
                >
                  <View className="flex-row items-center">
                    <View
                      className={`w-6 h-6 rounded items-center justify-center mr-3 ${penFilter === num ? "bg-[#3B0A0A]" : "bg-[#F5EDED]"}`}
                    >
                      <Text
                        style={[mono, { fontSize: 8 }]}
                        className={
                          penFilter === num ? "text-white" : "text-[#3B0A0A]"
                        }
                      >
                        {num}
                      </Text>
                    </View>
                    <Text
                      style={[font("700"), { fontSize: 13 }]}
                      className={
                        penFilter === num ? "text-[#3B0A0A]" : "text-[#8C6A6A]"
                      }
                    >
                      Pen {num}
                    </Text>
                  </View>
                  {penFilter === num && (
                    <Ionicons name="checkmark" size={16} color="#3B0A0A" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default PenAssignment;
