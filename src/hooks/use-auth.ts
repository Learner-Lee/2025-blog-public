import { create } from 'zustand'
import { clearAllAuthCache, savePemToCache, getPemFromCache } from '@/lib/auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'

interface AuthStore {
	isAuth: boolean
	password: string | null
	// Alias for backwards compatibility
	privateKey: string | null
	setPassword: (password: string) => void
	setPrivateKey: (key: string) => void
	clearAuth: () => void
	refreshAuthState: () => void
	getAuthToken: () => Promise<string>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
	isAuth: false,
	password: null,
	privateKey: null,

	setPassword: async (password: string) => {
		set({ isAuth: true, password, privateKey: password })
		await savePemToCache(password)
	},

	setPrivateKey: (key: string) => {
		get().setPassword(key)
	},

	clearAuth: () => {
		clearAllAuthCache()
		set({ isAuth: false, password: null, privateKey: null })
	},

	refreshAuthState: async () => {
		const cached = await getPemFromCache()
		set({ isAuth: !!(get().password || cached) })
	},

	getAuthToken: async () => {
		const password = get().password
		if (!password) throw new Error('需要先输入密码')
		return password
	}
}))

// Initialize from cache
getPemFromCache().then(cached => {
	if (cached) {
		useAuthStore.setState({ password: cached, privateKey: cached, isAuth: true })
	}
})
