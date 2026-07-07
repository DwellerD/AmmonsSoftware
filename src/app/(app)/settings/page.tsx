"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorAlert, SuccessAlert } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { USER_ROLES } from "@/lib/constants";
import { getDb } from "@/lib/firebase/client";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type AppTheme,
} from "@/lib/theme";

const THEMES: Array<{ value: AppTheme; label: string; description: string }> = [
  { value: "light", label: "Light", description: "Always light appearance" },
  { value: "dark", label: "Dark", description: "Always dark appearance" },
  {
    value: "system",
    label: "System",
    description: "Follow your device theme",
  },
];

export default function SettingsPage() {
  const { firebaseUser, profile, role } = useAuth();

  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [theme, setTheme] = useState<AppTheme>("system");

  const roleLabel = useMemo(
    () => USER_ROLES.find((r) => r.value === role)?.label ?? "Member",
    [role],
  );

  useEffect(() => {
    setFullName(profile?.full_name ?? firebaseUser?.displayName ?? "");
  }, [profile?.full_name, firebaseUser?.displayName]);

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    persistTheme(theme);
    applyTheme(theme);

    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) {
      setProfileError("You must be signed in to update profile settings.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      const nextName = fullName.trim();
      await updateProfile(firebaseUser, {
        displayName: nextName || null,
      });

      await setDoc(
        doc(getDb(), "users", firebaseUser.uid),
        {
          email: firebaseUser.email,
          full_name: nextName,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );

      setProfileSaved(true);
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : "Failed to save your profile settings.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your account details and display preferences."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic user information</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={saveProfile} className="space-y-4">
              {profileError && <ErrorAlert message={profileError} />}
              {profileSaved && (
                <SuccessAlert message="Settings saved. Your profile has been updated." />
              )}

              <Field label="Full name" htmlFor="settings-full-name">
                <Input
                  id="settings-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </Field>

              <Field label="Email" htmlFor="settings-email">
                <Input
                  id="settings-email"
                  value={firebaseUser?.email ?? ""}
                  disabled
                  readOnly
                />
              </Field>

              <Field label="Role" htmlFor="settings-role">
                <Input id="settings-role" value={roleLabel} disabled readOnly />
              </Field>

              <Button type="submit" loading={savingProfile}>
                Save profile
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-ink-600">
              Choose how PhaseBinder looks for you.
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              {THEMES.map((option) => {
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={
                      active
                        ? "rounded-lg border border-brand-500 bg-brand-50 px-3 py-2 text-left text-sm"
                        : "rounded-lg border border-ink-200 bg-surface px-3 py-2 text-left text-sm hover:bg-ink-50"
                    }
                    aria-pressed={active}
                  >
                    <p className="font-medium text-ink-900">{option.label}</p>
                    <p className="text-xs text-ink-500">{option.description}</p>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-ink-500">
              Current theme: <span className="font-medium text-ink-700">{theme}</span>
            </p>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
