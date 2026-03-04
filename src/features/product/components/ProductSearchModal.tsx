import { useInfiniteQuery } from '@tanstack/react-query'
import { Empty, Input, Modal, Spin, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { getProducts } from '@/features/product/api/product.api'
import { ProductCard } from '@/features/product/components/ProductCard'
import { queryKeys } from '@/shared/api/queryKeys'

interface ProductSearchModalProps {
  open: boolean
  onClose: () => void
}

const SEARCH_PAGE_SIZE = 12

export const ProductSearchModal = ({ open, onClose }: ProductSearchModalProps) => {
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim())
    }, 300)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [keyword])

  const hasSearchKeyword = debouncedKeyword.length > 0

  const searchQuery = useInfiniteQuery({
    queryKey: queryKeys.products.list({
      source: 'search-modal',
      search: debouncedKeyword,
      isAvailable: true,
      limit: SEARCH_PAGE_SIZE,
    }),
    initialPageParam: 1,
    enabled: open && hasSearchKeyword,
    queryFn: ({ pageParam }) =>
      getProducts({
        page: Number(pageParam),
        limit: SEARCH_PAGE_SIZE,
        search: debouncedKeyword,
        isAvailable: true,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.page >= lastPage.totalPages) {
        return undefined
      }

      return lastPage.page + 1
    },
  })

  const products = useMemo(() => {
    return searchQuery.data?.pages.flatMap((page) => page.items) ?? []
  }, [searchQuery.data])

  return (
    <Modal
      title="Tìm kiếm sản phẩm"
      open={open}
      onCancel={onClose}
      footer={null}
      width={980}
      destroyOnHidden
      focusTriggerAfterClose={false}
      styles={{ body: { paddingTop: 12 } }}
    >
      <div className="max-h-[90vh]  space-y-3 overflow-hidden">
        <Input
          autoFocus
          size="large"
          placeholder="Nhập tên sản phẩm, ví dụ: cơ Ru..."
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value)
          }}
          allowClear
        />

        {!hasSearchKeyword ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Nhập từ khóa để bắt đầu tìm kiếm"
            />
          </div>
        ) : null}

        {hasSearchKeyword ? (
          <div
            className="max-h-[60vh] overflow-y-auto pr-1"
            onClickCapture={(event) => {
              const target = event.target as HTMLElement

              if (target.closest('a')) {
                onClose()
              }
            }}
            onScroll={(event) => {
              const target = event.currentTarget
              const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight

              if (distanceToBottom < 120 && searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) {
                void searchQuery.fetchNextPage()
              }
            }}
          >
            {searchQuery.isLoading ? (
              <div className="py-12 text-center">
                <Spin />
              </div>
            ) : null}

            {!searchQuery.isLoading && products.length === 0 ? (
              <Empty description="Không tìm thấy sản phẩm phù hợp"  />
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="[&_.ant-card-body]:!p-2 [&_.ant-typography]:!text-sm [&_.ant-rate]:!text-[12px]"
                >
                  <ProductCard product={product} compact highlightText={debouncedKeyword} />
                </div>
              ))}
            </div>

            {searchQuery.isFetchingNextPage ? (
              <div className="py-4 text-center">
                <Spin />
              </div>
            ) : null}

            {!searchQuery.hasNextPage && products.length > 0 ? (
              <Typography.Paragraph className="!mb-0 py-4 text-center" type="secondary">
                Đã hiển thị hết kết quả tìm kiếm.
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
