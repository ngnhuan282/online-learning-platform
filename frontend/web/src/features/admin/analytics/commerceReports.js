import { t } from '../../../shared/i18n/locale';

const grantSources = { PAYMENT: 'Thanh toán', CODE: 'Mã kích hoạt', ADMIN: 'Quản trị viên' };
const codeStatuses = { REDEEMED: 'Đã dùng', REVOKED: 'Đã thu hồi', EXPIRED: 'Hết hạn', AVAILABLE: 'Chưa dùng' };
const itemTypes = { FRAME: 'Khung avatar', BACKGROUND: 'Ảnh nền', FREEZE: 'Streak Freeze' };

export const commerceReports = {
  pro: {
    title: 'Thống kê Pro',
    trend: 'Lượt cấp Pro theo thời gian',
    snapshot: [
      ['Đang hoạt động', 'active'],
      ['Sắp hết hạn trong 30 ngày', 'expiringSoon'],
      ['Đã hết hạn', 'expired'],
      ['Đang bị khóa', 'suspended'],
    ],
    metrics: [
      ['Lượt cấp Pro chưa bị thu hồi', 'grants'],
      ['Thành viên được cấp lần đầu', 'newMembers'],
      ['Lượt cấp tiếp theo', 'repeatGrants'],
      ['Cấp qua thanh toán', 'paid'],
      ['Cấp qua mã kích hoạt', 'code'],
      ['Cấp bởi quản trị viên', 'admin'],
      ['Lượt thu hồi', 'revocations'],
    ],
    notes: ['Lượt cấp tiếp theo bao gồm cả gia hạn và kích hoạt lại. Số lượt cấp tính theo các khoản cấp chưa bị thu hồi tại thời điểm xem.'],
    tables: data => {
      const { recentGrants, codes } = data.details;
      const tables = [{
        title: '20 lượt cấp Pro gần nhất trong kỳ',
        rows: recentGrants,
        columns: [
          ['Học viên', 'userId', 'id'],
          ['Gói Pro', 'planCode'],
          ['Nguồn cấp', 'source', grantSources],
          ['Số tháng', 'months', 'number'],
          ['Thời điểm cấp', 'grantedAt', 'instant'],
          ['Thời điểm thu hồi', 'revokedAt', 'instant'],
        ],
      }];
      if (codes) tables.push({
        title: '20 mã Pro mới phát hành hoặc đã dùng gần nhất trong kỳ',
        summary: [['Mã phát hành trong kỳ', codes.created], ['Mã đã dùng trong kỳ', codes.redeemed]],
        rows: codes.recent,
        columns: [
          ['Mã đã che', 'maskedCode'],
          ['Gói Pro', 'planCode'],
          ['Trạng thái hiện tại', 'status', codeStatuses],
          ['Phát hành', 'createdAt', 'instant'],
          ['Đã dùng lúc', 'redeemedAt', 'instant'],
          ['Hạn sử dụng', 'expiresAt', 'instant'],
        ],
      });
      return tables;
    },
  },
  gems: {
    title: 'Kinh tế Gem',
    trend: 'Gem cộng vào ví theo thời gian',
    snapshot: [['Tổng Gem trong ví', 'balance'], ['Ví có số dư', 'walletsWithBalance']],
    metrics: [
      ['Gem cộng vào ví đã ghi nhận', 'issued'],
      ['Gem trừ khỏi ví đã ghi nhận', 'spent'],
      ['Thưởng hoạt động hằng ngày', 'daily'],
      ['Thưởng thành tích', 'rewards'],
      ['Gem nạp đã cộng vào ví', 'topups'],
      ['Quản trị viên cộng Gem', 'adminCredits'],
      ['Quản trị viên trừ Gem', 'adminDebits'],
      ['Gem mua vật phẩm', 'itemSpend'],
      ['Gem mua Streak Freeze', 'freezeSpend'],
      ['Lượt học theo ngày thiếu số Gem thưởng', 'legacyActivityDays'],
    ],
    notes: ['Một số lượt học cũ thiếu số Gem thưởng. Tổng Gem cộng trong kỳ chỉ gồm các khoản đã ghi nhận.'],
    tables: data => [{
      title: '20 điều chỉnh Gem gần nhất trong kỳ',
      rows: data.details,
      columns: [
        ['Học viên', 'userId', 'id'],
        ['Quản trị viên', 'actorId', 'id'],
        ['Gem thay đổi', 'delta', 'number'],
        ['Lý do', 'reason'],
        ['Thời điểm', 'createdAt', 'instant'],
      ],
    }],
  },
  shop: {
    title: 'Thống kê Cửa hàng',
    trend: 'Lượt nhận vật phẩm qua Cửa hàng theo thời gian',
    snapshot: [
      ['Vật phẩm trong kho đồ', 'ownedItems'],
      ['Vật phẩm đang trang bị', 'equippedItems'],
      ['Tỷ lệ vật phẩm trang bị (%)', 'equipRate', 'percent'],
      ['Streak Freeze còn trong ví', 'freezesInWallets'],
    ],
    metrics: [
      ['Lượt mua hoặc nhận vật phẩm đã xác nhận', 'purchases'],
      ['Người mua hoặc nhận vật phẩm', 'buyers'],
      ['Gem chi tại Cửa hàng', 'gemSpent'],
      ['Streak Freeze mua hoặc nhận', 'freezePurchases'],
      ['Lượt dùng Streak Freeze', 'freezeUses'],
      ['Biên nhận 0 Gem cũ chưa xác định', 'unclassifiedReceipts'],
    ],
    notes: ['Biên nhận 0 Gem cũ chưa xác định không tính vào lượt mua. Giá, số người sở hữu và trang bị là số hiện tại.'],
    tables: data => [{
      title: '10 vật phẩm có nhiều lượt mua hoặc nhận nhất trong kỳ',
      rows: data.details.map(item => ({ ...item, name: t(item.name) })),
      columns: [
        ['Mã vật phẩm', 'code'],
        ['Vật phẩm', 'name'],
        ['Loại', 'type', itemTypes],
        ['Giá hiện tại (Gem)', 'currentPrice', 'number'],
        ['Lượt mua hoặc nhận', 'purchases', 'number'],
        ['Gem đã chi', 'gemSpent', 'number'],
        ['Người sở hữu hiện tại', 'owners', 'number'],
        ['Người đang trang bị', 'equipped', 'number'],
        ['Tỷ lệ trang bị (%)', 'equipRate', 'number'],
      ],
    }],
  },
};
