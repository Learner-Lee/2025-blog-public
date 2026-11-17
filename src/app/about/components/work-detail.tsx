'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { useMarkdownRender } from '@/hooks/use-markdown-render'
import type { Work } from '../services/push-about'

export default function WorkDetail({ work }: { work: Work }) {
	const { content, loading } = useMarkdownRender(work.content)
	const reduceMotion = useReducedMotion()

	return (
		<div className='mx-auto w-full max-w-[900px] px-6 pt-28 pb-16 max-sm:px-0'>
			<Link href='/about' className='text-secondary hover:text-brand mb-6 inline-flex items-center gap-2 text-sm transition-colors'>
				<span aria-hidden='true'>←</span> 返回作品展示
			</Link>
			<motion.article
				initial={reduceMotion ? false : { opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				className='card overflow-hidden p-7 max-sm:p-4'>
				{work.image && <img src={work.image} alt={work.name} className='mb-7 aspect-video w-full rounded-2xl object-cover max-sm:mb-5' />}
				<div className='mb-4 flex flex-wrap items-baseline gap-3'>
					<h1 className='text-3xl font-bold max-sm:text-2xl'>{work.name}</h1>
					<span className='text-secondary text-sm'>{work.year}</span>
				</div>
				{work.tagline && <p className='text-secondary mb-5 text-base leading-7'>{work.tagline}</p>}
				<div className='mb-6 flex flex-wrap gap-2'>
					{work.tags.map(tag => <span key={tag} className='text-secondary bg-bg rounded-lg px-2.5 py-1 text-xs'>{tag}</span>)}
				</div>
				<div className='mb-7 flex flex-wrap gap-3'>
					{work.demo && <a href={work.demo} target='_blank' rel='noopener noreferrer' className='brand-btn rounded-lg px-5 py-2.5 text-sm'>在线体验 ↗</a>}
					{work.github && <a href={work.github} target='_blank' rel='noopener noreferrer' className='bg-card hover:bg-bg rounded-lg border px-5 py-2.5 text-sm transition-colors'>GitHub ↗</a>}
				</div>
				{work.content && (
					<div className='border-secondary/10 border-t pt-6'>
						{loading ? <p role='status' className='text-secondary text-sm'>正在加载作品介绍…</p> : <div className='prose prose-sm max-w-none' data-testid='work-description'>{content}</div>}
					</div>
				)}
			</motion.article>
		</div>
	)
}
