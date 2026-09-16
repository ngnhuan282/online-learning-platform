import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import Icon from '../../../shared/components/Icon';

const waveform = [
  12, 20, 14, 28, 36, 18, 25, 42, 30, 16, 24, 38, 48, 26, 18, 32, 44, 22, 14, 30, 40, 24, 18, 34, 46, 28, 16,
  22, 38, 26, 14, 32, 44, 20, 30, 16, 26, 38, 18, 12,
];

export default function HeroSection() {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <section className="hero-section">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow-pill">Nền tảng học Tiếng Anh thông minh thế hệ mới</div>
          <h1>
            Master English without limits.
            <br />
            <span>Build your global future.</span>
          </h1>
          <p>
            Khám phá các khóa học Tiếng Anh chất lượng cao, từ giao tiếp thực tế đến luyện thi chứng chỉ IELTS
            & TOEIC, cùng gia sư AI luyện phát âm và phản xạ 24/7.
          </p>
          <div className="hero-actions">
            <a href="#courses" className="button button-primary">
              Khám phá khóa học <Icon name="arrow" size={18} />
            </a>
            <a href="#ai-tutor" className="button button-outline">
              <Icon name="mic" size={18} /> Luyện nói với AI
            </a>
          </div>
          <div className="hero-stats">
            <div>
              <strong>50,000+</strong>
              <span>Học viên toàn quốc</span>
            </div>
            <div>
              <strong>8.5 IELTS</strong>
              <span>Điểm đầu ra kỷ lục</span>
            </div>
            <div>
              <strong>98%</strong>
              <span>Tự tin giao tiếp</span>
            </div>
          </div>
        </div>
        <div className="studio-wrap">
          <div className="studio-card">
            <div className="studio-toolbar">
              <div className="window-dots">
                <i />
                <i />
                <i />
              </div>
              <span>learnsphere.vn/english/pronunciation-studio</span>
              <span className="live-badge">
                <i /> AI Pronunciation Lab
              </span>
            </div>
            <button
              className="lesson-preview pronunciation-preview"
              onClick={() => setPreviewOpen(true)}
              aria-label="Xem thử bài học Business Negotiation & Fluent Office Pitching"
            >
              <img
                className="lesson-background"
                src="/images/english-speaking.jpg"
                alt="Thực hành tiếng Anh giao tiếp trong một buổi trao đổi nhóm"
                fetchPriority="high"
              />
              <div className="lesson-topbar">
                <span>Bài 12: Business Negotiation & Fluent Office Pitching</span>
                <b>Native Accent</b>
              </div>
              <div className="speech-visualization" aria-hidden="true">
                <span className="speech-caption">PRACTICE YOUR PRONUNCIATION</span>
                <div className="speech-waveform">
                  {waveform.map((height, index) => (
                    <i key={index} style={{ height }} />
                  ))}
                </div>
                <div className="speech-feedback">
                  <span className="speech-mic">
                    <Icon name="wave" size={22} />
                  </span>
                  <div>
                    <strong>“Could you walk me through the key deliverables?”</strong>
                    <small>Phát âm 92% · Trọng âm · Intonation: Perfect Rising-Falling</small>
                  </div>
                  <b>Band 8.0</b>
                </div>
              </div>
              <div className="player-controls">
                <span className="play-circle">
                  <Icon name="play" size={25} />
                </span>
                <span>14:15 / 22:30</span>
                <div className="player-control-icons">
                  <Icon name="volume" size={17} />
                  <Icon name="settings" size={17} />
                  <Icon name="expand" size={21} />
                </div>
              </div>
            </button>
            <div className="studio-course">
              <strong>IELTS Speaking Masterclass: Band 7.5+ Intensive</strong>
              <span>78% Hoàn thành</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Tiến độ minh họa"
              aria-valuenow={78}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: '78%' }} />
            </div>
            <button className="continue-learning" onClick={() => setPreviewOpen(true)}>
              Tiếp tục luyện nói <Icon name="arrow" size={14} />
            </button>
          </div>
          <a href="#ai-tutor" className="tutor-status">
            <span className="ai-icon">
              <Icon name="wave" size={25} />
            </span>
            <span>
              <strong>
                AI Speech Coach <i />
              </strong>
              <small>Chấm ngữ điệu & chỉnh âm chuẩn IPA 24/7</small>
            </span>
          </a>
        </div>
      </div>
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="english-preview-title"
      >
        <DialogTitle id="english-preview-title" className="dialog-heading">
          Xem thử bài học
          <button className="icon-button" aria-label="Đóng" onClick={() => setPreviewOpen(false)}>
            <Icon name="close" />
          </button>
        </DialogTitle>
        <DialogContent>
          <div className="lesson-reading english-lesson">
            <span className="eyebrow">BUSINESS ENGLISH · SPEAKING PRACTICE</span>
            <h2>Business Negotiation & Fluent Office Pitching</h2>
            <p>Luyện cách đặt câu hỏi lịch sự và trình bày ý tưởng tự tin trong cuộc họp bằng tiếng Anh.</p>
            <blockquote>
              “Could you walk me through the key deliverables?”
              <span>Bạn có thể giải thích cho tôi các hạng mục chính cần bàn giao không?</span>
            </blockquote>
            <h3>Cùng luyện tập</h3>
            <ol>
              <li>
                Đọc chậm từng cụm: <b>Could you / walk me through / the key deliverables?</b>
              </li>
              <li>
                Nhấn rõ các từ mang ý chính: <b>walk, key, deliverables</b>.
              </li>
              <li>Thay “the key deliverables” bằng “the project timeline” để tạo câu mới.</li>
            </ol>
            <p>
              <strong>Tình huống:</strong> Bạn vừa tham gia một dự án mới. Hãy hỏi đồng nghiệp về các mốc thời
              gian và công việc cần hoàn thành.
            </p>
            <a href="#ai-tutor" className="button button-primary" onClick={() => setPreviewOpen(false)}>
              <Icon name="mic" size={18} />
              Thử luyện hội thoại
            </a>
            <p className="demo-note">
              Nội dung và điểm phát âm trên màn hình là minh họa. Video, ghi âm và chấm phát âm chưa được kết
              nối.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
