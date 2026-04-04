'use client'

/**
 * 本地文件系统客户端，替代 github-client.ts
 * 通过 /api/files API 路由写入服务器本地文件
 */

export function toBase64Utf8(input: string): string {
	return btoa(unescape(encodeURIComponent(input)))
}

function getPassword(): string {
	// Dynamic import to avoid circular deps
	const { useAuthStore } = require('@/hooks/use-auth')
	return useAuthStore.getState().password || ''
}

async function apiRequest(method: string, body: object): Promise<Response> {
	const password = getPassword()
	return fetch('/api/files', {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${password}`
		},
		body: JSON.stringify(body)
	})
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
	const res = await apiRequest('POST', { path: filePath, content, encoding: 'utf-8' })
	if (res.status === 401) {
		const { useAuthStore } = require('@/hooks/use-auth')
		useAuthStore.getState().clearAuth()
		throw new Error('认证失败，请重新输入密码')
	}
	if (!res.ok) throw new Error(`写入文件失败: ${res.status}`)
}

export async function writeBinaryFile(filePath: string, base64Content: string): Promise<void> {
	const res = await apiRequest('POST', { path: filePath, content: base64Content, encoding: 'base64' })
	if (res.status === 401) {
		const { useAuthStore } = require('@/hooks/use-auth')
		useAuthStore.getState().clearAuth()
		throw new Error('认证失败，请重新输入密码')
	}
	if (!res.ok) throw new Error(`写入文件失败: ${res.status}`)
}

export async function deleteFile(filePath: string): Promise<void> {
	const res = await apiRequest('DELETE', { path: filePath })
	if (res.status === 401) {
		const { useAuthStore } = require('@/hooks/use-auth')
		useAuthStore.getState().clearAuth()
		throw new Error('认证失败，请重新输入密码')
	}
	if (!res.ok) throw new Error(`删除文件失败: ${res.status}`)
}

export async function listDirectory(dirPath: string): Promise<string[]> {
	const password = getPassword()
	const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}&list=true`, {
		headers: { Authorization: `Bearer ${password}` }
	})
	if (!res.ok) return []
	const { files } = await res.json()
	return files || []
}
