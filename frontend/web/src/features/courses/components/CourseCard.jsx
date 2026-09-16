import Icon from '../../../shared/components/Icon';
import { formatPrice } from '../data/demoCourses';

export default function CourseCard({ course, onSelect }) {
  return (
    <article className="course-card">
      <button
        className="course-image-button"
        onClick={() => onSelect(course)}
        aria-label={`Xem khóa học ${course.title}`}
      >
        <img src={course.image} alt={course.imageAlt} loading="lazy" width="640" height="360" />
        <span className="course-badges">
          <span>{course.tag}</span>
          {course.price === 0 && <b>MIỄN PHÍ</b>}
        </span>
      </button>
      <div className="course-card-body">
        <div className="course-rating">
          <span>
            <b className="star">★</b> <strong>{course.rating}</strong> ({course.reviews} đánh giá)
          </span>
          <span>•</span>
          <span>{new Intl.NumberFormat('en-US').format(course.students)} học viên</span>
        </div>
        <h3>
          <button onClick={() => onSelect(course)}>{course.title}</button>
        </h3>
        <p>{course.description}</p>
        <div className="course-meta">
          <span>
            <Icon name="clock" size={14} />
            {course.hours} giờ
          </span>
          <span>
            <Icon name="level" size={15} />
            {course.level}
          </span>
        </div>
        <div className={`course-price ${course.price === 0 ? 'free-price' : ''}`}>
          <strong>{course.price === 0 ? 'Miễn phí (0đ)' : formatPrice(course.price)}</strong>
          <div>
            {course.originalPrice ? (
              <>
                <s>{formatPrice(course.originalPrice)}</s>
                {course.discount && <span>−{course.discount}%</span>}
              </>
            ) : (
              <span>Truy cập trọn đời</span>
            )}
          </div>
        </div>
        <button
          className={`button course-action ${course.price === 0 ? 'button-success' : 'button-soft'}`}
          onClick={() => onSelect(course)}
        >
          {course.price === 0 ? 'Học ngay' : 'Xem khóa học'}
          <Icon name={course.price === 0 ? 'cap' : 'arrow'} size={16} />
        </button>
      </div>
    </article>
  );
}
