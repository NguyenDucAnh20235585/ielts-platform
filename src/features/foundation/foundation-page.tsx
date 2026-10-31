import FoundationIcon, { type FoundationIconName } from "./foundation-icons";
import { AccountButton, FoundationHeader, FoundationProvider } from "./foundation-interactions";
import styles from "./foundation.module.css";

const skills: {
  name: string;
  icon: FoundationIconName;
  structure: string;
  title: string;
  description: string;
  benefits: string[];
  action: string;
}[] = [
  {
    name: "READING", icon: "book", structure: "3 Passages • 40 Câu hỏi",
    title: "Rèn kỹ năng đọc hiểu",
    description:
      "Thực hành các bài đọc học thuật với đầy đủ dạng bài chuẩn: Multiple Choice, True/False/Not Given, Matching Headings và Summary Completion. Giao diện chia đôi màn hình trực quan giúp tra cứu văn bản nhanh chóng.",
    benefits: ["Hỗ trợ tô sáng từ khóa (highlight)", "Điều chỉnh kích cỡ văn bản linh hoạt", "Dạng câu hỏi bám sát cấu trúc bài thi"],
    action: "Bắt đầu luyện Reading",
  },
  {
    name: "LISTENING", icon: "headphones", structure: "4 Sections • 40 Câu hỏi",
    title: "Luyện nghe với bài tập có cấu trúc",
    description:
      "Luyện tập 4 Sections với âm thanh chất lượng cao, chia đoạn rõ ràng. Kiểm soát tốc độ phát, tua đoạn nghe trọng tâm và làm quen với các giọng phát âm Anh - Úc - Bắc Mỹ chuẩn bài thi.",
    benefits: ["Audio tương thích mượt mà theo từng câu hỏi", "Hỗ trợ điều chỉnh tốc độ 0.8x - 1.2x", "Trải nghiệm nghe liền mạch không phân tâm"],
    action: "Bắt đầu luyện Listening",
  },
];

const features: { icon: FoundationIconName; title: string; description: string; note: string }[] = [
  {
    icon: "scales", title: "Luyện tập hoặc thi thử",
    description: "Chọn trải nghiệm phù hợp với nhu cầu. Chế độ Luyện tập cho phép tự do tra cứu và xem giải thích; chế độ Thi thử bấm giờ nghiêm ngặt theo chuẩn áp lực phòng thi.",
    note: "2 Chế độ linh hoạt",
  },
  {
    icon: "cloud", title: "Tự lưu tiến trình",
    description: "Hệ thống tự động đồng bộ từng đáp án vừa nhập trong suốt quá trình làm bài, đảm bảo không bao giờ gián đoạn hay mất dữ liệu khi gặp sự cố mạng.",
    note: "Tự động từng giây",
  },
  {
    icon: "history", title: "Tiếp tục bài đang làm",
    description: "Quay lại bài làm dang dở bất kỳ lúc nào với đầy đủ tiến trình đã lưu. Dễ dàng sắp xếp thời gian ôn tập linh hoạt cho sinh viên và người bận rộn.",
    note: "Không lo đứt quãng",
  },
  {
    icon: "clipboard", title: "Xem lại kết quả",
    description: "Xem điểm quy đổi, số câu đúng/sai chi tiết và bảng đáp án/lời giải đối chiếu khi cấu hình đề thi cho phép, giúp người học nhận ra điểm yếu cụ thể.",
    note: "Báo cáo chuẩn xác",
  },
];

const steps: { icon: FoundationIconName; title: string; description: string }[] = [
  {
    icon: "user-plus", title: "Đăng nhập hoặc tạo tài khoản",
    description: "Tạo tài khoản nhanh chóng để lưu trữ lịch sử làm bài và theo dõi lộ trình cá nhân.",
  },
  {
    icon: "sliders", title: "Chọn kỹ năng & chế độ làm bài",
    description: "Lựa chọn Reading hoặc Listening cùng chế độ phù hợp: Luyện tập tự do hoặc Thi thử tính giờ.",
  },
  {
    icon: "clipboard", title: "Làm bài, nộp bài & xem kết quả",
    description: "Thực hiện bài thi với giao diện không phân tâm, nộp bài để nhận bảng kết quả và lời giải tham khảo.",
  },
];

const waveform = [12, 23, 16, 30, 19, 25, 14, 31, 21, 27, 12, 18, 25, 14, 20, 12, 24, 17, 12, 21, 15, 10, 16, 9];

