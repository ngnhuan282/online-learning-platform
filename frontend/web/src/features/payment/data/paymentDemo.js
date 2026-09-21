import { demoCourses, formatPrice } from '../../courses/data/demoCourses';

const paidCourses = demoCourses.filter(course => course.price > 0);

export function getCheckoutCourse(courseId) {
  return paidCourses.find(course => course.id === courseId) || paidCourses[0];
}

export function buildOrderSnapshot(course) {
  const subtotal = course.originalPrice || course.price;
  return {
    orderCode: 'LS-PAY-2026-0001',
    course,
    subtotal,
    discount: Math.max(subtotal - course.price, 0),
    total: course.price,
    currency: 'VND',
    provider: 'MOCK',
    createdAt: '17/09/2026 23:00',
    expiresIn: '15 phút',
  };
}

export const analyticsCards = [
  {
    label: 'Doanh thu tạm tính',
    value: formatPrice(24580000),
    helper: '+12.4% so với tuần trước',
    tone: 'blue',
  },
  {
    label: 'Giao dịch thành công',
    value: '128',
    helper: '92.7% tỉ lệ thành công',
    tone: 'green',
  },
  {
    label: 'Đang chờ thanh toán',
    value: '14',
    helper: 'Cần theo dõi trong 24h',
    tone: 'amber',
  },
  {
    label: 'Thất bại / hủy',
    value: '7',
    helper: 'Cần retry UX và log provider',
    tone: 'rose',
  },
];

export const revenueBars = [
  { label: 'T5', value: 42 },
  { label: 'T6', value: 58 },
  { label: 'T7', value: 51 },
  { label: 'T8', value: 74 },
  { label: 'T9', value: 68 },
  { label: 'T10', value: 86 },
];

export const recentTransactions = [
  {
    orderCode: 'LS-PAY-2026-0001',
    learner: 'Nguyễn Văn A',
    course: paidCourses[0].title,
    amount: paidCourses[0].price,
    status: 'SUCCESS',
    createdAt: '17/09/2026',
  },
  {
    orderCode: 'LS-PAY-2026-0002',
    learner: 'Trần Minh Khoa',
    course: paidCourses[1].title,
    amount: paidCourses[1].price,
    status: 'PENDING',
    createdAt: '17/09/2026',
  },
  {
    orderCode: 'LS-PAY-2026-0003',
    learner: 'Lê Thu Anh',
    course: paidCourses[2].title,
    amount: paidCourses[2].price,
    status: 'FAILED',
    createdAt: '16/09/2026',
  },
];

export function formatDemoPrice(value) {
  return formatPrice(value);
}
