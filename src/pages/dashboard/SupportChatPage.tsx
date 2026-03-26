import { Card, Typography } from 'antd'

import { StaffSupportChatPanel } from '@/features/chat/components/StaffSupportChatPanel'

export const SupportChatPage = () => {
    return (
        <div className="space-y-4">
            <div>
                <Typography.Title level={3} className="!mb-1">
                    Hỗ trợ khách hàng
                </Typography.Title>

                <Typography.Text type="secondary">
                    Chat trực tiếp với khách hàng, phản hồi nhanh các thắc mắc về đơn hàng.
                </Typography.Text>
            </div>

            <Card className="shadow-sm">
                <StaffSupportChatPanel />
            </Card>
        </div>
    )
}