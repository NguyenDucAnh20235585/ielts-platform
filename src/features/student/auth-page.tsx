"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/features/auth/supabase-browser";
import { errorText, studentApi } from "./api";
import type { StudentUser } from "./types";
import { Brand, Notice } from "./ui";
import { StudentIcon } from "./student-icons";
import s from "./student.module.css";

type AuthMode = "login" | "register" | "forgot" | "reset";
const headings: Record<AuthMode, string> = {
  login: "Chào mừng bạn trở lại",
  register: "Bắt đầu hành trình luyện IELTS",
  forgot: "Khôi phục mật khẩu",
  reset: "Đặt mật khẩu mới",
};
function authMessage(code: string | undefined) {
  return (
    (
      {
        invalid_credentials: "Email hoặc mật khẩu chưa đúng.",
        email_not_confirmed: "Bạn cần xác nhận email trước khi đăng nhập.",
        user_already_exists: "Email này đã có tài khoản. Hãy đăng nhập.",
        weak_password: "Mật khẩu chưa đủ mạnh. Hãy thử mật khẩu khác.",
        over_email_send_rate_limit:
          "Vui lòng chờ một chút trước khi yêu cầu gửi email lại.",
        otp_expired: "Liên kết đã hết hạn. Hãy yêu cầu một liên kết mới.",
      } as Record<string, string>
    )[code ?? ""] ?? "Chưa thể xử lý yêu cầu. Kiểm tra thông tin và thử lại."
  );
}
export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(mode !== "reset");

  async function nextRoute() {
    // Xác thực với backend trước khi redirect
    const user = await studentApi<StudentUser>("/api/me");

    const value = new URLSearchParams(window.location.search).get("next");

    if (
      value &&
      /^\/(student|admin)(\/|$|\?)/.test(value) &&
      !/[\\\r\n]/.test(value)
    ) {
      return value;
    }

    return user.role === "ADMIN" ? "/admin/tests" : "/student";
  }

  useEffect(() => {
    let active = true;
    try {
      const supabase = supabaseBrowser();
      void supabase.auth
        .getSession()
        .then(async ({ data, error: sessionError }) => {
          if (!active) return;
          if (mode === "reset") {
            setRecoveryReady(Boolean(data.session));
            if (!data.session || sessionError)
              setError(
                "Liên kết khôi phục chưa hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại email.",
              );
          } else if (data.session && mode === "login") {
            const target = await nextRoute();
            if (active) router.replace(target);
          }
        })
        .catch((err: unknown) => {
          if (active) setError(errorText(err));
        });
    } catch (err) {
      void Promise.resolve().then(() => {
        if (active) setError(errorText(err));
      });
    }
    return () => {
      active = false;
    };
  }, [mode, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if ((mode === "register" || mode === "reset") && password !== confirm) {
      setError("Hai mật khẩu chưa khớp.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = supabaseBrowser();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authMessage(authError.code));
          return;
        }
        router.replace(await nextRoute());
        router.refresh();
      } else if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/login" },
        });
        if (authError) {
          setError(authMessage(authError.code));
          return;
        }
        if (data.session) {
          router.replace("/student");
          router.refresh();
        } else
          setMessage(
            "Kiểm tra hộp thư và mở liên kết xác nhận email để hoàn tất đăng ký.",
          );
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin + "/reset-password" },
        );
        if (authError) {
          setError(authMessage(authError.code));
          return;
        }
        setMessage(
          "Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.",
        );
      } else {
        const { error: authError } = await supabase.auth.updateUser({
          password,
        });
        if (authError) {
          setError(authMessage(authError.code));
          return;
        }
        setMessage(
          "Mật khẩu đã được cập nhật. Bạn có thể tiếp tục vào khu vực học viên.",
        );
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={[s.root, s.authPage].join(" ")}>
      <header className={s.authHeader}>
        <Brand />
        <Link className={s.backLink} href="/">
          <StudentIcon name="back" width="16" height="16" />
          Trang chủ
        </Link>
      </header>
      <main className={s.authCard}>
        <span className={s.authIcon}>
          <StudentIcon
            name={mode === "forgot" || mode === "reset" ? "shield" : "book"}
            width="30"
            height="30"
          />
        </span>
        <span className={s.eyebrow}>IELTS READING & LISTENING</span>
        <h1>{headings[mode]}</h1>
        <p>
          {mode === "login"
            ? "Đăng nhập để tiếp tục bài làm và xem kết quả của bạn."
            : mode === "register"
              ? "Tạo tài khoản để lưu tiến trình và lịch sử làm bài."
              : "Lấy lại quyền truy cập tài khoản của bạn."}
        </p>
        {error && <Notice danger>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <form onSubmit={(event) => void submit(event)} className={s.authForm}>
          {mode !== "reset" && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email của bạn"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              {mode === "reset" ? "Mật khẩu mới" : "Mật khẩu"}
              <div className={s.passwordField}>
                <input
                  type={show ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "login" ? undefined : 8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {show ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>
          )}
          {(mode === "register" || mode === "reset") && (
            <label>
              Xác nhận mật khẩu
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          )}
          {mode === "login" && (
            <Link href="/forgot-password" className={s.authForgot}>
              Quên mật khẩu?
            </Link>
          )}
          <button
            className={s.primaryButton}
            type="submit"
            disabled={busy || !recoveryReady}
          >
            {busy
              ? "Đang xử lý…"
              : mode === "login"
                ? "Đăng nhập"
                : mode === "register"
                  ? "Tạo tài khoản"
                  : mode === "forgot"
                    ? "Gửi liên kết khôi phục"
                    : "Cập nhật mật khẩu"}
            <StudentIcon name="arrow" width="18" height="18" />
          </button>
        </form>
        <div className={s.authSwitch}>
          {mode === "login" ? (
            <>
              Chưa có tài khoản? <Link href="/register">Đăng ký</Link>
            </>
          ) : mode === "register" ? (
            <>
              Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
            </>
          ) : (
            <Link href={mode === "reset" && message ? "/student" : "/login"}>
              {mode === "reset" && message
                ? "Vào khu vực học viên"
                : "Quay lại đăng nhập"}
            </Link>
          )}
        </div>
      </main>
      <p className={s.authFooter}>
        Luyện tập có định hướng. Tự tin hơn với IELTS.
      </p>
    </div>
  );
}
