import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import {
  getNewestProducts,
  getProducts,
  getTopSellingProducts,
} from '@/features/product/api/product.api'
import { queryKeys } from '@/shared/api/queryKeys'

interface UseHomeProductsOptions {
    search?: string
    categoryId?: string
    brand?: string
}

const HOME_PAGE_SIZE = 12

export const useHomeProducts = ({ search, categoryId, brand }: UseHomeProductsOptions) => {
    const topSellingQuery = useQuery({
        queryKey: queryKeys.products.topSelling,
        queryFn: () => getTopSellingProducts(8),
    })

    const newestQuery = useQuery({
        queryKey: queryKeys.products.newest,
        queryFn: () => getNewestProducts(8),
    })

    const allProductsQuery = useInfiniteQuery({
        queryKey: queryKeys.products.list({
            search: search ?? '',
            categoryId: categoryId ?? '',
            brand: brand ?? '',
            isAvailable: true,
            limit: HOME_PAGE_SIZE,
        }),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            getProducts({
                page: Number(pageParam),
                limit: HOME_PAGE_SIZE,
                isAvailable: true,
                search: search?.trim() ? search.trim() : undefined,
                categoryId: categoryId?.trim() ? categoryId.trim() : undefined,
                brand: brand?.trim() ? brand.trim() : undefined,
            }),
        getNextPageParam: (lastPage) => {
            if (lastPage.page >= lastPage.totalPages) {
                return undefined
            }

            return lastPage.page + 1
        },
    })

    return {
        topSellingQuery,
        newestQuery,
        allProductsQuery,
    }
}