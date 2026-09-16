import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { categories } from '../../courses/data/demoCourses';

const keywords = [
  'IELTS 7.0+',
  'TOEIC Cấp tốc',
  'Tiếng Anh Giao tiếp',
  'Phát âm chuẩn Mỹ',
  'English for Developers',
  'Tiếng Anh Thương mại',
];

export default function CategorySection() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  function search(value, category) {
    const params = new URLSearchParams();
    if (value) params.set('q', value);
    if (category) params.set('category', category);
    navigate(`/?${params.toString()}#courses`);
    document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
  }
  return (
    <>
      <section className="search-section" aria-label="Tìm khóa học phù hợp">
        <div className="discovery-search-wrap">
          <form
            className="discovery-search"
            role="search"
            onSubmit={event => {
              event.preventDefault();
              search(query.trim());
            }}
          >
            <Icon name="search" size={25} />
            <input
              aria-label="Bạn muốn cải thiện kỹ năng gì hôm nay?"
              placeholder="Bạn muốn cải thiện kỹ năng gì hôm nay? (VD: IELTS Speaking, TOEIC 800+...)"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <button className="button button-primary" type="submit">
              Tìm kiếm <Icon name="arrow" size={18} />
            </button>
          </form>
          <div className="popular-keywords">
            <span>Từ khóa phổ biến:</span>
            {keywords.map(keyword => (
              <button
                key={keyword}
                onClick={() => {
                  setQuery(keyword);
                  search(keyword);
                }}
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="categories-section section-tinted" id="categories">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CHUYÊN ĐỀ TRỌNG TÂM</span>
              <h2>Danh mục khóa học Tiếng Anh phổ biến</h2>
              <p>Lộ trình học bài bản từ mất gốc đến thành thạo, bám sát các tiêu chuẩn quốc tế.</p>
            </div>
            <button className="text-link" onClick={() => search('')}>
              Xem tất cả danh mục <Icon name="arrow" size={17} />
            </button>
          </div>
          <div className="category-grid">
            {categories.map(category => (
              <button className="category-card" key={category.id} onClick={() => search('', category.id)}>
                <span className={`feature-icon ${category.color}`}>
                  <Icon name={category.icon} size={25} />
                </span>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <span className="category-bottom">
                  <span>{category.count} khóa học</span>
                  <Icon name="arrow" size={23} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