function LearningPreview() {
  return (
    <div className={styles.previewWrapper} role="img" aria-label="Minh họa giao diện Reading và Listening với câu hỏi, audio và trạng thái lưu bài">
      <span className={styles.previewLabel}><FoundationIcon name="monitor" width="13" height="13" />Minh họa giao diện</span>
      <div className={styles.preview}>
        <div className={styles.previewToolbar}>
          <div className={styles.previewWindow}>
            <span className={styles.windowDot} /><span className={styles.windowDot} /><span className={styles.windowDot} />
            <span className={styles.previewTimer}>28:45 còn lại</span>
          </div>
          <div className={styles.previewBadges}>
            <span className={styles.previewMode}>Chế độ: Luyện tập</span>
            <span className={styles.previewSaved}><FoundationIcon name="shield" width="12" height="12" />Đã lưu 14:20</span>
          </div>
        </div>
        <div className={styles.readingPreview}>
          <div className={styles.passagePreview}>
            <div className={styles.previewTitleRow}><strong>Passage 1</strong><span>Đoạn 1/3</span></div>
            <p className={styles.passageTitle}>The Evolution of Urban Architecture</p>
            <p className={styles.passageText}>Historically, metropolitan layouts reflected social hierarchies and access to trade waterways. The…</p>
            <div className={styles.passageLines}><span /><span /></div>
          </div>
          <div className={styles.questionPreview}>
            <strong>Questions 1–4</strong>
            <span className={styles.questionInstruction}>True / False / Not Given</span>
            <p className={styles.questionPrompt}>1. Early trade systems were...</p>
            <div className={styles.demoAnswerSelected}>
              <span className={styles.demoRadioSelected}><FoundationIcon name="check" width="9" height="9" /></span>TRUE
            </div>
            <div className={styles.demoAnswer}><span className={styles.demoRadio} />FALSE</div>
            <div className={styles.questionPreviewFooter}><span>Câu đã làm: 1/4</span><span>Tiếp tục →</span></div>
          </div>
        </div>
        <div className={styles.audioPreview}>
          <div className={styles.audioPreviewTop}>
            <span className={styles.audioPlay}>
              <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-hidden="true"><path d="M1 1v10l9-5-9-5Z" /></svg>
            </span>
            <div className={styles.audioDescription}><strong>Section 2: Campus Accommodation Tour</strong><span>Speaker: Admissions Officer</span></div>
            <span className={styles.audioTime}>04:12 / 07:30</span>
          </div>
          <div className={styles.waveform}>
            {waveform.map((height, index) => (
              <span key={index} className={index > 10 ? styles.waveformPending : undefined} style={{ height: `${height}px` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FoundationPage() {
  return (
    <FoundationProvider>
      <div className={styles.page}>
        <a className={styles.skipLink} href="#noi-dung-chinh">Chuyển đến nội dung chính</a>
        <FoundationHeader />
        <main id="noi-dung-chinh">
          <section id="gioi-thieu" className={styles.hero} aria-labelledby="hero-heading">
            <div className={`${styles.container} ${styles.heroGrid}`}>
              <div className={styles.heroContent}>
                <span className={`${styles.eyebrow} ${styles.heroEyebrow}`}><span className={styles.eyebrowDot} />LUYỆN IELTS READING & LISTENING</span>
                <h1 id="hero-heading">Luyện tập có định hướng.<br />Tự tin hơn với IELTS.</h1>
                <p className={styles.heroDescription}>Luyện đọc và nghe, trải nghiệm chế độ thi thử và xem lại kết quả để hiểu rõ bài làm của bạn.</p>
                <div className={styles.heroActions}>
                  <AccountButton className={`${styles.button} ${styles.primaryButton}`}>Bắt đầu luyện tập<FoundationIcon name="arrow" width="17" height="17" /></AccountButton>
                  <a href="#cach-luyen-tap" className={`${styles.button} ${styles.secondaryButton}`}>Khám phá cách luyện tập<FoundationIcon name="compass" width="17" height="17" /></a>
                </div>
                <div className={styles.heroTrust}>
                  <span><FoundationIcon name="book" width="16" height="16" />Hai kỹ năng Reading & Listening</span>
                  <span><FoundationIcon name="save" width="16" height="16" />Tự động lưu bài làm</span>
                </div>
              </div>
              <LearningPreview />
            </div>
          </section>
          <section id="ky-nang" className={`${styles.section} ${styles.skillsSection}`} aria-labelledby="skills-heading">
            <div className={styles.container}>
              <div className={styles.centeredHeading}>
                <span className={styles.eyebrow}>KỸ NĂNG TRỌNG TÂM</span>
                <h2 id="skills-heading">Thiết kế chuyên biệt cho Reading<br className={styles.desktopBreak} /> và Listening</h2>
                <p>Tối ưu hóa từng thao tác đọc đề, nghe audio và điền đáp án chuẩn định dạng đề thi.</p>
              </div>
              <div className={styles.skillsGrid}>
                {skills.map((skill) => (
                  <article key={skill.name} className={styles.skillCard}>
                    <div className={styles.skillMeta}>
                      <span className={styles.skillBadge}><FoundationIcon name={skill.icon} width="17" height="17" />{skill.name}</span>
                      <span className={styles.skillStructure}>{skill.structure}</span>
                    </div>
                    <h3>{skill.title}</h3>
                    <p className={styles.skillDescription}>{skill.description}</p>
                    <ul className={styles.skillBenefits}>
                      {skill.benefits.map((benefit) => (
                        <li key={benefit}><span className={styles.benefitCheck}><FoundationIcon name="check" width="11" height="11" /></span>{benefit}</li>
                      ))}
                    </ul>
                    <div className={styles.skillAction}>
                      <AccountButton className={styles.textButton}>{skill.action}<FoundationIcon name="arrow" width="18" height="18" /></AccountButton>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section id="diem-noi-bat" className={styles.section} aria-labelledby="features-heading">
            <div className={styles.container}>
              <div className={styles.featuresHeading}>
                <span className={styles.eyebrow}>TÍNH NĂNG NỔI BẬT</span>
                <h2 id="features-heading">Trải nghiệm học tập tập trung và<br className={styles.desktopBreak} /> liền mạch</h2>
                <p>Mọi tính năng được xây dựng nhằm hỗ trợ việc rèn luyện thói quen làm bài chủ động và kỷ luật.</p>
              </div>
              <div className={styles.featuresGrid}>
                {features.map((feature) => (
                  <article key={feature.title} className={styles.featureCard}>
                    <span className={styles.featureIcon}><FoundationIcon name={feature.icon} width="23" height="23" /></span>
                    <h3>{feature.title}</h3><p>{feature.description}</p><span className={styles.featureNote}>{feature.note}</span>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section id="cach-luyen-tap" className={`${styles.section} ${styles.stepsSection}`} aria-labelledby="steps-heading">
            <div className={styles.container}>
              <div className={styles.centeredHeading}>
                <span className={styles.eyebrow}>QUY TRÌNH HỌC TẬP</span>
                <h2 id="steps-heading">3 bước đơn giản để bắt đầu<br className={styles.desktopBreak} /> rèn luyện</h2>
              </div>
              <ol className={styles.stepsGrid}>
                {steps.map((step, index) => (
                  <li key={step.title} className={styles.stepCard}>
                    <div className={styles.stepTop}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.stepIcon}><FoundationIcon name={step.icon} width="19" height="19" /></span></div>
                    <h3>{step.title}</h3><p>{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <section className={styles.ctaSection} aria-labelledby="cta-heading">
            <div className={styles.container}>
              <div className={styles.ctaCard}>
                <span className={`${styles.eyebrow} ${styles.ctaEyebrow}`}>SẴN SÀNG CHO BUỔI HỌC HÔM NAY?</span>
                <h2 id="cta-heading">Bắt đầu buổi luyện IELTS của bạn</h2>
                <p>Chọn một bài Reading hoặc Listening để luyện tập ngay bây giờ và cảm nhận sự tiến bộ qua từng đề.</p>
                <AccountButton className={`${styles.button} ${styles.tealButton}`}>Bắt đầu luyện tập<FoundationIcon name="arrow" width="18" height="18" /></AccountButton>
                <span className={styles.ctaNote}><FoundationIcon name="shield" width="15" height="15" />Hoàn toàn miễn phí đăng ký • Trải nghiệm ngay trên trình duyệt</span>
              </div>
            </div>
          </section>
        </main>
        <footer className={styles.footer}>
          <div className={styles.container}>
            <div className={styles.footerGrid}>
              <div className={styles.footerAbout}>
                <a href="#gioi-thieu" className={styles.footerBrand}><span className={styles.footerBrandIcon}><FoundationIcon name="book" width="20" height="20" /></span>IELTS Reading & Listening</a>
                <p>Nền tảng luyện tập Reading & Listening tinh gọn, tập trung và đáng tin cậy dành cho người học IELTS.</p>
              </div>
              <nav className={styles.footerLinks} aria-label="Lối tắt nội dung">
                <h3>Lối tắt nội dung</h3>
                <a href="#gioi-thieu">Giới thiệu</a>
                <a href="#ky-nang">Kỹ năng Reading & Listening</a>
                <a href="#diem-noi-bat">Chế độ luyện tập & thi thử</a>
                <a href="#cach-luyen-tap">Hướng dẫn bắt đầu</a>
              </nav>
              <div className={styles.footerLinks}>
                <h3>Tài khoản</h3>
                <AccountButton className={styles.footerAccountButton}>Đăng nhập</AccountButton>
                <AccountButton className={styles.footerAccountButton} intent="register">Đăng ký tài khoản</AccountButton>
              </div>
            </div>
            <div className={styles.footerBottom}>
              <p>© 2025 IELTS Reading & Listening. Thiết kế phục vụ trải nghiệm học thuật tập trung.</p>
              <span>Cam kết chuẩn đề Cambridge</span>
            </div>
          </div>
        </footer>
      </div>
    </FoundationProvider>
  );
}
