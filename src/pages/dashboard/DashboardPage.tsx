import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState, type ReactNode } from 'react'
import Chart from 'react-apexcharts'
import { Link } from 'react-router-dom'

import { getAdminDashboardStatistics } from '@/features/admin/api/dashboard-statistics.api'
import type {
  DashboardStatisticsFilters,
  DashboardStatisticsPeriod,
  DashboardStatisticsResponse,
  DashboardTopProductItem,
  DashboardTopVariantItem,
} from '@/features/admin/model/dashboard-statistics.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { buildProductDetailPath } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

const { RangePicker } = DatePicker

type StatisticsFilterMode = Exclude<DashboardStatisticsPeriod, 'rolling'>

const PERIOD_OPTIONS = [
  { label: 'Ngày', value: 'day' },
  { label: 'Tuần', value: 'week' },
  { label: 'Tháng', value: 'month' },
  { label: 'Khoảng thời gian', value: 'custom' },
] satisfies { label: string; value: StatisticsFilterMode }[]

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  returned: 'Trả hàng',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  confirmed: 'blue',
  shipping: 'geekblue',
  delivered: 'green',
  completed: 'green',
  cancelled: 'volcano',
  returned: 'orange',
}

const topProductColumns: ColumnsType<DashboardTopProductItem> = [
  {
    title: 'Sản phẩm',
    key: 'name',
    render: (_, record) => (
      <Space direction="vertical" size={0} className="min-w-0">
        <Link to={buildProductDetailPath(record.productId)} className="font-medium text-blue-600 hover:text-blue-700">
          {record.name}
        </Link>
        <Typography.Text type="secondary" className="text-xs">
          {record.brand}
        </Typography.Text>
      </Space>
    ),
  },
  {
    title: 'Đã bán',
    dataIndex: 'soldCount',
    key: 'soldCount',
    width: 110,
  },
  {
    title: 'Đánh giá',
    dataIndex: 'reviewCount',
    key: 'reviewCount',
    width: 110,
  },
  {
    title: 'Trạng thái',
    key: 'isAvailable',
    width: 130,
    render: (_, record) => (
      <Tag color={record.isAvailable ? 'green' : 'default'}>{record.isAvailable ? 'Đang bán' : 'Ngừng bán'}</Tag>
    ),
  },
]

