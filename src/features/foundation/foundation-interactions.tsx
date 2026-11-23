"use client";

import Link from "next/link";
import { useRef } from "react";
import FoundationIcon from "./foundation-icons";
import { FoundationThemeToggle } from "./foundation-theme";
import styles from "./foundation.module.css";

export function FoundationHeader({ accountAction = "login" }: { accountAction?: "login" | "register" }) {
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const register = accountAction === "register";

  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="Ms Chau’s IELTS — Trang chủ">
          Ms Chau’s IELTS
        </Link>

        <nav className={styles.headerActions} aria-label="Điều hướng chính">
          <button
            type="button"
            className={styles.aboutButton}
            aria-label="Giới thiệu"
            aria-haspopup="dialog"
            aria-controls="foundation-about"
            onClick={() => aboutDialog.current?.showModal()}
          >
            <FoundationIcon name="info" width="18" height="18" />
            <span>Giới thiệu</span>
          </button>
          <FoundationThemeToggle />
          <Link href={register ? "/register" : "/login?next=%2Fstudent%2Ftests"} className={styles.loginButton}>
            <FoundationIcon name={register ? "user-plus" : "user"} width="18" height="18" />
            <span>{register ? "Đăng ký" : "Đăng nhập"}</span>
          </Link>
        </nav>
      </div>

      <dialog
        ref={aboutDialog}
        id="foundation-about"
        className={styles.aboutDialog}
        aria-labelledby="foundation-about-title"
        aria-describedby="foundation-about-description"
      >
        <div className={styles.aboutContent}>
          <form method="dialog" className={styles.dialogCloseForm}>
            <button type="submit" className={styles.dialogClose} aria-label="Đóng giới thiệu">
              <FoundationIcon name="close" width="21" height="21" />
            </button>
          </form>
          <span className={styles.dialogEyebrow}>READING &amp; LISTENING PRACTICE</span>
          <h2 id="foundation-about-title">Ms Chau’s IELTS</h2>
          <p id="foundation-about-description">
            Không gian luyện tập IELTS Reading và Listening. Chọn kỹ năng, luyện tập
            hoặc thi thử, lưu tiến trình và xem lại kết quả sau mỗi bài làm.
          </p>
          <p>Đăng nhập để bắt đầu buổi luyện tập và tiếp tục các bài đang làm của bạn.</p>
          <a href="mailto:mschau.ielts@gmail.com" className={styles.contactLink}>
            <FoundationIcon name="mail" width="19" height="19" />
            <span>mschau.ielts@gmail.com</span>
          </a>
        </div>
      </dialog>
    </header>
  );
}
