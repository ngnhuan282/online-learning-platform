import Icon from '../../../shared/components/Icon';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import { formatPrice } from '../data/demoCourses';

export default function CourseCard({
  course,
  canEnroll = false,
  enrolled = false,
  enrolling = false,
  onEnroll,
  onSelect,
}) {
  const isFree = course.price === 0;
  const actionLabel = enrolled ? 'Đã ghi danh' : isFree && canEnroll ? 'Học ngay' : 'Xem khóa học';

  return (
    <article className="course-card">
      <button
        className="course-image-button"
        onClick={() => onSelect(course)}
        aria-label={`Xem khóa học ${course.title}`}
      >
        <img
          src={resolveMediaUrl(course.image)}
          alt={course.imageAlt}
          loading="lazy"
          width="640"
          height="360"
        />
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
          {course.students != null && (
            <>
              <span>•</span>
              <span>{new Intl.NumberFormat('en-US').format(course.students)} học viên</span>
            </>
          )}
        </div>
        <h3>
          <button onClick={() => onSelect(course)}>{course.title}</button>
        </h3>
        <p>{course.description}</p>
        <div className="course-meta">
          {course.hours != null && (
            <span>
              <Icon name="clock" size={14} />
              {course.hours} giờ
            </span>
          )}
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
          className={`button course-action ${isFree && canEnroll ? 'button-success' : 'button-soft'}`}
          disabled={enrolling || enrolled}
          onClick={() => (isFree && canEnroll ? onEnroll(course) : onSelect(course))}
        >
          {enrolling ? 'Đang ghi danh...' : actionLabel}
          <Icon name={isFree && canEnroll ? 'cap' : 'arrow'} size={16} />
        </button>
      </div>
    </article>
  );
}
