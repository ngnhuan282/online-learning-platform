import { useRef, useState } from 'react';
import Icon from '../../../shared/components/Icon';
import { normalizeSearch } from '../../courses/data/demoCourses';

const features = [
  'Chấm điểm phát âm chuẩn xác từng âm vị IPA, gợi ý chỉnh khẩu hình.',
  'Gợi ý từ vựng nâng cao (Paraphrasing) và mẫu câu tự nhiên của người bản xứ.',
  'Đóng vai (Role-play) đa tình huống: Phỏng vấn xin việc, đàm phán, du lịch.',
  'Sửa lỗi ngữ pháp & Collocations trong bài viết và câu nói tức thì.',
];
const replies = [
  {
    match: /feedback|email|manager|thuong mai|cong so/,
    text: 'Bạn có thể nói: “I would appreciate your feedback on the updated project plan when you have a moment.” Cách trực tiếp hơn: “Could you please share your feedback on the latest draft by Thursday afternoon?” Dùng “could you please” để đưa ra yêu cầu lịch sự.',
  },
  {
    match: /ielts|speaking|band/,
    text: 'Với IELTS Speaking, hãy thử mở rộng câu trả lời theo 3 bước: trả lời trực tiếp, giải thích lý do, rồi đưa ví dụ. Ví dụ: “I enjoy reading because it helps me unwind. For instance, I usually read a few pages before bed.”',
  },
  {
    match: /toeic|listening|reading/,
    text: 'Khi luyện TOEIC Listening, hãy đọc trước câu hỏi, nghe ý chính và ghi lại từ khóa. Sau khi kiểm tra đáp án, nghe lại cùng transcript để tìm đoạn bạn chưa hiểu và luyện cách diễn đạt tương đương.',
  },
  {
    match: /ipa|phat am|pronunciation|accent/,
    text: 'Thử phân biệt /iː/ trong “sheep” và /ɪ/ trong “ship”. Âm /iː/ thường dài hơn, còn /ɪ/ ngắn và thả lỏng hơn. Bạn có thể luyện theo cặp: sheep – ship, leave – live. Bản trải nghiệm này chưa nghe hoặc chấm giọng nói của bạn.',
  },
  {
    match: /interview|phong van|developer|tech/,
    text: 'Khi giới thiệu bản thân trong buổi phỏng vấn, thử mẫu: “I am a software developer with experience in building web applications. I enjoy solving problems and working with international teams.” Sau đó thêm một ví dụ ngắn về đóng góp của bạn.',
  },
  {
    match: /grammar|ngu phap|vocabulary|tu vung/,
    text: 'Một collocation hữu ích là “make progress” (tiến bộ). Ví dụ: “I am making progress in English by practising every day.” Hãy học từ vựng trong cả cụm từ và tự đặt một câu gắn với cuộc sống của bạn.',
  },
];

export default function AiTutorSection() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);
  const chatRef = useRef(null);
  function sendMessage(event) {
    event.preventDefault();
    if (!question.trim()) return;
    const answer =
      replies.find(reply => reply.match.test(normalizeSearch(question)))?.text ||
      'Bạn có thể hỏi về IELTS Speaking, TOEIC, phát âm IPA, viết email lịch sự, phỏng vấn hoặc ngữ pháp. Thử nhập: “How do I ask my manager for feedback politely in an email?”';
    setMessages(previous => [...previous, { question: question.trim(), answer }]);
    setQuestion('');
    requestAnimationFrame(() =>
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }),
    );
  }
  return (
    <section className="ai-section" id="ai-tutor">
      <div className="container">
        <div className="ai-panel">
          <div className="ai-copy">
            <span className="eyebrow-pill">Gia sư AI độc quyền</span>
            <h2>
              Luyện phát âm & Giao tiếp phản xạ cùng <span>Trợ lý AI</span>
            </h2>
            <p>
              Trợ lý AI chuyên ngữ đồng hành 24/7 giúp bạn tự tin nói tiếng Anh tự nhiên như người bản xứ mà
              không e ngại hay áp lực.
            </p>
            <ul>
              {features.map(feature => (
                <li key={feature}>
                  <span>
                    <Icon name="check" size={16} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className="button button-primary"
              onClick={() => {
                inputRef.current?.focus();
                inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              <Icon name="mic" size={18} />
              Luyện nói với AI ngay
            </button>
          </div>
          <div className="ai-chat">
            <div className="ai-chat-header">
              <span className="ai-icon">
                <Icon name="wave" size={22} />
              </span>
              <div>
                <strong>SGEdu AI Speaking Coach</strong>
                <span>
                  <i /> Đang học: Business Email & Meetings
                </span>
              </div>
              <span className="model-badge">
                Voice AI
                <br />
                2.0
              </span>
            </div>
            <div
              className="chat-messages"
              ref={chatRef}
              role="log"
              aria-label="Hội thoại luyện tiếng Anh với trợ lý AI"
            >
              <div className="user-message">
                <div>
                  <small>Bạn (Học viên)</small>
                  <p>How do I ask my project manager for feedback politely in an email?</p>
                </div>
                <span className="user-avatar">U</span>
              </div>
              <div className="assistant-message">
                <span className="assistant-avatar">
                  <Icon name="language" size={16} />
                </span>
                <div>
                  <strong>Here are 2 natural, native-level ways:</strong>
                  <div className="english-response-option">
                    <b>Option 1 (Professional & Collaborative):</b>
                    <p>
                      “I’d really appreciate your thoughts on the updated sprint plan when you have a moment.”
                    </p>
                  </div>
                  <div className="english-response-option">
                    <b>Option 2 (Direct & Action-oriented):</b>
                    <p>“Could you please share your feedback on the latest draft by Thursday afternoon?”</p>
                  </div>
                  <div className="speaking-tip">
                    <Icon name="check" size={14} />
                    Bạn chọn một cách diễn đạt và thử luyện nói nhé!
                  </div>
                </div>
              </div>
              {messages.map((message, index) => (
                <div key={index}>
                  <div className="user-message">
                    <div>
                      <small>Bạn (Học viên)</small>
                      <p>{message.question}</p>
                    </div>
                    <span className="user-avatar">U</span>
                  </div>
                  <div className="assistant-message">
                    <span className="assistant-avatar">
                      <Icon name="language" size={16} />
                    </span>
                    <div>
                      <p>{message.answer}</p>
                      <small className="demo-note">Phản hồi minh họa · Chưa kết nối AI chấm phát âm</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form className="chat-form" onSubmit={sendMessage}>
              <input
                ref={inputRef}
                aria-label="Câu hỏi luyện tiếng Anh cho trợ lý AI"
                placeholder="Thử hỏi: ‘Can you give me an example for…’"
                value={question}
                onChange={event => setQuestion(event.target.value)}
                maxLength={1000}
              />
              <button className="button button-primary" aria-label="Gửi câu hỏi" disabled={!question.trim()}>
                <Icon name="arrow" size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
