import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { supabase } from "../../supabaseClient";
import { auth, db } from "../firebaseConfig";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  maroon: "#3B0A0A",
  maroonMid: "#6B1A1A",
  border: "#EDE0E0",
  bg: "#FAF7F7",
  muted: "#8C6A6A",
  mutedLight: "#D4B8B8",
  text: "#1A0505",
  white: "#FFFFFF",
  green: "#27AE60",
  gray: "#9ca3af",
};

const font = (w: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: w,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

// FIXED: Aligned all keys to match the uppercase output from `displayRole`
const ROLE_COLOR: any = {
  ADMIN: "#2471A3",
  TECHNICIAN: "#D35400",
  PERSONNEL: "#5B4A8A",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (ts: any) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const today =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return today
    ? t
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${t}`;
};

// ── Reusable role pill ────────────────────────────────────────────────────────
const RolePill = ({ role }: any) => {
  const color = ROLE_COLOR[role] || C.muted;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color,
        borderRadius: 2,
        paddingHorizontal: 5,
        paddingVertical: 2,
      }}
    >
      <Text
        style={[
          mono,
          {
            fontSize: 13,
            letterSpacing: 0.2,
            textTransform: "uppercase",
            color,
          },
        ]}
      >
        {role}
      </Text>
    </View>
  );
};

// ── Status dot ────────────────────────────────────────────────────────────────
const StatusDot = ({ online, size = 10, border = 2 }: any) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: online ? C.green : "#9ca3af",
      borderWidth: border,
      borderColor: C.white,
    }}
  />
);

// =============================================================================
const TechMessenger = () => {
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState("list");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [adminStatus, setAdminStatus] = useState("offline");
  const [liveStatus, setLiveStatus] = useState("offline");
  const [viewingImage, setViewingImage] = useState<any>(null);
  const [documentToView, setDocumentToView] = useState<any>(null);
  const [isDocLoading, setIsDocLoading] = useState(true);

  // ── Broadcast to personnel ────────────────────────────────────
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);

  const flatListRef = useRef<any>(null);
  const isFocused = useIsFocused();
  const inputRef = useRef<any>(null);
  const TAB_BAR_HEIGHT = 88;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    };
    const onHide = () => setKeyboardHeight(0);
    const s1 = Keyboard.addListener(show, onShow);
    const s2 = Keyboard.addListener(hide, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // ── Admin status ─────────────────────────────────────────────────────────
  useEffect(() => {
    const adminUid = "KLQoW8g03nT22j2vCd9NELRXq0r1";
    return onValue(ref(db, `users/${adminUid}`), (snap) => {
      if (snap.exists()) setAdminStatus(snap.val().status || "online");
    });
  }, []);

  // ── Current user presence ─────────────────────────────────────────────────
  useEffect(() => {
    const cu = auth.currentUser;
    if (!cu) return;
    const statusRef = ref(db, `users/${cu.uid}`);
    const connRef = ref(db, ".info/connected");
    const unsub = onValue(connRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(statusRef)
          .update({ status: "offline", lastSeen: Date.now() })
          .then(() =>
            update(statusRef, { status: "online", lastSeen: Date.now() }),
          );
      }
    });
    return () => {
      unsub();
      update(statusRef, { status: "offline", lastSeen: Date.now() });
    };
  }, []);

  // ── Fetch users ───────────────────────────────────────────────────────────
  useEffect(() => {
    const cu = auth.currentUser;
    if (!cu) return;
    return onValue(ref(db, "users"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data)
          .map((uid) => {
            const isAdmin =
              data[uid].role === "admin" ||
              uid === "KLQoW8g03nT22j2vCd9NELRXq0r1";

            // FIXED: Ensure the role is converted to lowercase to avoid filtering issues due to casing
            const rawRole = data[uid].role
              ? String(data[uid].role).toLowerCase()
              : "personnel";

            return {
              uid,
              ...data[uid],
              status: isAdmin ? adminStatus : data[uid].status || "offline",
              profilePicture:
                data[uid].profilePicture || data[uid].profileImage || null,
              role: isAdmin ? "admin" : rawRole,
              fullName:
                data[uid].fullName ||
                data[uid].username ||
                (data[uid].firstName
                  ? `${data[uid].firstName} ${data[uid].lastName || ""}`
                  : isAdmin
                    ? "Farm Admin"
                    : "Unknown User"),
            };
          })
          .filter(
            (u) =>
              u.uid !== cu.uid &&
              ["admin", "personel", "personnel", "tech", "user"].includes(
                u.role,
              ),
          );
        list.sort((a, b) =>
          a.role === "admin" && b.role !== "admin"
            ? -1
            : a.role !== "admin" && b.role === "admin"
              ? 1
              : a.fullName.localeCompare(b.fullName),
        );
        setUsersList(list);
      } else setUsersList([]);
      setLoading(false);
    });
  }, [adminStatus]);

  // ── Chat ID ───────────────────────────────────────────────────────────────
  const getChatId = (target: any) => {
    const cu = auth.currentUser;
    if (!cu || !target) return null;
    if (
      target.role === "admin" ||
      target.uid === "KLQoW8g03nT22j2vCd9NELRXq0r1"
    )
      return cu.uid;
    return [cu.uid, target.uid].sort().join("_");
  };

  // ── Unread counts ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cu = auth.currentUser;
    if (!cu || !usersList.length) return;
    return onValue(ref(db, "chats"), (snap) => {
      const data = snap.val();
      const counts: any = {};
      if (data)
        usersList.forEach((u) => {
          const room = data[getChatId(u)];
          if (room) {
            const n = Object.values(room).filter(
              (m: any) =>
                (m.sender || m.senderUid) !== cu.uid &&
                (m.sender || m.senderUid) !== "tech" &&
                !m.seen,
            ).length;
            if (n > 0) counts[u.uid] = n;
          }
        });
      setUnreadCounts(counts);
    });
  }, [usersList]);

  // ── Messages ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeView !== "chat" || !selectedUser) return;
    const cu = auth.currentUser;
    if (!cu) return;
    const unsubStatus = onValue(
      ref(db, `users/${selectedUser.uid}/status`),
      (snap) => {
        const isAdmin =
          selectedUser.role === "admin" ||
          selectedUser.uid === "KLQoW8g03nT22j2vCd9NELRXq0r1";
        setLiveStatus(snap.val() || (isAdmin ? "online" : "offline"));
      },
    );
    const chatId = getChatId(selectedUser);
    if (!chatId) return;
    const unsubChat = onValue(ref(db, `chats/${chatId}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const msgs = Object.keys(data).map((id) => ({
          id,
          ...data[id],
          sender: data[id].sender || data[id].senderUid || "unknown",
        }));
        setMessages(msgs.sort((a, b) => a.id.localeCompare(b.id)));
        const updates: any = {};
        Object.keys(data).forEach((id) => {
          const m = data[id];
          const s = m.sender || m.senderUid;
          if (isFocused && s !== cu.uid && s !== "tech" && !m.seen) {
            updates[`chats/${chatId}/${id}/seen`] = true;
            updates[`chats/${chatId}/${id}/status`] = "seen";
          }
        });
        if (Object.keys(updates).length) update(ref(db), updates);
      } else setMessages([]);
    });
    return () => {
      unsubChat();
      unsubStatus();
    };
  }, [activeView, selectedUser, isFocused]);

  // ── Pickers ───────────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!r.canceled && r.assets.length > 0)
      setSelectedFile({
        uri: r.assets[0].uri,
        type: "image/jpeg",
        name: `image_${Date.now()}.jpg`,
        isImage: true,
      });
  };
  const handlePickDocument = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (!r.canceled && r.assets?.length > 0) {
      const a = r.assets[0];
      setSelectedFile({
        uri: a.uri,
        type: a.mimeType || "application/octet-stream",
        name: a.name,
        isImage: a.mimeType?.startsWith("image/"),
      });
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if ((inputText.trim() === "" && !selectedFile) || !selectedUser) return;
    const cu = auth.currentUser;
    if (!cu) return;
    const chatId = getChatId(selectedUser);
    if (!chatId) return;
    const ts = Date.now(),
      text = inputText.trim(),
      file = selectedFile;
    const isAdmin =
      selectedUser.role === "admin" ||
      selectedUser.uid === "KLQoW8g03nT22j2vCd9NELRXq0r1";
    const tgtStatus = isAdmin ? adminStatus : selectedUser.status;
    setInputText("");
    setSelectedFile(null);
    try {
      if (editingId && !file) {
        await update(ref(db, `chats/${chatId}/${editingId}`), {
          text,
          isEdited: true,
          editTimestamp: Date.now(),
        });
        setEditingId(null);
      } else {
        setUploading(true);
        let publicUrl = null,
          fileName = null,
          fileType = null;
        if (file) {
          const ab = await (await fetch(file.uri)).arrayBuffer();
          const safe = (file.name || "attachment").replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_",
          );
          const path = `attachments/${cu.uid}/${ts}_${safe}`;
          const { error } = await supabase.storage
            .from("chat-attachments")
            .upload(path, ab, { contentType: file.type });
          if (error) throw error;
          publicUrl = supabase.storage
            .from("chat-attachments")
            .getPublicUrl(path).data.publicUrl;
          fileName = file.name;
          fileType = file.type;
        }
        const payload: any = {
          senderUid: cu.uid,
          sender: cu.uid,
          text,
          timestamp: ts,
          isEdited: false,
          seen: false,
          status: tgtStatus === "online" ? "delivered" : "sent",
        };
        if (publicUrl) {
          payload.attachmentUrl = publicUrl;
          payload.attachmentType = fileType;
          payload.attachmentName = fileName;
        }
        await push(ref(db, `chats/${chatId}`), payload);
      }
    } catch {
      Alert.alert("Error", "Failed to send message. Check your connection.");
    } finally {
      setUploading(false);
    }
  };

  const openDocumentInApp = (url: any, name: any) => {
    if (!url) return;
    setDocumentToView({
      url: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`,
      name: name || "Document",
    });
    setIsDocLoading(true);
  };
  const handleDelete = (id: any) => {
    const cid = getChatId(selectedUser);
    if (cid) remove(ref(db, `chats/${cid}/${id}`));
  };
  const getSenderName = (sid: any) => {
    if (sid === auth.currentUser?.uid || sid === "tech") return "You";
    if (sid === "admin" || sid === "KLQoW8g03nT22j2vCd9NELRXq0r1")
      return "Farm Admin";
    return usersList.find((u) => u.uid === sid)?.fullName || "Unknown";
  };
  const filteredUsers = usersList.filter(
    (u) =>
      !searchQuery ||
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const closeAllModals = () => {
    setViewingImage(null);
    setDocumentToView(null);
    setIsDocLoading(true);
  };

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return;
    const cu = auth.currentUser;
    if (!cu) return;
    setBroadcastSending(true);
    try {
      const personnel = usersList.filter(
        (u) => u.role === "personnel" || u.role === "personel",
      );
      await Promise.all(
        personnel.map(async (p) => {
          const chatId = [cu.uid, p.uid].sort().join("_");
          const newMsgRef = push(ref(db, `chats/${chatId}`));
          return set(newMsgRef, {
            sender: cu.uid,
            senderUid: cu.uid,
            text: `📢 ${broadcastText.trim()}`,
            timestamp: Date.now(),
            seen: false,
            status: "sent",
            isAlert: true,
          });
        }),
      );
      setBroadcastSent(true);
    } catch {
      Alert.alert("Error", "Failed to send. Check your connection.");
    } finally {
      setBroadcastSending(false);
    }
  };

  // ── Shared image modal ────────────────────────────────────────────────────
  const ImageModal = () => (
    <Modal
      visible={!!viewingImage}
      transparent
      animationType="fade"
      onRequestClose={closeAllModals}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.96)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          style={{
            position: "absolute",
            top: 48,
            right: 20,
            padding: 8,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 20,
          }}
          onPress={closeAllModals}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        {viewingImage && (
          <Image
            source={{ uri: viewingImage }}
            style={{ width: "100%", height: "80%" }}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );

  // ==========================================================================
  // LIST VIEW
  // ==========================================================================
  if (activeView === "list") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ImageModal />

        {/* Header */}
        <View
          style={{
            backgroundColor: C.maroon,
            paddingTop: 40,
            paddingBottom: 20,
            paddingHorizontal: 20,
          }}
        >
          <Text
            style={[
              mono,
              {
                fontSize: 13,
                letterSpacing: 0.2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.6)",
                marginBottom: 4,
              },
            ]}
          >
            TECH / MESSAGING
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={[
                font("700"),
                { fontSize: 22, color: C.white, letterSpacing: -0.5 },
              ]}
            >
              Inbox
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowBroadcast(true);
                setBroadcastText("");
                setBroadcastSent(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255,255,255,0.15)",
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Ionicons name="megaphone-outline" size={14} color={C.white} />
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    letterSpacing: 0.2,
                    color: C.white,
                    textTransform: "uppercase",
                  },
                ]}
              >
                Notify Personnel
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View
          style={{
            backgroundColor: C.white,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: C.bg,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="search" size={16} color={C.muted} />
            <TextInput
              placeholder="Search users..."
              style={[
                mono,
                { flex: 1, marginLeft: 8, fontSize: 14, color: C.text },
              ]}
              placeholderTextColor={C.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color={C.maroon} />
            <Text
              style={[
                mono,
                {
                  fontSize: 13,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                  color: C.muted,
                  marginTop: 12,
                },
              ]}
            >
              LOADING...
            </Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <Ionicons name="search-outline" size={40} color={C.mutedLight} />
            <Text
              style={[
                mono,
                {
                  fontSize: 14,
                  letterSpacing: 0.2,
                  color: C.muted,
                  marginTop: 12,
                },
              ]}
            >
              NO USERS FOUND
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(i) => i.uid}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => {
              const unread = unreadCounts[item.uid] || 0;
              const online =
                (item.role === "admin"
                  ? adminStatus
                  : item.status || "offline") === "online";

              const displayRole =
                item.role === "admin"
                  ? "ADMIN"
                  : item.role === "tech" || item.role === "user"
                    ? "TECHNICIAN"
                    : "PERSONNEL";

              return (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedUser(item);
                    setActiveView("chat");
                  }}
                  activeOpacity={0.75}
                  style={{
                    backgroundColor: C.white,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderLeftWidth: 3,
                    borderLeftColor: C.maroon,
                    borderRadius: 4,
                    marginBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                  }}
                >
                  {/* Avatar */}
                  <View style={{ position: "relative", marginRight: 14 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 4,
                        backgroundColor: C.bg,
                        borderWidth: 1,
                        borderColor: C.border,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {item.profilePicture ? (
                        <TouchableOpacity
                          style={{ width: "100%", height: "100%" }}
                          onPress={() => setViewingImage(item.profilePicture)}
                        >
                          <Image
                            source={{ uri: item.profilePicture }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : item.role === "admin" ? (
                        <Ionicons
                          name="shield-checkmark"
                          size={20}
                          color={C.muted}
                        />
                      ) : (
                        <Text
                          style={[
                            font("700"),
                            { fontSize: 18, color: C.maroon },
                          ]}
                        >
                          {item.fullName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View
                      style={{ position: "absolute", bottom: -2, right: -2 }}
                    >
                      <StatusDot online={online} size={12} border={2} />
                    </View>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        font("700"),
                        { fontSize: 14, color: C.text, letterSpacing: -0.3 },
                      ]}
                      numberOfLines={1}
                    >
                      {item.fullName}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        gap: 6,
                      }}
                    >
                      <RolePill role={displayRole} />
                      {unread > 0 && (
                        <View
                          style={{
                            backgroundColor: C.maroon,
                            borderRadius: 2,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            style={[
                              mono,
                              {
                                fontSize: 13,
                                color: C.white,
                                letterSpacing: 1,
                              },
                            ]}
                          >
                            {unread} NEW
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 13,
                            color: online ? C.green : C.muted,
                            letterSpacing: 0.8,
                          },
                        ]}
                      >
                        ● {online ? "ONLINE" : "OFFLINE"}
                      </Text>
                    </View>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={C.mutedLight}
                  />
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Broadcast Modal ──────────────────────────────────────────── */}
        <Modal visible={showBroadcast} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: C.white,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <View
                style={{
                  backgroundColor: C.maroon,
                  paddingHorizontal: 20,
                  paddingTop: 20,
                  paddingBottom: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: "rgba(255,255,255,0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="megaphone-outline"
                      size={17}
                      color={C.white}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 13,
                          letterSpacing: 0.2,
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                        },
                      ]}
                    >
                      BROADCAST
                    </Text>
                    <Text
                      style={[
                        font("700"),
                        { fontSize: 15, color: C.white, letterSpacing: -0.3 },
                      ]}
                    >
                      Notify All Personnel
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowBroadcast(false)}
                  style={{
                    padding: 6,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: 20,
                  }}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color="rgba(255,255,255,0.8)"
                  />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                {broadcastSent ? (
                  <View
                    style={{
                      alignItems: "center",
                      paddingVertical: 28,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "#D5F5E3",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={30}
                        color={C.green}
                      />
                    </View>
                    <Text
                      style={[font("700"), { fontSize: 15, color: C.text }]}
                    >
                      Message Sent!
                    </Text>
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 14,
                          color: C.muted,
                          textAlign: "center",
                          letterSpacing: 0.5,
                        },
                      ]}
                    >
                      All personnel have been notified.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowBroadcast(false)}
                      style={{
                        marginTop: 8,
                        backgroundColor: C.maroon,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 14,
                            letterSpacing: 0.2,
                            color: C.white,
                            textTransform: "uppercase",
                          },
                        ]}
                      >
                        CLOSE
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[
                        mono,
                        {
                          fontSize: 14,
                          letterSpacing: 0.2,
                          color: C.muted,
                          marginBottom: 8,
                        },
                      ]}
                    >
                      Message
                    </Text>
                    <TextInput
                      value={broadcastText}
                      onChangeText={setBroadcastText}
                      placeholder="Type your message to all personnel..."
                      placeholderTextColor={C.mutedLight}
                      multiline
                      numberOfLines={4}
                      style={[
                        font("400"),
                        {
                          fontSize: 13,
                          color: C.text,
                          borderWidth: 1,
                          borderColor: C.border,
                          borderRadius: 8,
                          padding: 14,
                          backgroundColor: C.bg,
                          minHeight: 100,
                          textAlignVertical: "top",
                          marginBottom: 16,
                        },
                      ]}
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => setShowBroadcast(false)}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          borderWidth: 1,
                          borderColor: C.border,
                          borderRadius: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 14,
                              letterSpacing: 0.2,
                              color: C.muted,
                            },
                          ]}
                        >
                          CANCEL
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleBroadcast}
                        disabled={broadcastSending || !broadcastText.trim()}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 8,
                          backgroundColor: !broadcastText.trim()
                            ? C.mutedLight
                            : C.maroon,
                        }}
                      >
                        {broadcastSending ? (
                          <ActivityIndicator size="small" color={C.white} />
                        ) : (
                          <Ionicons name="send" size={14} color={C.white} />
                        )}
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 14,
                              letterSpacing: 0.2,
                              color: C.white,
                            },
                          ]}
                        >
                          {broadcastSending ? "SENDING..." : "SEND TO ALL"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // CHAT VIEW
  // ==========================================================================
  const isTargetAdmin =
    selectedUser?.role === "admin" ||
    selectedUser?.uid === "KLQoW8g03nT22j2vCd9NELRXq0r1";
  const liveTarget =
    usersList.find((u) => u.uid === selectedUser?.uid) || selectedUser;
  const currentStatus =
    (isTargetAdmin ? adminStatus : liveTarget?.status || "offline") ===
    "online";

  const headerRole = isTargetAdmin
    ? "ADMIN"
    : liveTarget?.role === "tech" || liveTarget?.role === "user"
      ? "TECHNICIAN"
      : "PERSONNEL";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
      <ImageModal />

      {/* Document modal */}
      <Modal
        visible={!!documentToView}
        animationType="slide"
        onRequestClose={closeAllModals}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 40,
              paddingBottom: 14,
              backgroundColor: C.maroon,
            }}
          >
            <View>
              <Text
                style={[
                  mono,
                  {
                    fontSize: 13,
                    letterSpacing: 0.2,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  },
                ]}
              >
                VIEWING
              </Text>
              <Text
                style={[font("700"), { fontSize: 14, color: C.white }]}
                numberOfLines={1}
              >
                {documentToView?.name || "Document"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeAllModals}
              style={{
                padding: 8,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 4,
              }}
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, position: "relative" }}>
            {isDocLoading && (
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: C.white,
                }}
              >
                <ActivityIndicator size="large" color={C.maroon} />
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 13,
                      letterSpacing: 0.2,
                      color: C.muted,
                      marginTop: 12,
                      textTransform: "uppercase",
                    },
                  ]}
                >
                  LOADING DOCUMENT...
                </Text>
              </View>
            )}
            {documentToView?.url && (
              <WebView
                source={{ uri: documentToView.url }}
                style={{ flex: 1 }}
                onLoadEnd={() => setIsDocLoading(false)}
                startInLoadingState
                renderLoading={() => null}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Chat header */}
      <View
        style={{
          backgroundColor: C.maroon,
          paddingTop: 40,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => {
            setActiveView("list");
            setSelectedUser(null);
            setMessages([]);
            setEditingId(null);
            setSelectedFile(null);
            closeAllModals();
            Keyboard.dismiss();
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.25)",
            backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={18} color="white" />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={{ position: "relative", marginRight: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 4,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {liveTarget?.profilePicture ? (
              <TouchableOpacity
                style={{ width: "100%", height: "100%" }}
                onPress={() => setViewingImage(liveTarget.profilePicture)}
              >
                <Image
                  source={{ uri: liveTarget.profilePicture }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : isTargetAdmin ? (
              <Ionicons
                name="shield-checkmark"
                size={18}
                color="rgba(255,255,255,0.7)"
              />
            ) : (
              <Text
                style={[
                  font("700"),
                  { fontSize: 16, color: "rgba(255,255,255,0.85)" },
                ]}
              >
                {liveTarget?.fullName?.charAt(0).toUpperCase() || "?"}
              </Text>
            )}
          </View>
          <View style={{ position: "absolute", bottom: -2, right: -2 }}>
            <StatusDot online={currentStatus} size={10} border={2} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              font("700"),
              { fontSize: 16, color: C.white, letterSpacing: -0.3 },
            ]}
            numberOfLines={1}
          >
            {liveTarget?.fullName || "Unknown User"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 3,
              gap: 6,
            }}
          >
            <Text
              style={[
                mono,
                {
                  fontSize: 13,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                  color: currentStatus ? "#6EE7B7" : "rgba(255,255,255,0.5)",
                },
              ]}
            >
              ● {currentStatus ? "ONLINE" : "OFFLINE"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              •
            </Text>
            <Text
              style={[
                mono,
                {
                  fontSize: 13,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.6)",
                },
              ]}
            >
              {headerRole}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider label */}
      <View
        style={{
          backgroundColor: C.bg,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          paddingHorizontal: 16,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text
          style={[
            mono,
            {
              fontSize: 13,
              letterSpacing: 0.2,
              textTransform: "uppercase",
              color: C.muted,
            },
          ]}
        >
          CONVERSATION LOG
        </Text>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: C.border,
            marginLeft: 10,
          }}
        />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(i) => i.id}
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        onContentSizeChange={() =>
          messages.length > 0 &&
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() =>
          messages.length > 0 &&
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={({ item }) => {
          const cu = auth.currentUser;
          const sender = item.sender || item.senderUid;
          const isMe = sender === cu?.uid || sender === "tech";
          const isImage =
            item.attachmentType?.startsWith("image/") ||
            (!item.attachmentType && item.attachmentUrl);
          const isDoc = item.attachmentUrl && !isImage;

          return (
            <View
              style={{
                marginBottom: 14,
                alignItems: isMe ? "flex-end" : "flex-start",
              }}
            >
              {!isMe && (
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 13,
                      letterSpacing: 0.2,
                      color: C.muted,
                      marginBottom: 4,
                      marginLeft: 2,
                      textTransform: "uppercase",
                    },
                  ]}
                >
                  {getSenderName(sender)}
                </Text>
              )}

              <TouchableOpacity
                onLongPress={() =>
                  isMe &&
                  Alert.alert("Options", "Choose an action", [
                    ...(item.text && !item.attachmentUrl
                      ? [
                          {
                            text: "Edit",
                            onPress: () => {
                              setInputText(item.text);
                              setEditingId(item.id);
                              inputRef.current?.focus();
                            },
                          },
                        ]
                      : []),
                    {
                      text: "Delete",
                      onPress: () => handleDelete(item.id),
                      style: "destructive",
                    },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
                activeOpacity={0.85}
                style={{
                  maxWidth: "82%",
                  backgroundColor: isMe ? C.maroon : C.white,
                  borderWidth: 1,
                  borderColor: isMe ? C.maroonMid : C.border,
                  borderRadius: 4,
                  borderBottomRightRadius: isMe ? 0 : 4,
                  borderBottomLeftRadius: isMe ? 4 : 0,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                }}
              >
                {isImage && (
                  <TouchableOpacity
                    onPress={() => setViewingImage(item.attachmentUrl)}
                    activeOpacity={0.9}
                    style={{
                      marginBottom: item.text ? 8 : 0,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      source={{ uri: item.attachmentUrl }}
                      style={{ width: 200, height: 200 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {isDoc && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: C.bg,
                      padding: 10,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: C.border,
                      marginBottom: item.text ? 8 : 0,
                      width: 220,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                      onPress={() =>
                        openDocumentInApp(
                          item.attachmentUrl,
                          item.attachmentName,
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          padding: 6,
                          backgroundColor: "#EFF6FF",
                          borderRadius: 4,
                        }}
                      >
                        <Ionicons
                          name="document-text"
                          size={18}
                          color="#2563eb"
                        />
                      </View>
                      <View style={{ marginLeft: 10, flexShrink: 1 }}>
                        <Text
                          style={[font("700"), { fontSize: 14, color: C.text }]}
                          numberOfLines={1}
                        >
                          {item.attachmentName || "Document"}
                        </Text>
                        <Text
                          style={[
                            mono,
                            {
                              fontSize: 13,
                              color: C.muted,
                              marginTop: 2,
                              textTransform: "uppercase",
                              letterSpacing: 0.8,
                            },
                          ]}
                        >
                          TAP TO VIEW
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        padding: 6,
                        marginLeft: 4,
                        backgroundColor: C.border,
                        borderRadius: 4,
                      }}
                      onPress={() => Linking.openURL(item.attachmentUrl)}
                    >
                      <Ionicons name="download" size={14} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                )}

                {item.text ? (
                  <Text
                    style={[
                      font("400"),
                      {
                        fontSize: 14,
                        color: isMe ? C.white : C.text,
                        lineHeight: 20,
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Metadata */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  paddingHorizontal: 2,
                  gap: 6,
                }}
              >
                <Text
                  style={[
                    mono,
                    { fontSize: 13, color: C.muted, letterSpacing: 0.5 },
                  ]}
                >
                  {formatTime(item.timestamp)}
                </Text>
                {item.isEdited && (
                  <Text
                    style={[
                      mono,
                      { fontSize: 13, color: C.mutedLight, letterSpacing: 0.5 },
                    ]}
                  >
                    (edited)
                  </Text>
                )}
                {isMe && (
                  <Text
                    style={[
                      mono,
                      {
                        fontSize: 13,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: item.seen ? "#2471A3" : C.mutedLight,
                      },
                    ]}
                  >
                    ·{" "}
                    {item.seen
                      ? "SEEN"
                      : item.status === "delivered"
                        ? "DELIVERED"
                        : "SENT"}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Input bar */}
      <View
        style={{
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
        }}
      >
        {editingId && (
          <View
            style={{
              backgroundColor: C.bg,
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            <Text
              style={[
                mono,
                {
                  fontSize: 13,
                  color: C.muted,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                },
              ]}
            >
              EDITING MESSAGE
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditingId(null);
                setInputText("");
              }}
            >
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          </View>
        )}

        {selectedFile && (
          <View
            style={{
              backgroundColor: "#EFF6FF",
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: "#DBEAFE",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                paddingRight: 12,
              }}
            >
              {selectedFile.isImage ? (
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: C.border,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: C.border,
                    backgroundColor: C.white,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="document-text" size={18} color="#2563eb" />
                </View>
              )}
              <Text
                style={[
                  mono,
                  { fontSize: 14, color: "#1e40af", marginLeft: 10, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {selectedFile.name || "Attachment ready"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedFile(null)}
              style={{
                padding: 6,
                backgroundColor: C.white,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Ionicons name="close" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={handlePickDocument}
            style={{
              width: 38,
              height: 38,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Ionicons
              name="document-attach"
              size={18}
              color={
                selectedFile && !selectedFile.isImage ? "#2563eb" : C.muted
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickImage}
            style={{
              width: 38,
              height: 38,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Ionicons
              name="image"
              size={18}
              color={selectedFile && selectedFile.isImage ? "#2563eb" : C.muted}
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[
              font("400"),
              {
                flex: 1,
                backgroundColor: C.bg,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                maxHeight: 100,
                color: C.text,
              },
            ]}
            placeholder={`Message ${liveTarget?.fullName?.split(" ")[0] || "user"}...`}
            placeholderTextColor={C.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={uploading || (inputText.trim() === "" && !selectedFile)}
            style={{
              marginLeft: 10,
              width: 44,
              height: 44,
              borderRadius: 4,
              backgroundColor: editingId ? "#2563eb" : C.maroon,
              alignItems: "center",
              justifyContent: "center",
              opacity:
                uploading || (inputText.trim() === "" && !selectedFile)
                  ? 0.4
                  : 1,
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons
                name={editingId ? "checkmark" : "send"}
                size={18}
                color="white"
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={{
          height: keyboardHeight > 0 ? keyboardHeight + 35 : TAB_BAR_HEIGHT,
        }}
      />
    </SafeAreaView>
  );
};

export default TechMessenger;
