import { Card, Col, Row, Space, Statistic, Typography } from 'antd'

import { BRAND } from '@/shared/constants/brand'

export const AboutPage = () => {
  return (
    <div className="space-y-8 py-6">
      <Card className="overflow-hidden bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800">
        <Space direction="vertical" size="middle" className="w-full">
          <img src={BRAND.logoFull} alt={`${BRAND.name} logo`} className="h-14 w-auto" />
          <Typography.Title level={2} className="!mb-0 !text-white">
            Về {BRAND.name}
          </Typography.Title>
          <Typography.Paragraph className="!mb-0 !max-w-3xl !text-blue-100">
            {BRAND.name} tập trung vào hệ sinh thái sản phẩm cho bộ môn bi-a: cơ thi đấu, đầu
            cơ, găng tay, bao cơ và phụ kiện chuyên dụng cho người chơi phong trào đến vận động
            viên chuyên nghiệp.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Sản phẩm chuyên biệt" value={500} suffix="+" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Thương hiệu hợp tác" value={45} suffix="+" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Khách hàng tin dùng" value={12000} suffix="+" />
          </Card>
        </Col>
      </Row>

      <Card title="Cam kết dịch vụ">
        <Typography.Paragraph className="!mb-3">
          Mỗi sản phẩm đều được chọn lọc theo tiêu chí hiệu năng thi đấu, độ bền và độ hoàn thiện.
        </Typography.Paragraph>
        <Typography.Paragraph className="!mb-3">
          Chúng tôi hỗ trợ tư vấn setup gậy, phụ kiện và cấu hình phù hợp với trình độ chơi của bạn.
        </Typography.Paragraph>
        <Typography.Paragraph className="!mb-0">
          Đội ngũ kỹ thuật luôn sẵn sàng đồng hành sau bán hàng với chính sách bảo hành minh bạch.
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
