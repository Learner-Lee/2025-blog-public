const AUTH_CACHE_KEY = 'blog_auth'

function savePasswordToCache(password: string): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.setItem(AUTH_CACHE_KEY, password)
	} catch {}
}

function getPasswordFromCache(): string | null {
	if (typeof sessionStorage === 'undefined') return null
	try {
		return sessionStorage.getItem(AUTH_CACHE_KEY)
	} catch {
		return null
	}
}

function clearPasswordCache(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.removeItem(AUTH_CACHE_KEY)
	} catch {}
}

export function clearAllAuthCache(): void {
	clearPasswordCache()
}

export async function hasAuth(): Promise<boolean> {
	const { useAuthStore } = await import('@/hooks/use-auth')
	return !!useAuthStore.getState().password || !!getPasswordFromCache()
}

export function getAuthToken(): string {
	const { useAuthStore } = require('@/hooks/use-auth')
	const password = useAuthStore.getState().password
	if (!password) throw new Error('需要先输入密码')
	return password
}

// Keep these for isCachePem compatibility
export async function getPemFromCache(): Promise<string | null> {
	return getPasswordFromCache()
}

export async function savePemToCache(password: string): Promise<void> {
	savePasswordToCache(password)
}
