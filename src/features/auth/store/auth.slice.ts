import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AuthState, AuthStatus, AuthUser } from '@/features/auth/model/auth.types'

const initialState: AuthState = {
  accessToken: null,
  user: null,
  status: 'idle',
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload
      state.status = action.payload ? 'authenticated' : 'unauthenticated'
    },
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload
    },
    setAuthStatus: (state, action: PayloadAction<AuthStatus>) => {
      state.status = action.payload
    },
    clearAuth: (state) => {
      state.accessToken = null
      state.user = null
      state.status = 'unauthenticated'
    },
  },
})

export const { setAccessToken, setUser, setAuthStatus, clearAuth } = authSlice.actions

export const authReducer = authSlice.reducer