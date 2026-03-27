import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import Chart from 'react-apexcharts'
import { Link } from 'react-router-dom'

import { getAdminDashboardStatistics } from '@/features/admin/api/dashboard-statistics.api'
import type {
  DashboardStatisticsResponse,
  DashboardTopProductItem,
} from '@/features/admin/model/dashboard-statistics.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { buildProductDetailPath } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const DAYS_OPTIONS = [
  { label: '7 ngày', value: 7 },
  { label: '14 ngày', value: 14 },
  { label: '30 ngày', value: 30 },
  { label: '90 ngày', value: 90 },
]

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
    title: 'Điểm TB',
    dataIndex: 'averageRating',
    key: 'averageRating',
    width: 110,
    render: (value: number) => value.toFixed(1),
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
        },
      },
    }
  }, [stats])
}

// worklog: 2026-03-04 14:47:25 | ducanh | fix | DashboardPage
// worklog: 2026-03-04 21:16:19 | ducanh | cleanup | DashboardPage
export const DashboardPage = () => {
  const [days, setDays] = useState(30)

  const statisticsQuery = useQuery({
    queryKey: queryKeys.admin.dashboardStatistics({ days }),
    queryFn: () => getAdminDashboardStatistics(days),
  })

  const stats = statisticsQuery.data
  const summary = stats?.summary

  const revenueChart = useRevenueChartOptions(stats)

  const statusSeries = stats?.breakdowns.byStatus.map((item) => item.count) ?? []
  const statusLabels = stats?.breakdowns.byStatus.map((item) => ORDER_STATUS_LABELS[item.status]) ?? []
  const hasStatusData = statusSeries.some((value) => value > 0)

  

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            Dashboard thống kê
          </Typography.Title>
          <Typography.Text type="secondary">
            Cập nhật mới nhất: {formatDateTime(stats?.trends.toDate)}
          </Typography.Text>
        </div>

        <Select
          className="w-36"
          value={days}
          options={DAYS_OPTIONS}
          onChange={(value) => setDays(value)}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic
              title="Doanh thu đã giao"
              value={summary?.deliveredRevenue ?? 0}
              formatter={(value) => formatVndCurrency(Number(value ?? 0))}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Tổng đơn hàng" value={summary?.totalOrders ?? 0} />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Tổng người dùng" value={summary?.totalUsers ?? 0} />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Tổng sản phẩm" value={summary?.totalProducts ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Đơn đang xử lý" value={summary?.processingOrders ?? 0} />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Đơn hủy/trả" value={summary?.cancelledOrders ?? 0} />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Biến thể sắp hết" value={summary?.lowStockVariants ?? 0} />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
            <Statistic title="Biến thể hết hàng" value={summary?.outOfStockVariants ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        title={`Doanh thu ${stats?.trends.days ?? days} ngày gần nhất`}
        loading={statisticsQuery.isLoading || statisticsQuery.isFetching}
      >
        <Chart type="line" height={320} series={revenueChart.series} options={revenueChart.options} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Cơ cấu trạng thái đơn hàng" loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
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

        
      </Row>

      <Card title="Top sản phẩm bán chạy" loading={statisticsQuery.isLoading || statisticsQuery.isFetching}>
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
    </div>
  )
}