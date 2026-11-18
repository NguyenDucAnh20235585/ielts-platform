import Link from "next/link";
import FoundationIcon from "./foundation-icons";
import styles from "./foundation.module.css";

export function FoundationFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <Link href="/" className={styles.footerBrand}>Ms Chau’s IELTS</Link>
        <a href="mailto:mschau.ielts@gmail.com" className={styles.contactLink}>
          <FoundationIcon name="mail" width="19" height="19" />
          <span>mschau.ielts@gmail.com</span>
        </a>
      </div>
    </footer>
  );
}
