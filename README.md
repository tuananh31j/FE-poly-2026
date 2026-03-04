# Poly2026 Frontend Base

Frontend base cho dự án `poly2026` với kiến trúc mở rộng theo module:

- React + TypeScript + Vite
- TanStack Query (server state)
- Redux Toolkit (client/global state tối thiểu cho auth)
- Ant Design + Tailwind CSS
- Axios interceptor với cơ chế refresh token queue
- React ApexCharts, lodash, dayjs

## 1. Run

```bash
npm install
npm run dev
```

Mặc định app chạy ở `http://localhost:5173`.

## 2. Environment

Tạo file `.env` từ `.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_APP_NAME=poly2026-fe
```

## 3. Scripts

- `npm run dev`: chạy local
- `npm run build`: type-check + build production
- `npm run preview`: preview build
- `npm run lint`: kiểm tra ESLint
- `npm run format`: kiểm tra format với Prettier
- `npm run format:write`: format code
- `npm run typecheck`: kiểm tra TypeScript

## 4. Architecture

```text
src/
  app/         # providers, router, query client, redux store, theme
  features/    # business modules (auth)
  layouts/     # public/private layout
  pages/       # page-level UI
  shared/      # api client, constants, utils, shared types/ui
  styles/      # global css + tailwind directives
  widgets/     # vùng mở rộng cho widget tái sử dụng
```

## 5. State Conventions

- Server state (API data): dùng TanStack Query.
- Client state (session/UI global): dùng Redux Toolkit.
- Không đưa dữ liệu query thông thường vào Redux.

## 6. Auth & Token Convention

- `accessToken`: lưu trong Redux memory.
- `refreshToken`: lưu trong cookie thường (frontend set/read).
- Axios tự động:
  - đính kèm `Authorization: Bearer <accessToken>`.
  - refresh token khi gặp `401`.
  - retry request cũ sau khi refresh thành công.
  - clear session + chuyển về `/login` nếu refresh fail.

## 7. Checklist khi thêm feature mới

1. Tạo module trong `src/features/<feature-name>`.
2. Định nghĩa API client + query keys riêng cho feature.
3. Dùng query/mutation hook cho data từ server.
4. Chỉ thêm Redux khi state không phù hợp để lưu trong query.
5. Tái sử dụng component từ `shared/ui` và layout hiện có.
