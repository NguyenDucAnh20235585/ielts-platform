import Link from "next/link";
import FoundationIcon from "./foundation-icons";
import { FoundationHeader } from "./foundation-interactions";
import { FoundationTheme } from "./foundation-theme";
import styles from "./foundation.module.css";

const skills = [
  { name: "Reading", icon: "book", type: "READING" },
  { name: "Listening", icon: "headphones", type: "LISTENING" },
] as const;

export default function FoundationPage() {
  return (
    <FoundationTheme>
      <a className={styles.skipLink} href="#noi-dung-chinh">
        Chuyển đến nội dung chính
      </a>
      <FoundationHeader />

      <main id="noi-dung-chinh" className={styles.main}>
        <span className={`${styles.corner} ${styles.cornerTop}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.cornerBottom}`} aria-hidden="true" />

        <div className={styles.dashboard}>
          <div className={styles.heading}>
            <h1>Ms Chau’s IELTS</h1>
            <svg className={styles.underline} viewBox="0 0 240 16" fill="none" aria-hidden="true">
              <path d="M3 12C65 1 165 1 237 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M22 14C84 5 162 5 215 12" stroke="currentColor" strokeOpacity=".3" strokeLinecap="round" />
            </svg>
            <p>READING &amp; LISTENING PRACTICE</p>
          </div>

          <nav className={styles.skillsGrid} aria-label="Chọn kỹ năng luyện tập">
            {skills.map((skill) => (
              <Link
                key={skill.type}
                href={`/student/tests?type=${skill.type}`}
                className={styles.skillCard}
                aria-label={`Luyện ${skill.name}`}
              >
                <FoundationIcon name={skill.icon} className={styles.skillIcon} strokeWidth="1.1" />
                <h2>{skill.name}</h2>
                <span className={styles.skillArrow} aria-hidden="true">
                  <FoundationIcon name="arrow" width="19" height="19" />
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <Link href="/" className={styles.footerBrand}>Ms Chau’s IELTS</Link>
          <a href="mailto:mschau.ielts@gmail.com" className={styles.contactLink}>
            <FoundationIcon name="mail" width="19" height="19" />
            <span>mschau.ielts@gmail.com</span>
          </a>
        </div>
      </footer>
    </FoundationTheme>
  );
}
