import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { categoryApi } from '../../courses/api/categoryApi';
import { normalizeCategoryList } from '../../courses/utils/courseCatalog';
import ErrorState from '../../../shared/components/ErrorState';

const keywords = [
  { keyword: 'IELTS 7.0+' },
  { keyword: 'TOEIC Cấp tốc' },
  { keyword: 'Tiếng Anh Giao tiếp' },
  { keyword: 'Du lịch', label: 'Tiếng Anh Du lịch' },
  { keyword: 'English for Developers' },
  { keyword: 'Tiếng Anh Thương mại' },
];

export default function CategorySection() {
  useLocale();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      setError(null);
      try {
        const response = await categoryApi.list();
        if (isMounted) setCategories(normalizeCategoryList(response));
      } catch (failure) {
        if (isMounted) setError(failure);
      }
    };

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [attempt]);

  function search(value, category) {
    const params = new URLSearchParams();
    if (value) params.set('q', value);
    if (category) params.set('category', category);
    navigate(`/?${params.toString()}#courses`);
    document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
  }
  return (
    <>
      <section className="search-section" aria-label={t('Tìm khóa học phù hợp')}>
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
              aria-label={t('Bạn muốn cải thiện kỹ năng gì hôm nay?')}
              placeholder={t('Bạn muốn cải thiện kỹ năng gì hôm nay? (VD: IELTS, TOEIC...)')}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <button className="button button-primary" type="submit">
              {t('Tìm kiếm')} <Icon name="arrow" size={18} />
            </button>
          </form>
          <div className="popular-keywords">
            <span>{t('Từ khóa phổ biến:')}</span>
            {keywords.map(({ keyword, label }) => (
              <button
                key={keyword}
                onClick={() => {
                  setQuery(keyword);
                  search(keyword);
                }}
              >
                {label ? t(label) : keyword}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="categories-section section-tinted" id="categories">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('CHUYÊN ĐỀ TRỌNG TÂM')}</span>
              <h2>{t('Danh mục khóa học Tiếng Anh phổ biến')}</h2>
              <p>{t('Lộ trình học bài bản từ mất gốc đến thành thạo, bám sát các tiêu chuẩn quốc tế.')}</p>
            </div>
            <button className="text-link" onClick={() => search('')}>
              {t('Xem tất cả danh mục')} <Icon name="arrow" size={17} />
            </button>
          </div>
          {error && (
            <ErrorState
              error={error}
              title={t('Không thể tải danh mục')}
              onRetry={() => setAttempt(value => value + 1)}
            />
          )}
          <div className="category-grid">
            {categories.map(category => (
              <button className="category-card" key={category.id} onClick={() => search('', category.id)}>
                <span className={`feature-icon ${category.color || 'blue'}`}>
                  <Icon name={category.icon || 'cap'} size={25} />
                </span>
                <h3>{t(category.name)}</h3>
                <p>{t(category.description)}</p>
                <span className="category-bottom">
                  <span>
                    {category.count != null ? `${category.count} khóa học` : t('Khám phá khóa học')}
                  </span>
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
