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
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
	const { slug } = await params
	const filePath = path.join(process.cwd(), 'public', 'data', ...slug)

	const dataRoot = path.join(process.cwd(), 'public', 'data')
	if (!filePath.startsWith(dataRoot)) {
		return new NextResponse('Forbidden', { status: 403 })
	}

	try {
		const content = await fs.readFile(filePath)
		const ext = path.extname(filePath).toLowerCase()
		const contentType = MIME[ext] || 'application/octet-stream'
		return new NextResponse(content, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'no-cache',
			},
		})
	} catch {
		return new NextResponse('Not found', { status: 404 })
	}
}
