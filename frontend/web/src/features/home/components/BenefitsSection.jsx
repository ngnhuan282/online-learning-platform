import Icon from '../../../shared/components/Icon';

const benefits = [
  {
    icon: 'shield',
    color: 'blue',
    title: 'Giảng viên 8.5+ IELTS',
    text: 'Đội ngũ giáo viên bản ngữ và cựu giám khảo khóa thi giàu kinh nghiệm sư phạm quốc tế.',
  },
  {
    icon: 'tune',
    color: 'cyan',
    title: 'Lộ trình cá nhân hóa',
    text: 'Phân tích kiến thức bám sát khung tham chiếu CEFR từ A1 đến C2 theo năng lực thực tế.',
  },
  {
    icon: 'speaking',
    color: 'green',
    title: 'Chấm phát âm Realtime',
    text: 'Công nghệ nhận diện giọng nói AI chỉ rõ vị trí đặt lưỡi, nối âm và ngữ điệu tự nhiên.',
  },
  {
    icon: 'bot',
    color: 'purple',
    title: 'Luyện nói không sợ sai',
    text: 'AI Tutor đồng hành 1-1 kiên nhẫn, gợi ý từ vựng và sửa lỗi ngữ pháp ngay tức thì.',
  },
];

export default function BenefitsSection() {
  return (
    <section className="benefits-section section-tinted" id="benefits">
      <div className="container">
        <div className="section-heading centered">
          <span className="eyebrow">LỢI ÍCH VƯỢT TRỘI</span>
          <h2>Tại sao chọn SGEdu English?</h2>
          <p>
            Môi trường luyện ngôn ngữ hiện đại, kết hợp phương pháp phản xạ khoa học và trợ lý AI thông minh
            24/7.
          </p>
        </div>
        <div className="benefit-grid">
          {benefits.map(benefit => (
            <article className="benefit-card" key={benefit.title}>
              <span className={`feature-icon ${benefit.color}`}>
                <Icon name={benefit.icon} size={25} />
              </span>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
