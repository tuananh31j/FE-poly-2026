import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  createMasterBrand,
  createMasterCategory,
  createMasterColor,
  createMasterSize,
  deleteMasterBrand,
  deleteMasterCategory,
  deleteMasterColor,
  deleteMasterSize,
  listMasterBrands,
  listMasterCategories,
  listMasterColors,
  listMasterSizes,
  updateMasterBrand,
  updateMasterCategory,
  updateMasterColor,
  updateMasterSize,
} from '@/features/admin/api/master-data.api'
import type {
  MasterBrandItem,
  MasterCategoryItem,
  MasterColorItem,
  MasterSizeItem,
  UpsertBrandPayload,
  UpsertCategoryPayload,
  UpsertColorPayload,
  UpsertSizePayload,
} from '@/features/admin/model/master-data.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10
const MASTER_DATA_TABS = ['categories', 'brands', 'colors', 'sizes'] as const
type MasterDataTab = (typeof MASTER_DATA_TABS)[number]
const DEFAULT_MASTER_DATA_TAB: MasterDataTab = 'categories'

const toSlug = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const resolveMasterDataTab = (value: string | null): MasterDataTab => {
  if (value && MASTER_DATA_TABS.includes(value as MasterDataTab)) {
    return value as MasterDataTab
  }

  return DEFAULT_MASTER_DATA_TAB
}

type ActiveFilter = 'all' | 'active' | 'inactive'

interface CategoryFormValues {
  name: string
  slug: string
  description?: string
  parentId?: string
  image?: string
  isActive: boolean
}

interface BrandFormValues {
  name: string
  slug: string
  description?: string
  logoUrl?: string
  isActive: boolean
}

interface ColorFormValues {
  name: string
  slug: string
  hexCode?: string
  isActive: boolean
}

interface SizeFormValues {
  name: string
  slug: string
  isActive: boolean
}

const toIsActiveParam = (value: ActiveFilter) => {
  if (value === 'all') {
    return undefined
  }

  return value === 'active'
}

const ActiveStatusTag = ({ active }: { active: boolean }) => {
  return <Tag color={active ? 'green' : 'default'}>{active ? 'Đang dùng' : 'Ngừng dùng'}</Tag>
}