const topVariantColumns: ColumnsType<DashboardTopVariantItem> = [
  {
    title: 'Biến thể',
    key: 'variant',
    render: (_, record) => (
      <Space size={10} align="center">
        <Avatar
          shape="square"
          size={42}
          src={record.thumbnailUrl ?? PRODUCT_PLACEHOLDER}
        />
        <Space direction="vertical" size={0} className="min-w-0">
          <Typography.Text strong className="line-clamp-1">
            {record.variantSku || 'SKU'}
          </Typography.Text>
          <Link
            to={buildProductDetailPath(record.productId)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {record.productName}
          </Link>
          <Typography.Text type="secondary" className="text-xs">
            {record.variantColor || 'Không chọn'} · {record.size}
          </Typography.Text>
        </Space>
      </Space>
    ),
  },
  {
    title: 'Đã bán',
    dataIndex: 'soldCount',
    key: 'soldCount',
    width: 110,
  },
  {
    title: 'Doanh thu',
    dataIndex: 'revenue',
    key: 'revenue',
    width: 150,
    render: (value: number) => formatVndCurrency(value),
  },
  {
    title: 'Tồn kho',
    dataIndex: 'stockQuantity',
    key: 'stockQuantity',
    width: 110,
  },
  {
    title: 'Trạng thái',
    key: 'isAvailable',
    width: 130,
    render: (_, record) => (
      <Tag color={record.isAvailable ? 'green' : 'default'}>
        {record.isAvailable ? 'Còn hàng' : 'Hết hàng'}
      </Tag>
    ),
  },
]

const useRevenueChartOptions = (stats?: DashboardStatisticsResponse) => {
  return useMemo(() => {
    const data = stats?.trends.dailyRevenue ?? []
    const categories = data.map((item) => dayjs(item.date).format('DD/MM'))

    return {
      series: [
        {
          name: 'Doanh thu đã giao',
          type: 'area' as const,
          data: data.map((item) => item.revenue),
        },
        {
          name: 'Số đơn',
          type: 'column' as const,
          data: data.map((item) => item.orders),
        },
      ],
      options: {
        chart: {
          stacked: false,
          toolbar: { show: false },
        },
        stroke: {
          width: [3, 0],
          curve: 'smooth' as const,
        },
        dataLabels: {
          enabled: false,
        },
        xaxis: {
          categories,
        },
        yaxis: [
          {
            labels: {
              formatter: (value: number) => formatVndCurrency(value),
            },
          },
          {
            opposite: true,
            labels: {
              formatter: (value: number) => `${Math.round(value)}`,
            },
          },
        ],
        colors: ['#2563eb', '#38bdf8'],
        fill: {
          type: ['gradient', 'solid'],
          gradient: {
            shadeIntensity: 0.25,
            opacityFrom: 0.45,
            opacityTo: 0.05,
            stops: [0, 90, 100],
          },
        },
        tooltip: {
          shared: true,
          intersect: false,
        },
      },
    }
  }, [stats])
}

const useCategoryOrderChartOptions = (stats?: DashboardStatisticsResponse) => {
  return useMemo(() => {
    const data = stats?.breakdowns.byCategory ?? []
    const categories = data.map((item) => item.categoryName)

    return {
      series: [
        {
          name: 'Tổng đơn',
          data: data.map((item) => item.orders),
        },
        {
          name: 'Đơn đã giao',
          data: data.map((item) => item.deliveredOrders),
        },
      ],
      options: {
        chart: {
          toolbar: { show: false },
        },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 4,
            barHeight: '60%',
          },
        },
        dataLabels: {
          enabled: false,
        },
        xaxis: {
          categories,
        },
        yaxis: {},
        colors: ['#2563eb', '#16a34a'],
        legend: {
          position: 'top' as const,
        },
        tooltip: {
          shared: true,
          intersect: false,
        },
      },
    }
  }, [stats])
}

interface DashboardMetricGroupProps {
  title: string
  loading: boolean
  primaryLabel: string
  primaryValue: number | string
  primaryFormatter?: (value: number | string) => ReactNode
  secondaryItems: Array<{
    label: string
    value: number | string
    formatter?: (value: number | string) => ReactNode
  }>
}

const DashboardMetricGroup = ({
  title,
  loading,
  primaryLabel,
  primaryValue,
  primaryFormatter,
  secondaryItems,
}: DashboardMetricGroupProps) => {
  return (
    <Card loading={loading} className="h-full">
      <Space direction="vertical" size={16} className="w-full">
        <div>
          <Typography.Text type="secondary">{title}</Typography.Text>
        </div>

        <Statistic title={primaryLabel} value={primaryValue} formatter={primaryFormatter} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {secondaryItems.map((item) => (
            <Statistic
              key={item.label}
              title={item.label}
              value={item.value}
              formatter={item.formatter}
            />
          ))}
        </div>
      </Space>
    </Card>
  )
}

