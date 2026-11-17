'use client'

import { useEffect } from 'react'
import { useMarkdownRender } from '@/hooks/use-markdown-render'

export default function WorkDescription({ markdown, onReady }: { markdown: string; onReady: () => void }) {
	const { content, loading } = useMarkdownRender(markdown)
	useEffect(() => { if (!loading && (!markdown || content !== null)) onReady() }, [loading, markdown, content, onReady])
	return <div className='prose prose-sm max-w-none' data-testid='work-description'>{content}</div>
}
