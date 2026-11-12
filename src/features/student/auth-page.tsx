"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/features/auth/supabase-browser";
import { FoundationFooter } from "@/features/foundation/foundation-footer";
import FoundationIcon from "@/features/foundation/foundation-icons";
import { FoundationHeader } from "@/features/foundation/foundation-interactions";
import { FoundationTheme } from "@/features/foundation/foundation-theme";
import foundation from "@/features/foundation/foundation.module.css";
import { errorText } from "./api";
import s from "./auth.module.css";

type AuthMode = "login" | "register" | "forgot" | "reset";
const headings: Record<AuthMode, string> = {
  login: "Chào mừng trở lại",
  register: "Tạo tài khoản",
  forgot: "Quên mật khẩu?",
  reset: "Đặt mật khẩu mới",
};
const descriptions: Record<AuthMode, string> = {
  login: "Đăng nhập để tiếp tục hành trình luyện IELTS của bạn.",
  register: "Lưu tiến trình và theo dõi kết quả sau mỗi buổi luyện tập.",
  forgot: "Nhập email đã đăng ký để nhận liên kết khôi phục mật khẩu.",
  reset: "Tạo mật khẩu mới để tiếp tục luyện tập cùng Ms Chau’s IELTS.",
};

function AuthNotice({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <div className={`${s.notice} ${danger ? s.errorNotice : ""}`} role={danger ? "alert" : "status"}>
      <FoundationIcon name={danger ? "info" : "check"} width="19" height="19" />
      <p>{children}</p>
    </div>
  );
}
function authMessage(code: string | undefined) {
  return ({ invalid_credentials: "Email hoặc mật khẩu chưa đúng.", email_not_confirmed: "Bạn cần xác nhận email trước khi đăng nhập.",
    user_already_exists: "Email này đã có tài khoản. Hãy đăng nhập.", weak_password: "Mật khẩu chưa đủ mạnh. Hãy thử mật khẩu khác.",
    over_email_send_rate_limit: "Vui lòng chờ một chút trước khi yêu cầu gửi email lại.", otp_expired: "Liên kết đã hết hạn. Hãy yêu cầu một liên kết mới." } as Record<string, string>)[code ?? ""] ?? "Chưa thể xử lý yêu cầu. Kiểm tra thông tin và thử lại.";
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
  function nextRoute() {
    const value = new URLSearchParams(window.location.search).get("next");
    return value?.startsWith("/student") && !value.includes("\\") ? value : "/student";
  }
  useEffect(() => {
    let active = true;
    try {
      const supabase = supabaseBrowser();
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (mode === "reset") {
          setRecoveryReady(Boolean(data.session));
          if (!data.session || sessionError) setError("Liên kết khôi phục chưa hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại email.");
        } else if (data.session && mode === "login") {
          const value = new URLSearchParams(window.location.search).get("next");
          router.replace(value?.startsWith("/student") && !value.includes("\\") ? value : "/student");
        }
      }).catch((err: unknown) => { if (active) setError(errorText(err)); });
    } catch (err) { void Promise.resolve().then(() => { if (active) setError(errorText(err)); }); }
    return () => { active = false; };
  }, [mode, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if ((mode === "register" || mode === "reset") && password !== confirm) { setError("Hai mật khẩu chưa khớp."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const supabase = supabaseBrowser();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) { setError(authMessage(authError.code)); return; }
        router.replace(nextRoute()); router.refresh();
      } else if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin + "/login" } });
        if (authError) { setError(authMessage(authError.code)); return; }
        if (data.session) { router.replace("/student"); router.refresh(); }
        else setMessage("Kiểm tra hộp thư và mở liên kết xác nhận email để hoàn tất đăng ký.");
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/reset-password" });
        if (authError) { setError(authMessage(authError.code)); return; }
        setMessage("Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) { setError(authMessage(authError.code)); return; }
        setMessage("Mật khẩu đã được cập nhật. Bạn có thể tiếp tục vào khu vực học viên.");
      }
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return (
    <FoundationTheme>
      <a className={foundation.skipLink} href="#noi-dung-tai-khoan">Chuyển đến nội dung chính</a>
      <FoundationHeader accountAction={mode === "login" ? "register" : "login"} />

      <main id="noi-dung-tai-khoan" className={s.main} tabIndex={-1}>
        <span className={`${foundation.corner} ${foundation.cornerTop}`} aria-hidden="true" />
        <span className={`${foundation.corner} ${foundation.cornerBottom}`} aria-hidden="true" />

        <section className={s.card} aria-labelledby="auth-heading">
          <div className={s.cardHeader}>
            <span className={s.authIcon}>
              <FoundationIcon
                name={mode === "forgot" || mode === "reset" ? "shield" : mode === "register" ? "user-plus" : "book"}
                width="26"
                height="26"
              />
            </span>
            <p className={s.eyebrow}>READING &amp; LISTENING PRACTICE</p>
            <h1 id="auth-heading">{headings[mode]}</h1>
            <p className={s.description}>{descriptions[mode]}</p>
          </div>

          {error && <AuthNotice danger>{error}</AuthNotice>}
          {message && <AuthNotice>{message}</AuthNotice>}

          <form onSubmit={(event) => void submit(event)} className={s.form} aria-busy={busy}>
            {mode !== "reset" && (
              <div className={s.field}>
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Nhập email của bạn"
                />
              </div>
            )}

            {mode !== "forgot" && (
              <div className={s.field}>
                <label htmlFor="auth-password">{mode === "reset" ? "Mật khẩu mới" : "Mật khẩu"}</label>
                <div className={s.passwordField}>
                  <input
                    id="auth-password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "login" ? undefined : 8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "login" ? "Nhập mật khẩu" : "Tạo mật khẩu của bạn"}
                    aria-describedby={mode === "login" ? undefined : "auth-password-hint"}
                  />
                  <button
                    type="button"
                    className={s.passwordToggle}
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={show}
                    aria-controls={mode === "register" || mode === "reset" ? "auth-password auth-confirm" : "auth-password"}
                  >
                    <FoundationIcon name={show ? "eye-off" : "eye"} width="19" height="19" />
                  </button>
                </div>
                {mode !== "login" && <p id="auth-password-hint" className={s.fieldHint}>Sử dụng ít nhất 8 ký tự.</p>}
              </div>
            )}

            {(mode === "register" || mode === "reset") && (
              <div className={s.field}>
                <label htmlFor="auth-confirm">Xác nhận mật khẩu</label>
                <input
                  id="auth-confirm"
                  name="confirmPassword"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
            )}

            {mode === "login" && <Link href="/forgot-password" className={`${s.textLink} ${s.forgotLink}`}>Quên mật khẩu?</Link>}

            <button className={s.primaryButton} type="submit" disabled={busy || !recoveryReady}>
              {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : mode === "register" ? "Tạo tài khoản" : mode === "forgot" ? "Gửi liên kết khôi phục" : "Cập nhật mật khẩu"}
              {busy ? <span className={s.spinner} aria-hidden="true" /> : <FoundationIcon name="arrow" width="18" height="18" />}
            </button>
          </form>

          <div className={s.accountSwitch}>
            {mode === "login" ? <>Chưa có tài khoản? <Link href="/register" className={s.textLink}>Đăng ký</Link></>
              : mode === "register" ? <>Đã có tài khoản? <Link href="/login" className={s.textLink}>Đăng nhập</Link></>
                : <Link href={mode === "reset" && message ? "/student" : "/login"} className={s.textLink}>
                  {mode === "reset" && message ? "Vào khu vực học viên" : "Quay lại đăng nhập"}
                </Link>}
          </div>
          <Link href="/" className={`${s.textLink} ${s.homeLink}`}>
            <FoundationIcon name="arrow" className={s.backIcon} width="15" height="15" />Trang chủ
          </Link>
        </section>
      </main>

      <FoundationFooter />
    </FoundationTheme>
  );
}
