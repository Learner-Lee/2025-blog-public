import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
	'.md': 'text/markdown; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
}

// Image files use content-hash filenames → safe to cache forever
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
	const { slug } = await params
	const filePath = path.join(process.cwd(), 'public', 'blogs', ...slug)

	// Prevent path traversal
	const blogsRoot = path.join(process.cwd(), 'public', 'blogs')
	if (!filePath.startsWith(blogsRoot)) {
		return new NextResponse('Forbidden', { status: 403 })
	}

	try {
		const content = await fs.readFile(filePath)
		const ext = path.extname(filePath).toLowerCase()
		const contentType = MIME[ext] || 'application/octet-stream'
		const cacheControl = IMAGE_EXTS.has(ext)
			? 'public, max-age=31536000, immutable'
			: 'no-cache'
		const headers: Record<string, string> = {
			'Content-Type': contentType,
			'Cache-Control': cacheControl,
		}
		// HTML 笔记直接打开时也跑在隔离的 opaque origin 里，读不到本站的 sessionStorage（blog.key）
		if (ext === '.html') {
			headers['Content-Security-Policy'] = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox'
		}
		return new NextResponse(content, { headers })
	} catch {
		return new NextResponse('Not found', { status: 404 })
	}
}
