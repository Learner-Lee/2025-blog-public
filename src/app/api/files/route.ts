import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { createHash } from 'crypto'

const ROOT = process.cwd()

function checkAuth(req: NextRequest): boolean {
	const secret = process.env.BLOG_SECRET
	if (!secret) return false
	const auth = req.headers.get('authorization')
	if (!auth?.startsWith('Bearer ')) return false
	const token = auth.slice(7)
	const hash = createHash('sha256').update(token.trim()).digest('hex')
	return hash === secret
}

function resolveSafePath(filePath: string): string | null {
	if (!filePath) return null
	const resolved = path.resolve(ROOT, filePath)
	// Only allow access within the project root
	if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) return null
	// Only allow public/ directory for writes
	const publicDir = path.resolve(ROOT, 'public')
	if (!resolved.startsWith(publicDir + path.sep) && resolved !== publicDir) return null
	return resolved
}

// Write file
export async function POST(req: NextRequest) {
	if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	const { path: filePath, content, encoding = 'utf-8' } = await req.json()
	const resolved = resolveSafePath(filePath)
	if (!resolved) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

	await fs.mkdir(path.dirname(resolved), { recursive: true })

	if (encoding === 'base64') {
		await fs.writeFile(resolved, Buffer.from(content, 'base64'))
	} else {
		await fs.writeFile(resolved, content, 'utf-8')
	}

	return NextResponse.json({ ok: true })
}

// Delete file
export async function DELETE(req: NextRequest) {
	if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	const { path: filePath } = await req.json()
	const resolved = resolveSafePath(filePath)
	if (!resolved) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

	try {
		await fs.unlink(resolved)
	} catch {
		// ignore if already deleted
	}

	return NextResponse.json({ ok: true })
}

// Read file or list directory
export async function GET(req: NextRequest) {
	if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	const filePath = req.nextUrl.searchParams.get('path')
	const list = req.nextUrl.searchParams.get('list') === 'true'

	if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

	const resolved = resolveSafePath(filePath)
	if (!resolved) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

	if (list) {
		// Recursively list all files in directory
		async function listRecursive(dir: string): Promise<string[]> {
			try {
				const entries = await fs.readdir(dir, { withFileTypes: true })
				const files: string[] = []
				for (const entry of entries) {
					const full = path.join(dir, entry.name)
					if (entry.isDirectory()) {
						files.push(...(await listRecursive(full)))
					} else {
						files.push(path.relative(ROOT, full))
					}
				}
				return files
			} catch {
				return []
			}
		}
		const files = await listRecursive(resolved)
		return NextResponse.json({ files })
	}

	try {
		const content = await fs.readFile(resolved, 'utf-8')
		return NextResponse.json({ content })
	} catch {
		return NextResponse.json({ content: null })
	}
}
