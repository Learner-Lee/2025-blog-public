import AboutClient from './about-client'
import { getAboutData } from './get-about-data'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ work?: string }> }) {
	const data = await getAboutData()
	const { work } = await searchParams
	const selected = typeof work === 'string' && data.works.some(entry => entry.id === work) ? work : null
	return <AboutClient initialData={data} initialExpandedId={selected} />
}
