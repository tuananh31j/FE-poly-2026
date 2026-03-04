import { Alert, Button, Form, Input } from 'antd'
import { Link } from 'react-router-dom'

import { ROUTE_PATHS } from '@/shared/constants/routes'

interface CommentComposerProps {
  isAuthenticated: boolean
  isSubmitting: boolean
  onSubmit: (content: string) => Promise<void>
}

interface CommentFormValues {
  content: string
}

export const CommentComposer = ({
  isAuthenticated,
  isSubmitting,
  onSubmit,
}: CommentComposerProps) => {
  const [form] = Form.useForm<CommentFormValues>()

  if (!isAuthenticated) {
    return (
      <Alert
        type="info"
        showIcon
        message="Bạn cần đăng nhập để bình luận"
        description={
          <span>
            Vui lòng <Link to={ROUTE_PATHS.LOGIN}>đăng nhập</Link> để gửi bình luận cho sản phẩm
            này.
          </span>
        }
      />
    )
  }

  const handleSubmit = async (values: CommentFormValues) => {
    await onSubmit(values.content)
    form.resetFields()
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} className="rounded-xl bg-slate-50 p-4">
      <Form.Item
        name="content"
        label="Bình luận của bạn"
        rules={[
          { required: true, message: 'Vui lòng nhập bình luận' },
          { min: 3, message: 'Bình luận quá ngắn' },
        ]}
      >
        <Input.TextArea rows={4} placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..." />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={isSubmitting}>
        Gửi bình luận
      </Button>
    </Form>
  )
}
