"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkUsernameAvailable, getEditableProfile, updateProfileAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeUsername, usernameSchema } from "@/lib/validation";
import {
  PROFILE_USERNAME_FIELD,
  isProfileEditReady,
  type ProfileEditDraft,
  type ProfileEditStatus,
} from "./edit-state";

export function ProfileEditForm() {
  const router = useRouter();
  const [status, setStatus] = useState<ProfileEditStatus>("loading");
  const [draft, setDraft] = useState<ProfileEditDraft | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [handleFocused, setHandleFocused] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useRef(false);
  const [savedUsername, setSavedUsername] = useState("");

  function applyLoaded(
    result: Awaited<ReturnType<typeof getEditableProfile>>,
  ) {
    if ("error" in result) {
      setDraft(null);
      setLoadError(
        result.error === "NO_USERNAME"
          ? "Không lấy được tên người dùng của hồ sơ này."
          : "Không tải được hồ sơ. Kiểm tra kết nối rồi thử lại.",
      );
      setStatus("error");
      return;
    }
    if (!isProfileEditReady(result.profile)) {
      setDraft(null);
      setLoadError("Hồ sơ chưa có đủ tên hiển thị hoặc tên người dùng.");
      setStatus("error");
      return;
    }
    dirty.current = false;
    setSavedUsername(result.profile.username);
    setDraft(result.profile);
    setUsernameError(null);
    setStatus("ready");
  }

  function loadProfile() {
    setStatus("loading");
    setLoadError(null);
    start(async () => {
      applyLoaded(await getEditableProfile());
    });
  }

  useEffect(() => {
    let cancelled = false;
    void getEditableProfile().then((result) => {
      if (cancelled) return;
      applyLoaded(result);
    });
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onLeave);
    };
  }, []);

  function markDirty() {
    dirty.current = true;
  }

  async function validateUsername(raw: string) {
    const next = normalizeUsername(raw);
    if (!next) {
      setUsernameError("Tên người dùng không được để trống.");
      return false;
    }
    const parsed = usernameSchema.safeParse(next);
    if (!parsed.success) {
      setUsernameError(parsed.error.issues[0]?.message ?? "Tên người dùng không hợp lệ.");
      return false;
    }
    if (next === savedUsername) {
      setUsernameError(null);
      return true;
    }
    const check = await checkUsernameAvailable(next);
    if (!check.available) {
      setUsernameError(check.reason === "TAKEN" ? "Tên người dùng này đã được dùng." : "Tên người dùng không hợp lệ.");
      return false;
    }
    setUsernameError(null);
    return true;
  }

  if (status === "loading") {
    return (
      <div className="mt-6 space-y-4" aria-busy="true" aria-live="polite">
        <p className="sr-only">Đang tải hồ sơ</p>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (status === "error" || !draft) {
    return (
      <div className="mt-6 rounded-2xl border border-brand/10 bg-surface px-4 py-5">
        <p className="text-sm text-destructive">{loadError ?? "Không tải được hồ sơ."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={loadProfile}>
            Thử lại
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/me">Quay về hồ sơ</Link>
          </Button>
        </div>
      </div>
    );
  }

  const submitting = status === "submitting" || pending;
  const username = draft.username;

  return (
    <form
      className="mt-6 space-y-4"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (submitting) return;
        const form = e.currentTarget;
        start(async () => {
          setStatus("submitting");
          const ok = await validateUsername(username);
          if (!ok) {
            setStatus("ready");
            return;
          }
          const result = await updateProfileAction(new FormData(form));
          if (result && "error" in result && result.error) {
            if (result.error === "USERNAME_TAKEN") setUsernameError("Tên người dùng này đã được dùng.");
            else if (result.error === "USERNAME_REQUIRED" || result.error === "INVALID") {
              setUsernameError("Tên người dùng không hợp lệ.");
            }
            toast.error("Không lưu được hồ sơ. Nội dung bạn đã nhập vẫn còn.");
            setStatus("ready");
            return;
          }
          dirty.current = false;
          setStatus("success");
          toast.success("Đã cập nhật hồ sơ");
          if (result && "username" in result) {
            router.push(`/user/${result.username}`);
            router.refresh();
          }
        });
      }}
    >
      <div>
        <Label htmlFor="displayName">Tên hiển thị</Label>
        <Input
          id="displayName"
          name="displayName"
          value={draft.displayName}
          autoComplete="name"
          required
          className="mt-1"
          onChange={(e) => {
            markDirty();
            setDraft({ ...draft, displayName: e.target.value });
          }}
        />
      </div>
      <div>
        <Label htmlFor={PROFILE_USERNAME_FIELD}>Tên người dùng</Label>
        <Input
          id={PROFILE_USERNAME_FIELD}
          name={PROFILE_USERNAME_FIELD}
          value={username}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          readOnly={!handleFocused}
          required
          aria-invalid={Boolean(usernameError)}
          aria-describedby={usernameError ? "username-error" : undefined}
          className="mt-1"
          onFocus={() => setHandleFocused(true)}
          onChange={(e) => {
            markDirty();
            setDraft({ ...draft, username: normalizeUsername(e.target.value) });
            setUsernameError(null);
          }}
          onBlur={() => void validateUsername(username)}
        />
        {usernameError ? (
          <p id="username-error" className="mt-1 text-sm text-destructive" role="alert">
            {usernameError}
          </p>
        ) : (
          <p className="mt-1 text-xs text-[#6F7480]">Không gồm ký tự @. Chỉ chữ thường, số và dấu gạch dưới.</p>
        )}
      </div>
      <div>
        <Label htmlFor="bio">Giới thiệu</Label>
        <Textarea
          id="bio"
          name="bio"
          value={draft.bio}
          className="mt-1"
          maxLength={280}
          onChange={(e) => {
            markDirty();
            setDraft({ ...draft, bio: e.target.value });
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting || !username.trim()}>
          {submitting ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={savedUsername ? `/user/${savedUsername}` : "/me"}>Huỷ</Link>
        </Button>
      </div>
    </form>
  );
}