export const MasterDataManagementPage = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = resolveMasterDataTab(searchParams.get('tab'))

  const [categoryForm] = Form.useForm<CategoryFormValues>()
  const [brandForm] = Form.useForm<BrandFormValues>()
  const [colorForm] = Form.useForm<ColorFormValues>()
  const [sizeForm] = Form.useForm<SizeFormValues>()

  const [categorySearchInput, setCategorySearchInput] = useState('')
  const [brandSearchInput, setBrandSearchInput] = useState('')
  const [colorSearchInput, setColorSearchInput] = useState('')
  const [sizeSearchInput, setSizeSearchInput] = useState('')

  const [categorySearch, setCategorySearch] = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [colorSearch, setColorSearch] = useState('')
  const [sizeSearch, setSizeSearch] = useState('')

  const [categoryFilter, setCategoryFilter] = useState<ActiveFilter>('all')
  const [brandFilter, setBrandFilter] = useState<ActiveFilter>('all')
  const [colorFilter, setColorFilter] = useState<ActiveFilter>('all')
  const [sizeFilter, setSizeFilter] = useState<ActiveFilter>('all')

  const [categoryPage, setCategoryPage] = useState(1)
  const [brandPage, setBrandPage] = useState(1)
  const [colorPage, setColorPage] = useState(1)
  const [sizePage, setSizePage] = useState(1)

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [brandModalOpen, setBrandModalOpen] = useState(false)
  const [colorModalOpen, setColorModalOpen] = useState(false)
  const [sizeModalOpen, setSizeModalOpen] = useState(false)

  const [editingCategory, setEditingCategory] = useState<MasterCategoryItem | null>(null)
  const [editingBrand, setEditingBrand] = useState<MasterBrandItem | null>(null)
  const [editingColor, setEditingColor] = useState<MasterColorItem | null>(null)
  const [editingSize, setEditingSize] = useState<MasterSizeItem | null>(null)

  const categoriesQuery = useQuery({
    queryKey: queryKeys.admin.masterData.categories({
      page: categoryPage,
      limit: PAGE_SIZE,
      search: categorySearch,
      isActive: toIsActiveParam(categoryFilter),
    }),
    queryFn: () =>
      listMasterCategories({
        page: categoryPage,
        limit: PAGE_SIZE,
        search: categorySearch || undefined,
        isActive: toIsActiveParam(categoryFilter),
      }),
  })

  const brandsQuery = useQuery({
    queryKey: queryKeys.admin.masterData.brands({
      page: brandPage,
      limit: PAGE_SIZE,
      search: brandSearch,
      isActive: toIsActiveParam(brandFilter),
    }),
    queryFn: () =>
      listMasterBrands({
        page: brandPage,
        limit: PAGE_SIZE,
        search: brandSearch || undefined,
        isActive: toIsActiveParam(brandFilter),
      }),
  })

  const colorsQuery = useQuery({
    queryKey: queryKeys.admin.masterData.colors({
      page: colorPage,
      limit: PAGE_SIZE,
      search: colorSearch,
      isActive: toIsActiveParam(colorFilter),
    }),
    queryFn: () =>
      listMasterColors({
        page: colorPage,
        limit: PAGE_SIZE,
        search: colorSearch || undefined,
        isActive: toIsActiveParam(colorFilter),
      }),
  })

  const sizesQuery = useQuery({
    queryKey: queryKeys.admin.masterData.sizes({
      page: sizePage,
      limit: PAGE_SIZE,
      search: sizeSearch,
      isActive: toIsActiveParam(sizeFilter),
    }),
    queryFn: () =>
      listMasterSizes({
        page: sizePage,
        limit: PAGE_SIZE,
        search: sizeSearch || undefined,
        isActive: toIsActiveParam(sizeFilter),
      }),
  })

  const activeCategoriesQuery = useQuery({
    queryKey: queryKeys.admin.productMeta.categories,
    queryFn: () =>
      listMasterCategories({
        page: 1,
        limit: 100,
      }).then((data) => data.items),
  })

  const invalidateMasterData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.products.filters }),
    ])
  }

  const createCategoryMutation = useMutation({
    mutationFn: createMasterCategory,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Tạo danh mục thành công')
      setCategoryModalOpen(false)
      setEditingCategory(null)
      categoryForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UpsertCategoryPayload> }) =>
      updateMasterCategory(id, payload),
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Cập nhật danh mục thành công')
      setCategoryModalOpen(false)
      setEditingCategory(null)
      categoryForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteMasterCategory,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Đã xóa danh mục')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createBrandMutation = useMutation({
    mutationFn: createMasterBrand,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Tạo thương hiệu thành công')
      setBrandModalOpen(false)
      setEditingBrand(null)
      brandForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateBrandMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UpsertBrandPayload> }) =>
      updateMasterBrand(id, payload),
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Cập nhật thương hiệu thành công')
      setBrandModalOpen(false)
      setEditingBrand(null)
      brandForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteBrandMutation = useMutation({
    mutationFn: deleteMasterBrand,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Đã xóa thương hiệu')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createColorMutation = useMutation({
    mutationFn: createMasterColor,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Tạo màu sắc thành công')
      setColorModalOpen(false)
      setEditingColor(null)
      colorForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateColorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UpsertColorPayload> }) =>
      updateMasterColor(id, payload),
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Cập nhật màu sắc thành công')
      setColorModalOpen(false)
      setEditingColor(null)
      colorForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteColorMutation = useMutation({
    mutationFn: deleteMasterColor,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Đã xóa màu sắc')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createSizeMutation = useMutation({
    mutationFn: createMasterSize,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Tạo size thành công')
      setSizeModalOpen(false)
      setEditingSize(null)
      sizeForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateSizeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UpsertSizePayload> }) =>
      updateMasterSize(id, payload),
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Cập nhật size thành công')
      setSizeModalOpen(false)
      setEditingSize(null)
      sizeForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteSizeMutation = useMutation({
    mutationFn: deleteMasterSize,
    onSuccess: async () => {
      await invalidateMasterData()
      void message.success('Đã xóa size')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const categoryColumns: ColumnsType<MasterCategoryItem> = useMemo(
    () => [
      {
        title: 'Tên danh mục',
        key: 'name',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.name}</Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              slug: {record.slug}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Parent',
        dataIndex: 'parentId',
        key: 'parentId',
        width: 180,
        render: (value: string | undefined) => {
          if (!value) {
            return <Typography.Text type="secondary">Root</Typography.Text>
          }

          const parent = activeCategoriesQuery.data?.find((item) => item.id === value)
          return parent?.name ?? value
        },
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 130,
        render: (value: boolean) => <ActiveStatusTag active={value} />,
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 170,
        render: (value: string) => (
          <Typography.Text type="secondary" className="text-xs">
            {formatDateTime(value)}
          </Typography.Text>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 210,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingCategory(record)
                categoryForm.setFieldsValue({
                  name: record.name,
                  slug: record.slug,
                  description: record.description,
                  parentId: record.parentId,
                  image: record.image,
                  isActive: record.isActive,
                })
                setCategoryModalOpen(true)
              }}
            >
              Sửa
            </Button>
            <Popconfirm
              title={`Xóa danh mục "${record.name}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                deleteCategoryMutation.mutate(record.id)
              }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteCategoryMutation.isPending}
              >
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [activeCategoriesQuery.data, categoryForm, deleteCategoryMutation]
  )

  const brandColumns: ColumnsType<MasterBrandItem> = useMemo(
    () => [
      {
        title: 'Thương hiệu',
        key: 'name',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.name}</Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              slug: {record.slug}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Logo',
        dataIndex: 'logoUrl',
        key: 'logoUrl',
        width: 260,
        render: (value: string | undefined) =>
          value ? (
            <Typography.Text copyable className="text-xs">
              {value}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 130,
        render: (value: boolean) => <ActiveStatusTag active={value} />,
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 170,
        render: (value: string) => (
          <Typography.Text type="secondary" className="text-xs">
            {formatDateTime(value)}
          </Typography.Text>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 210,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingBrand(record)
                brandForm.setFieldsValue({
                  name: record.name,
                  slug: record.slug,
                  description: record.description,
                  logoUrl: record.logoUrl,
                  isActive: record.isActive,
                })
                setBrandModalOpen(true)
              }}
            >
              Sửa
            </Button>
            <Popconfirm
              title={`Xóa thương hiệu "${record.name}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                deleteBrandMutation.mutate(record.id)
              }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteBrandMutation.isPending}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [brandForm, deleteBrandMutation]
  )

  const colorColumns: ColumnsType<MasterColorItem> = useMemo(
    () => [
      {
        title: 'Màu sắc',
        key: 'name',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Space size={8}>
              {record.hexCode ? (
                <span
                  className="inline-block h-3 w-3 rounded-full border border-slate-300"
                  style={{ backgroundColor: record.hexCode }}
                />
              ) : null}
              <Typography.Text strong>{record.name}</Typography.Text>
            </Space>
            <Typography.Text type="secondary" className="text-xs">
              slug: {record.slug}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'HEX',
        dataIndex: 'hexCode',
        key: 'hexCode',
        width: 120,
        render: (value: string | undefined) => value || '-',
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 130,
        render: (value: boolean) => <ActiveStatusTag active={value} />,
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 170,
        render: (value: string) => (
          <Typography.Text type="secondary" className="text-xs">
            {formatDateTime(value)}
          </Typography.Text>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 210,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingColor(record)
                colorForm.setFieldsValue({
                  name: record.name,
                  slug: record.slug,
                  hexCode: record.hexCode,
                  isActive: record.isActive,
                })
                setColorModalOpen(true)
              }}
            >
              Sửa
            </Button>
            <Popconfirm
              title={`Xóa màu "${record.name}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                deleteColorMutation.mutate(record.id)
              }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteColorMutation.isPending}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [colorForm, deleteColorMutation]
  )

  const sizeColumns: ColumnsType<MasterSizeItem> = useMemo(
    () => [
      {
        title: 'Size',
        key: 'name',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.name}</Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              slug: {record.slug}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 130,
        render: (value: boolean) => <ActiveStatusTag active={value} />,
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 170,
        render: (value: string) => (
          <Typography.Text type="secondary" className="text-xs">
            {formatDateTime(value)}
          </Typography.Text>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 210,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingSize(record)
                sizeForm.setFieldsValue({
                  name: record.name,
                  slug: record.slug,
                  isActive: record.isActive,
                })
                setSizeModalOpen(true)
              }}
            >
              Sửa
            </Button>
            <Popconfirm
              title={`Xóa size "${record.name}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                deleteSizeMutation.mutate(record.id)
              }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteSizeMutation.isPending}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteSizeMutation, sizeForm]
  )

  const activeFilterOptions = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Đang dùng', value: 'active' },
    { label: 'Ngừng dùng', value: 'inactive' },
  ]

  return (
    <div className="space-y-5">
      <Typography.Title level={3} className="!mb-0">
        Admin - Quản lý danh mục, thương hiệu, màu sắc, size
      </Typography.Title>
      <Typography.Paragraph className="!mb-0" type="secondary">
        Quản lý dữ liệu nền cho catalog sản phẩm. Dữ liệu này dùng cho form tạo sản phẩm và variants.
      </Typography.Paragraph>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            const nextTab = resolveMasterDataTab(key)
            const nextSearchParams = new URLSearchParams(searchParams)

            if (nextTab === DEFAULT_MASTER_DATA_TAB) {
              nextSearchParams.delete('tab')
            } else {
              nextSearchParams.set('tab', nextTab)
            }

            setSearchParams(nextSearchParams, { replace: true })
          }}
          items={[
            {
              key: 'categories',
              label: 'Danh mục',
              children: (
                <>
                  <div className="mb-4 flex flex-wrap gap-3">
                    <Input.Search
                      allowClear
                      className="w-full md:max-w-sm"
                      placeholder="Tìm danh mục"
                      value={categorySearchInput}
                      onChange={(event) => {
                        setCategorySearchInput(event.target.value)
                        if (!event.target.value.trim()) {
                          setCategorySearch('')
                          setCategoryPage(1)
                        }
                      }}
                      onSearch={(value) => {
                        setCategorySearch(value.trim())
                        setCategoryPage(1)
                      }}
                    />
                    <Select
                      className="w-full md:w-44"
                      value={categoryFilter}
                      options={activeFilterOptions}
                      onChange={(value) => {
                        setCategoryFilter(value)
                        setCategoryPage(1)
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingCategory(null)
                        categoryForm.resetFields()
                        categoryForm.setFieldsValue({
                          isActive: true,
                        })
                        setCategoryModalOpen(true)
                      }}
                    >
                      Thêm danh mục
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={categoryColumns}
                    dataSource={categoriesQuery.data?.items ?? []}
                    loading={categoriesQuery.isLoading || categoriesQuery.isFetching}
                    pagination={{
                      current: categoryPage,
                      pageSize: PAGE_SIZE,
                      total: categoriesQuery.data?.totalItems ?? 0,
                      showSizeChanger: false,
                      onChange: setCategoryPage,
                    }}
                  />
                </>
              ),
            },
            {
              key: 'brands',
              label: 'Thương hiệu',
              children: (
                <>
                  <div className="mb-4 flex flex-wrap gap-3">
                    <Input.Search
                      allowClear
                      className="w-full md:max-w-sm"
                      placeholder="Tìm thương hiệu"
                      value={brandSearchInput}
                      onChange={(event) => {
                        setBrandSearchInput(event.target.value)
                        if (!event.target.value.trim()) {
                          setBrandSearch('')
                          setBrandPage(1)
                        }
                      }}
                      onSearch={(value) => {
                        setBrandSearch(value.trim())
                        setBrandPage(1)
                      }}
                    />
                    <Select
                      className="w-full md:w-44"
                      value={brandFilter}
                      options={activeFilterOptions}
                      onChange={(value) => {
                        setBrandFilter(value)
                        setBrandPage(1)
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingBrand(null)
                        brandForm.resetFields()
                        brandForm.setFieldsValue({
                          isActive: true,
                        })
                        setBrandModalOpen(true)
                      }}
                    >
                      Thêm thương hiệu
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={brandColumns}
                    dataSource={brandsQuery.data?.items ?? []}
                    loading={brandsQuery.isLoading || brandsQuery.isFetching}
                    pagination={{
                      current: brandPage,
                      pageSize: PAGE_SIZE,
                      total: brandsQuery.data?.totalItems ?? 0,
                      showSizeChanger: false,
                      onChange: setBrandPage,
                    }}
                  />
                </>
              ),
            },
            {
              key: 'colors',
              label: 'Màu sắc',
              children: (
                <>
                  <div className="mb-4 flex flex-wrap gap-3">
                    <Input.Search
                      allowClear
                      className="w-full md:max-w-sm"
                      placeholder="Tìm màu sắc"
                      value={colorSearchInput}
                      onChange={(event) => {
                        setColorSearchInput(event.target.value)
                        if (!event.target.value.trim()) {
                          setColorSearch('')
                          setColorPage(1)
                        }
                      }}
                      onSearch={(value) => {
                        setColorSearch(value.trim())
                        setColorPage(1)
                      }}
                    />
                    <Select
                      className="w-full md:w-44"
                      value={colorFilter}
                      options={activeFilterOptions}
                      onChange={(value) => {
                        setColorFilter(value)
                        setColorPage(1)
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingColor(null)
                        colorForm.resetFields()
                        colorForm.setFieldsValue({
                          isActive: true,
                        })
                        setColorModalOpen(true)
                      }}
                    >
                      Thêm màu
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={colorColumns}
                    dataSource={colorsQuery.data?.items ?? []}
                    loading={colorsQuery.isLoading || colorsQuery.isFetching}
                    pagination={{
                      current: colorPage,
                      pageSize: PAGE_SIZE,
                      total: colorsQuery.data?.totalItems ?? 0,
                      showSizeChanger: false,
                      onChange: setColorPage,
                    }}
                  />
                </>
              ),
            },
            {
              key: 'sizes',
              label: 'Size',
              children: (
                <>
                  <div className="mb-4 flex flex-wrap gap-3">
                    <Input.Search
                      allowClear
                      className="w-full md:max-w-sm"
                      placeholder="Tìm size"
                      value={sizeSearchInput}
                      onChange={(event) => {
                        setSizeSearchInput(event.target.value)
                        if (!event.target.value.trim()) {
                          setSizeSearch('')
                          setSizePage(1)
                        }
                      }}
                      onSearch={(value) => {
                        setSizeSearch(value.trim())
                        setSizePage(1)
                      }}
                    />
                    <Select
                      className="w-full md:w-44"
                      value={sizeFilter}
                      options={activeFilterOptions}
                      onChange={(value) => {
                        setSizeFilter(value)
                        setSizePage(1)
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingSize(null)
                        sizeForm.resetFields()
                        sizeForm.setFieldsValue({
                          isActive: true,
                        })
                        setSizeModalOpen(true)
                      }}
                    >
                      Thêm size
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={sizeColumns}
                    dataSource={sizesQuery.data?.items ?? []}
                    loading={sizesQuery.isLoading || sizesQuery.isFetching}
                    pagination={{
                      current: sizePage,
                      pageSize: PAGE_SIZE,
                      total: sizesQuery.data?.totalItems ?? 0,
                      showSizeChanger: false,
                      onChange: setSizePage,
                    }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCategory ? 'Cập nhật danh mục' : 'Tạo danh mục'}
        open={categoryModalOpen}
        onCancel={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
          categoryForm.resetFields()
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<CategoryFormValues>
          form={categoryForm}
          layout="vertical"
          initialValues={{ isActive: true }}
          onFinish={(values) => {
            const payload: UpsertCategoryPayload = {
              name: values.name.trim(),
              slug: values.slug.trim(),
              description: values.description?.trim() || undefined,
              parentId: values.parentId || undefined,
              image: values.image?.trim() || undefined,
              isActive: values.isActive,
            }

            if (editingCategory) {
              updateCategoryMutation.mutate({
                id: editingCategory.id,
                payload,
              })
              return
            }

            createCategoryMutation.mutate(payload)
          }}
        >
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Vui lòng nhập slug' }]}>
            <Input
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    const name = categoryForm.getFieldValue('name') ?? ''
                    categoryForm.setFieldValue('slug', toSlug(name))
                  }}
                >
                  Tạo
                </Button>
              }
            />
          </Form.Item>
          <Form.Item name="parentId" label="Danh mục cha">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={(activeCategoriesQuery.data ?? [])
                .filter((item) => item.id !== editingCategory?.id)
                .map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="image" label="Ảnh danh mục (URL)">
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng dùng" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setCategoryModalOpen(false)
                setEditingCategory(null)
                categoryForm.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              {editingCategory ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingBrand ? 'Cập nhật thương hiệu' : 'Tạo thương hiệu'}
        open={brandModalOpen}
        onCancel={() => {
          setBrandModalOpen(false)
          setEditingBrand(null)
          brandForm.resetFields()
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<BrandFormValues>
          form={brandForm}
          layout="vertical"
          initialValues={{ isActive: true }}
          onFinish={(values) => {
            const payload: UpsertBrandPayload = {
              name: values.name.trim(),
              slug: values.slug.trim(),
              description: values.description?.trim() || undefined,
              logoUrl: values.logoUrl?.trim() || undefined,
              isActive: values.isActive,
            }

            if (editingBrand) {
              updateBrandMutation.mutate({
                id: editingBrand.id,
                payload,
              })
              return
            }

            createBrandMutation.mutate(payload)
          }}
        >
          <Form.Item name="name" label="Tên thương hiệu" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Vui lòng nhập slug' }]}>
            <Input
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    const name = brandForm.getFieldValue('name') ?? ''
                    brandForm.setFieldValue('slug', toSlug(name))
                  }}
                >
                  Tạo
                </Button>
              }
            />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo URL">
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng dùng" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setBrandModalOpen(false)
                setEditingBrand(null)
                brandForm.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createBrandMutation.isPending || updateBrandMutation.isPending}
            >
              {editingBrand ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingColor ? 'Cập nhật màu sắc' : 'Tạo màu sắc'}
        open={colorModalOpen}
        onCancel={() => {
          setColorModalOpen(false)
          setEditingColor(null)
          colorForm.resetFields()
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<ColorFormValues>
          form={colorForm}
          layout="vertical"
          initialValues={{ isActive: true }}
          onFinish={(values) => {
            const payload: UpsertColorPayload = {
              name: values.name.trim(),
              slug: values.slug.trim(),
              hexCode: values.hexCode?.trim() || undefined,
              isActive: values.isActive,
            }

            if (editingColor) {
              updateColorMutation.mutate({
                id: editingColor.id,
                payload,
              })
              return
            }

            createColorMutation.mutate(payload)
          }}
        >
          <Form.Item name="name" label="Tên màu" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Vui lòng nhập slug' }]}>
            <Input
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    const name = colorForm.getFieldValue('name') ?? ''
                    colorForm.setFieldValue('slug', toSlug(name))
                  }}
                >
                  Tạo
                </Button>
              }
            />
          </Form.Item>
          <Form.Item name="hexCode" label="Mã HEX (vd: #1D4ED8)">
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng dùng" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setColorModalOpen(false)
                setEditingColor(null)
                colorForm.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createColorMutation.isPending || updateColorMutation.isPending}
            >
              {editingColor ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingSize ? 'Cập nhật size' : 'Tạo size'}
        open={sizeModalOpen}
        onCancel={() => {
          setSizeModalOpen(false)
          setEditingSize(null)
          sizeForm.resetFields()
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<SizeFormValues>
          form={sizeForm}
          layout="vertical"
          initialValues={{ isActive: true }}
          onFinish={(values) => {
            const payload: UpsertSizePayload = {
              name: values.name.trim(),
              slug: values.slug.trim(),
              isActive: values.isActive,
            }

            if (editingSize) {
              updateSizeMutation.mutate({
                id: editingSize.id,
                payload,
              })
              return
            }

            createSizeMutation.mutate(payload)
          }}
        >
          <Form.Item name="name" label="Tên size" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Vui lòng nhập slug' }]}>
            <Input
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    const name = sizeForm.getFieldValue('name') ?? ''
                    sizeForm.setFieldValue('slug', toSlug(name))
                  }}
                >
                  Tạo
                </Button>
              }
            />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng dùng" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setSizeModalOpen(false)
                setEditingSize(null)
                sizeForm.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createSizeMutation.isPending || updateSizeMutation.isPending}
            >
              {editingSize ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}