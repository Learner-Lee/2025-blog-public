import '@/styles/globals.css'

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { promises as fs } from 'fs'
import path from 'path'
import Layout from '@/layout'
import Head from '@/layout/head'
import defaultSiteContent from '@/config/site-content.json'

async function getLiveSiteContent() {
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'site-content.json'), 'utf-8')
		return JSON.parse(raw)
	} catch {
		return null
	}
}

export async function generateMetadata(): Promise<Metadata> {
	const live = await getLiveSiteContent()
	const { title, description } = (live ?? defaultSiteContent).meta
	return {
		title,
		description,
		openGraph: { title, description },
		twitter: { title, description }
	}
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const live = await getLiveSiteContent()
	const siteContent = live ?? defaultSiteContent
	const { theme } = siteContent

	const htmlStyle = {
		cursor: 'url(/images/cursor.svg) 2 1, auto',
		'--color-brand': theme.colorBrand,
		'--color-primary': theme.colorPrimary,
		'--color-secondary': theme.colorSecondary,
		'--color-brand-secondary': theme.colorBrandSecondary,
		'--color-bg': theme.colorBg,
		'--color-border': theme.colorBorder,
		'--color-card': theme.colorCard,
		'--color-article': theme.colorArticle
	}

	return (
		<html lang='en' suppressHydrationWarning style={htmlStyle}>
			<Head />

			<body>
				<script
					dangerouslySetInnerHTML={{
						__html: `
						if (/windows|win32/i.test(navigator.userAgent)) {
							document.documentElement.classList.add('windows');
						}
						window.__INITIAL_SITE_CONFIG__ = ${JSON.stringify(siteContent)};
						`
					}}
				/>

				<Layout>{children}</Layout>
			</body>
		</html>
	)
}
