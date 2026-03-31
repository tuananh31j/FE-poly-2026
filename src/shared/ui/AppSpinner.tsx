import { Flex, Spin } from 'antd'

interface AppSpinnerProps {
  fullScreen?: boolean
}

export const AppSpinner = ({ fullScreen = false }: AppSpinnerProps) => {
  if (fullScreen) {
    return (
      <Flex align="center" justify="center" className="min-h-screen w-full">
        <Spin size="large" />
      </Flex>
    )
  }

  return (
    <Flex align="center" justify="center" className="w-full py-10">
      <Spin size="large" />
    </Flex>
  )
}
