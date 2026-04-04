import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	const { password } = await req.json()
	const secret = process.env.BLOG_SECRET

	if (!secret) {
		return NextResponse.json({ error: '未配置 BLOG_SECRET' }, { status: 500 })
	}

	// BLOG_SECRET 存储的是 key 文件内容的 SHA-256 哈希值
	const hash = createHash('sha256').update(password.trim()).digest('hex')

	if (hash === secret) {
		return NextResponse.json({ ok: true })
	}

	return NextResponse.json({ error: '密钥错误' }, { status: 401 })
}
