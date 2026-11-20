export const LISTENING_PARTS = [1, 2, 3, 4];
export const READING_PARTS = [5, 6, 7];
export const PART_TITLES = {
  1: 'Mô tả hình ảnh',
  2: 'Câu hỏi và phản hồi',
  3: 'Hội thoại',
  4: 'Bài nói ngắn',
  5: 'Hoàn thành câu',
  6: 'Hoàn thành đoạn văn',
  7: 'Đọc hiểu',
};

export const isListeningPart = part => LISTENING_PARTS.includes(part);
