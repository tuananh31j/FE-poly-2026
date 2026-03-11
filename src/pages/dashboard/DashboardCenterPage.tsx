import {
  AppstoreOutlined,
  BgColorsOutlined,
  CommentOutlined,
  GiftOutlined,
  OrderedListOutlined,
  PlusCircleOutlined,
  ShopOutlined,
  StarOutlined,
  TagsOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Space, Typography } from 'antd'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import {
  buildDashboardMasterDataPath,
  buildDashboardProductsPath,
  ROUTE_PATHS,
} from '@/shared/constants/routes'

interface CenterMenuItem {
  key: string
  title: string
  description: string
  to: string
  icon: ReactNode
  iconBackground: string
  iconColor: string
  adminOnly?: boolean
}

interface CenterMenuGroup {
  key: string
  title: string
  description: string
  items: CenterMenuItem[]
}

const CENTER_MENU_GROUPS: CenterMenuGroup[] = [
  {
    key: 'orders',
    title: 'Bán hàng',
    description: 'Theo dõi luồng đơn và phản hồi khách hàng.',
    items: [
      {
        key: 'orders',
        title: 'Đơn hàng',
        description: 'Xử lý trạng thái đơn từ chờ xác nhận tới hoàn tất.',
        to: ROUTE_PATHS.DASHBOARD_ORDERS,
        icon: <OrderedListOutlined />,
        iconBackground: '#e0f2fe',
        iconColor: '#0369a1',
      },
      {
        key: 'reviews',
        title: 'Đánh giá',
        description: 'Kiểm duyệt và phản hồi các đánh giá sản phẩm.',
        to: ROUTE_PATHS.DASHBOARD_REVIEWS,
        icon: <StarOutlined />,
        iconBackground: '#fef3c7',
        iconColor: '#b45309',
      },
      {
        key: 'comments',
        title: 'Bình luận',
        description: 'Quản lý bình luận công khai trên storefront.',
        to: ROUTE_PATHS.DASHBOARD_COMMENTS,
        icon: <CommentOutlined />,
        iconBackground: '#f3e8ff',
        iconColor: '#7e22ce',
      },
      {
        key: 'vouchers',
        title: 'Voucher',
        description: 'Cấu hình mã giảm giá và thời hạn sử dụng.',
        to: ROUTE_PATHS.DASHBOARD_VOUCHERS,
        icon: <GiftOutlined />,
        iconBackground: '#fee2e2',
        iconColor: '#b91c1c',
        adminOnly: true,
      },
    ],
  },
  {
    key: 'catalog',
    title: 'Catalog',
    description: 'Quản lý danh mục sản phẩm và thuộc tính hiển thị.',
    items: [
      {
        key: 'products-list',
        title: 'DS sản phẩm',
        description: 'Xem danh sách sản phẩm và biến thể hiện có.',
        to: buildDashboardProductsPath('list'),
        icon: <ShopOutlined />,
        iconBackground: '#dcfce7',
        iconColor: '#15803d',
        adminOnly: true,
      },
      {
        key: 'products-create',
        title: 'Thêm sản phẩm',
        description: 'Tạo mới sản phẩm/variant ngay từ form quản lý.',
        to: buildDashboardProductsPath('create'),
        icon: <PlusCircleOutlined />,
        iconBackground: '#dbeafe',
        iconColor: '#1d4ed8',
        adminOnly: true,
      },
      {
        key: 'categories',
        title: 'Danh mục',
        description: 'Quản lý cấu trúc danh mục sản phẩm.',
        to: buildDashboardMasterDataPath('categories'),
        icon: <AppstoreOutlined />,
        iconBackground: '#ede9fe',
        iconColor: '#5b21b6',
        adminOnly: true,
      },
      {
        key: 'brands',
        title: 'Thương hiệu',
        description: 'Quản lý thương hiệu dùng trong catalog.',
        to: buildDashboardMasterDataPath('brands'),
        icon: <TagsOutlined />,
        iconBackground: '#ecfeff',
        iconColor: '#155e75',
        adminOnly: true,
      },
      {
        key: 'colors',
        title: 'Màu sắc',
        description: 'Quản lý bảng màu cho biến thể sản phẩm.',
        to: buildDashboardMasterDataPath('colors'),
        icon: <BgColorsOutlined />,
        iconBackground: '#fef2f2',
        iconColor: '#b91c1c',
        adminOnly: true,
      },
      {
        key: 'sizes',
        title: 'Kích thước',
        description: 'Quản lý bảng size dùng trong biến thể.',
        to: buildDashboardMasterDataPath('sizes'),
        icon: <TagsOutlined />,
        iconBackground: '#f0fdf4',
        iconColor: '#166534',
        adminOnly: true,
      },
    ],
  },
  {
    key: 'system',
    title: 'Hệ thống',
    description: 'Các màn hình quản trị tài khoản và phân quyền.',
    items: [
      {
        key: 'statistics',
        title: 'Thống kê',
        description: 'Theo dõi doanh thu, đơn hàng, tồn kho và xu hướng.',
        to: ROUTE_PATHS.DASHBOARD_STATISTICS,
        icon: <AppstoreOutlined />,
        iconBackground: '#dbeafe',
        iconColor: '#1e40af',
      },
      {
        key: 'accounts',
        title: 'Tài khoản',
        description: 'Quản lý thông tin user trong hệ thống.',
        to: ROUTE_PATHS.DASHBOARD_ACCOUNTS,
        icon: <TeamOutlined />,
        iconBackground: '#f1f5f9',
        iconColor: '#334155',
        adminOnly: true,
      },
      {
        key: 'roles',
        title: 'Phân quyền',
        description: 'Cấp quyền admin/staff theo nghiệp vụ.',
        to: ROUTE_PATHS.DASHBOARD_USERS,
        icon: <UserSwitchOutlined />,
        iconBackground: '#fff7ed',
        iconColor: '#c2410c',
        adminOnly: true,
      },
    ],
  },
]

