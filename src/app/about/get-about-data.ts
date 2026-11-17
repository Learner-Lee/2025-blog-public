import { promises as fs } from 'fs'
import path from 'path'
import type { AboutData } from './services/push-about'
import initialData from './list.json'

export async function getAboutData(): Promise<AboutData> {
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'about.json'), 'utf-8')
		const parsed = JSON.parse(raw)
		return { ...parsed, works: parsed.works ?? [] }
	} catch {
		return initialData as AboutData
	}
}
