import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getAboutData } from '../get-about-data'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params
	const data = await getAboutData()
	const work = data.works.find(entry => entry.id === id)
	return work ? { title: `${work.name} · 作品展示`, description: work.tagline } : { title: '作品不存在' }
}

export default async function Page({ params }: Props) {
	const { id } = await params
	const data = await getAboutData()
	const work = data.works.find(entry => entry.id === id)
	if (!work) notFound()
	redirect(`/about?work=${encodeURIComponent(work.id)}`)
}