// worklog: 2026-03-04 14:47:25 | ducanh | fix | DashboardPage
// worklog: 2026-03-04 21:16:19 | ducanh | cleanup | DashboardPage
export const DashboardPage = () => {
  const [filterMode, setFilterMode] = useState<StatisticsFilterMode>('month')
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null)

  const statisticsFilters = useMemo<DashboardStatisticsFilters>(() => {
    if (filterMode === 'custom') {
      if (!customRange?.[0] || !customRange?.[1]) {
        return {
          period: 'custom',
        }
      }

      return {
        period: 'custom',
        fromDate: customRange[0].startOf('day').toISOString(),
        toDate: customRange[1].endOf('day').toISOString(),
      }
    }

    return {
      period: filterMode,
    }
  }, [customRange, filterMode])

  const statisticsQuery = useQuery({
    queryKey: queryKeys.admin.dashboardStatistics(statisticsFilters),
    queryFn: () => getAdminDashboardStatistics(statisticsFilters),
    enabled: filterMode !== 'custom' || Boolean(customRange?.[0] && customRange?.[1]),
    placeholderData: (previousData) => previousData,
  })

  const stats = statisticsQuery.data
  const summary = stats?.summary

  const revenueChart = useRevenueChartOptions(stats)
  const categoryOrderChart = useCategoryOrderChartOptions(stats)
  const isLoading = statisticsQuery.isLoading || statisticsQuery.isFetching

  const statusSeries = stats?.breakdowns.byStatus.map((item) => item.count) ?? []
  const statusLabels = stats?.breakdowns.byStatus.map((item) => ORDER_STATUS_LABELS[item.status]) ?? []
  const hasStatusData = statusSeries.some((value) => value > 0)
  const hasCategoryData = (stats?.breakdowns.byCategory.length ?? 0) > 0
  const paymentMethodUsedCount =
    stats?.breakdowns.byPaymentMethod.filter((item) => item.count > 0).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            Dashboard thống kê
          </Typography.Title>
          <Typography.Text type="secondary">
            {stats?.trends.label
              ? `Phạm vi thống kê: ${stats.trends.label} · cập nhật ${formatDateTime(stats.trends.toDate)}`
              : 'Chọn phạm vi thời gian để xem số liệu'}
          </Typography.Text>
        </div>

        <Space wrap>
          <Segmented<StatisticsFilterMode>
            value={filterMode}
            options={PERIOD_OPTIONS}
            onChange={(value) => {
              setFilterMode(value)
            }}
          />
          <RangePicker
            className={filterMode === 'custom' ? 'w-full md:w-[320px]' : 'hidden'}
            value={customRange}
            format="DD/MM/YYYY"
            allowClear
            onChange={(value) => {
              if (value?.[0] && value[1]) {
                setCustomRange([value[0], value[1]])
                return
              }

              setCustomRange(null)
            }}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <DashboardMetricGroup
            title="Thống kê doanh thu"
            loading={isLoading}
            primaryLabel="Doanh thu đã giao"
            primaryValue={summary?.deliveredRevenue ?? 0}
            primaryFormatter={(value) => formatVndCurrency(Number(value ?? 0))}
            secondaryItems={[
              {
                label: 'Doanh thu gộp',
                value: summary?.grossRevenue ?? 0,
                formatter: (value) => formatVndCurrency(Number(value ?? 0)),
              },
              {
                label: 'Giá trị đơn TB',
                value: summary?.averageDeliveredOrderValue ?? 0,
                formatter: (value) => formatVndCurrency(Number(value ?? 0)),
              },
            ]}
          />
        </Col>

        <Col xs={24} xl={12}>
          <DashboardMetricGroup
            title="Thống kê đơn hàng"
            loading={isLoading}
            primaryLabel="Tổng đơn hàng"
            primaryValue={summary?.totalOrders ?? 0}
            secondaryItems={[
              { label: 'Đã giao/hoàn thành', value: summary?.deliveredOrders ?? 0 },
              { label: 'Đang xử lý', value: summary?.processingOrders ?? 0 },
              { label: 'Đã hủy/trả', value: summary?.cancelledOrders ?? 0 },
              { label: 'Kênh thanh toán đang dùng', value: paymentMethodUsedCount },
            ]}
          />
        </Col>

        <Col xs={24} xl={12}>
          <DashboardMetricGroup
            title="Thống kê khách hàng"
            loading={isLoading}
            primaryLabel="Khách phát sinh đơn"
            primaryValue={summary?.purchasingCustomers ?? 0}
            secondaryItems={[
              { label: 'Khách hàng mới', value: summary?.newCustomersCount ?? 0 },
              { label: 'Tổng khách hàng', value: summary?.customersCount ?? 0 },
              { label: 'Đang hoạt động', value: summary?.activeUsers ?? 0 },
              { label: 'Ngưng hoạt động', value: summary?.inactiveUsers ?? 0 },
            ]}
          />
        </Col>

        <Col xs={24} xl={12}>
          <DashboardMetricGroup
            title="Thống kê sản phẩm"
            loading={isLoading}
            primaryLabel="Sản phẩm có phát sinh bán"
            primaryValue={summary?.soldProducts ?? 0}
            secondaryItems={[
              { label: 'Biến thể có phát sinh bán', value: summary?.soldVariants ?? 0 },
              { label: 'Tổng số lượng bán', value: summary?.totalItemsSold ?? 0 },
              { label: 'Tổng sản phẩm', value: summary?.totalProducts ?? 0 },
              { label: 'Đang bán', value: summary?.availableProducts ?? 0 },
            ]}
          />
        </Col>

        <Col xs={24} xl={12}>
          <DashboardMetricGroup
            title="Thống kê danh mục"
            loading={isLoading}
            primaryLabel="Danh mục có phát sinh đơn"
            primaryValue={summary?.categoriesWithOrders ?? 0}
            secondaryItems={[
              { label: 'Tổng danh mục', value: summary?.totalCategories ?? 0 },
              { label: 'Biến thể sắp hết', value: summary?.lowStockVariants ?? 0 },
              { label: 'Biến thể hết hàng', value: summary?.outOfStockVariants ?? 0 },
              {
                label: 'Bình luận / đánh giá',
                value: `${summary?.totalComments ?? 0} / ${summary?.totalReviews ?? 0}`,
              },
            ]}
          />
        </Col>
      </Row>

      <Card
        title={`Doanh thu theo ngày trong ${stats?.trends.label ?? 'phạm vi đã chọn'}`}
        loading={isLoading}
      >
        <Chart type="line" height={320} series={revenueChart.series} options={revenueChart.options} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Cơ cấu trạng thái đơn hàng" loading={isLoading}>
            {hasStatusData ? (
              <Chart
                type="donut"
                height={320}
                series={statusSeries}
                options={{
                  labels: statusLabels,
                  legend: { position: 'bottom' as const },
                  colors: stats?.breakdowns.byStatus.map((item) => {
                    const color = STATUS_COLORS[item.status]
                    if (color === 'green') return '#16a34a'
                    if (color === 'volcano') return '#f97316'
                    if (color === 'orange') return '#f59e0b'
                    if (color === 'blue') return '#2563eb'
                    if (color === 'cyan') return '#06b6d4'
                    if (color === 'geekblue') return '#4f46e5'
                    return '#94a3b8'
                  }),
                }}
              />
            ) : (
              <Empty description="Chưa có dữ liệu trạng thái đơn hàng" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Thống kê đơn hàng theo danh mục" loading={isLoading}>
            {hasCategoryData ? (
              <Chart
                type="bar"
                height={320}
                series={categoryOrderChart.series}
                options={categoryOrderChart.options}
              />
            ) : (
              <Empty description="Chưa có dữ liệu đơn hàng theo danh mục" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            title={`Top sản phẩm bán chạy trong ${stats?.trends.label ?? 'phạm vi đã chọn'}`}
            loading={isLoading}
          >
            <Table
              rowKey="productId"
              columns={topProductColumns}
              dataSource={stats?.topProducts ?? []}
              pagination={false}
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu sản phẩm bán chạy" />,
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title={`Top sản phẩm bán chậm trong ${stats?.trends.label ?? 'phạm vi đã chọn'}`}
            loading={isLoading}
          >
            <Table
              rowKey="productId"
              columns={topProductColumns}
              dataSource={stats?.bottomProducts ?? []}
              pagination={false}
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu sản phẩm bán chậm" />,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            title={`Top biến thể bán chạy trong ${stats?.trends.label ?? 'phạm vi đã chọn'}`}
            loading={isLoading}
          >
            <Table
              rowKey="variantId"
              columns={topVariantColumns}
              dataSource={stats?.topVariants ?? []}
              pagination={false}
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu biến thể bán chạy" />,
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title={`Top biến thể bán chậm trong ${stats?.trends.label ?? 'phạm vi đã chọn'}`}
            loading={isLoading}
          >
            <Table
              rowKey="variantId"
              columns={topVariantColumns}
              dataSource={stats?.bottomVariants ?? []}
              pagination={false}
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu biến thể bán chậm" />,
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