export const DashboardCenterPage = () => {
  const role = useAppSelector((state) => state.auth.user?.role)
  const isAdmin = role === 'admin'

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Typography.Title level={3} className="!mb-0">
          Trung tâm quản trị
        </Typography.Title>
        <Typography.Text type="secondary">
          Truy cập nhanh theo nhóm chức năng để thao tác quản trị thuận tiện hơn.
        </Typography.Text>
      </div>

      <Row gutter={[16, 16]}>
        {CENTER_MENU_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin)

          if (items.length === 0) {
            return null
          }

          return (
            <Col key={group.key} xs={24}>
              <Card>
                <Space direction="vertical" size={14} className="w-full">
                  <div>
                    <Typography.Title level={4} className="!mb-1">
                      {group.title}
                    </Typography.Title>
                    <Typography.Text type="secondary">{group.description}</Typography.Text>
                  </div>

                  <Row gutter={[12, 12]}>
                    {items.map((item) => (
                      <Col key={item.key} xs={24} sm={12} xl={8}>
                        <Link to={item.to} className="block h-full">
                          <Card hoverable className="h-full border border-slate-200">
                            <Space direction="vertical" size={10} className="w-full">
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                                style={{
                                  backgroundColor: item.iconBackground,
                                  color: item.iconColor,
                                }}
                              >
                                {item.icon}
                              </div>
                              <Typography.Text strong className="!text-base !text-slate-900">
                                {item.title}
                              </Typography.Text>
                              <Typography.Paragraph
                                type="secondary"
                                className="!mb-0 line-clamp-2 !text-xs"
                              >
                                {item.description}
                              </Typography.Paragraph>
                            </Space>
                          </Card>
                        </Link>
                      </Col>
                    ))}
                  </Row>
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}