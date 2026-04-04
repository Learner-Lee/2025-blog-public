/**
 * 生成博客管理密钥
 * 用法: node scripts/gen-key.mjs
 *
 * 输出:
 *   blog.key       — 保存在本地的密钥文件，上传到网页端用于认证
 *   BLOG_SECRET    — 密钥的 SHA-256 哈希值，写入服务器 .env.local
 */

import { randomBytes, createHash } from 'crypto'
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const keyPath = resolve(process.cwd(), 'blog.key')

if (existsSync(keyPath)) {
	console.log('⚠️  blog.key 已存在，如需重新生成请先删除该文件。')
	process.exit(1)
}

const key = randomBytes(32).toString('hex')
writeFileSync(keyPath, key, 'utf8')

const hash = createHash('sha256').update(key).digest('hex')

console.log('')
console.log('✅ 密钥文件已生成: blog.key')
console.log('')
console.log('请将以下内容写入服务器的 .env.local:')
console.log('')
console.log(`BLOG_SECRET=${hash}`)
console.log('')
console.log('⚠️  重要提示:')
console.log('  1. blog.key 是你的私人密钥，请妥善保管，不要上传到 Git 仓库')
console.log('  2. BLOG_SECRET 是哈希值，不是密钥本身，泄露也无法被利用')
console.log('  3. 登录时在网页端上传 blog.key 文件即可完成认证')
console.log('')
