import { promises as fs } from 'fs'
import path from 'path'
import ShareClient from './share-client'
import type { Share } from './components/share-card'
import initialList from './list.json'

async function getLiveShares(): Promise<Share[]> {
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'shares.json'), 'utf-8')
		return JSON.parse(raw)
	} catch {
		return initialList as Share[]
	}
}

export default async function Page() {
	const shares = await getLiveShares()
	return <ShareClient initialList={shares} />
}
