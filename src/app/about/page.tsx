import { promises as fs } from 'fs'
import path from 'path'
import AboutClient from './about-client'
import type { AboutData } from './services/push-about'
import initialData from './list.json'

async function getLiveAboutData(): Promise<AboutData> {
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'about.json'), 'utf-8')
		return JSON.parse(raw)
	} catch {
		return initialData as AboutData
	}
}

export default async function Page() {
	const data = await getLiveAboutData()
	return <AboutClient initialData={data} />
}
