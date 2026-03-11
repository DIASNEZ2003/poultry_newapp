import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { get, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "./firebaseConfig"; // Adjust path if needed

// ── Font helpers ──────────────────────────────────────────────────────────────
const font = (weight: any = "400") => ({
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontWeight: weight,
});
const mono = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
};

const PersonnelProfile = () => {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile States ONLY
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/TechHome");
        return;
      }

      try {
        const snapshot = await get(ref(db, `users/${user.uid}`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setProfileImage(data.profilePicture || null);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load profile data.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  // Handle saving the updated profile
  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Validation", "First name and last name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await update(ref(db, `users/${user.uid}`), {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: `${firstName.trim()} ${lastName.trim()}`,
        });
        Alert.alert("Success", "Profile updated successfully!");
        router.back();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update profile.");
      console.error(error);
    } finally {
      setSaving(false);
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
          LOADING PROFILE...
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
                ACCOUNT
              </Text>
              <Text
                style={[font("700"), { fontSize: 24, letterSpacing: -0.5 }]}
                className="text-white"
              >
                Profile Settings
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-8"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* ── AVATAR DISPLAY ──────────────────────────────────────────────── */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 rounded-full border-2 border-[#3B0A0A] overflow-hidden justify-center items-center bg-[#FAF7F7] mb-3">
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  className="w-full h-full"
                />
              ) : (
                <Text style={[font("700"), { fontSize: 32, color: "#3B0A0A" }]}>
                  {firstName?.[0] || "?"}
                </Text>
              )}
            </View>
            <Text
              style={[
                mono,
                {
                  fontSize: 14,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                },
              ]}
              className="text-[#8C6A6A]"
            >
              PROFILE PICTURE
            </Text>
          </View>

          {/* ── EDIT FORM ───────────────────────────────────────────────────── */}
          <View className="mb-6">
            {/* First Name Field */}
            <View className="mb-4">
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
                FIRST NAME
              </Text>
              <View className="flex-row items-center bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-3.5">
                <Ionicons name="person-outline" size={18} color="#8C6A6A" />
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Enter First Name"
                  placeholderTextColor="#D4B8B8"
                  style={[font("600"), { fontSize: 15, color: "#1A0505" }]}
                  className="flex-1 ml-3"
                />
              </View>
            </View>

            {/* Last Name Field */}
            <View className="mb-8">
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
                LAST NAME
              </Text>
              <View className="flex-row items-center bg-[#FAF7F7] border border-[#EDE0E0] rounded-xl px-4 py-3.5">
                <Ionicons name="person-outline" size={18} color="#8C6A6A" />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Enter Last Name"
                  placeholderTextColor="#D4B8B8"
                  style={[font("600"), { fontSize: 15, color: "#1A0505" }]}
                  className="flex-1 ml-3"
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`py-4 rounded-xl items-center justify-center flex-row shadow-sm ${
                saving ? "bg-[#3B0A0A]/70" : "bg-[#3B0A0A]"
              }`}
            >
              {saving ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  className="mr-2"
                />
              ) : (
                <Ionicons
                  name="save-outline"
                  size={20}
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
                {saving ? "SAVING CHANGES..." : "SAVE PROFILE"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PersonnelProfile;
