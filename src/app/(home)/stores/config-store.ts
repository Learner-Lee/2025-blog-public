import { create } from 'zustand'
import siteContentDefault from '@/config/site-content.json'
import cardStylesDefault from '@/config/card-styles.json'

export type SiteContent = typeof siteContentDefault
export type CardStyles = typeof cardStylesDefault

interface ConfigStore {
	siteContent: SiteContent
	cardStyles: CardStyles
	regenerateKey: number
	configDialogOpen: boolean
	setSiteContent: (content: SiteContent) => void
	setCardStyles: (styles: CardStyles) => void
	resetSiteContent: () => void
	resetCardStyles: () => void
	regenerateBubbles: () => void
	setConfigDialogOpen: (open: boolean) => void
}

// Use server-injected config if available (prevents flash of default content)
const getInitialSiteContent = (): SiteContent => {
	if (typeof window !== 'undefined' && (window as any).__INITIAL_SITE_CONFIG__) {
		return (window as any).__INITIAL_SITE_CONFIG__
	}
	return { ...siteContentDefault }
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
	siteContent: getInitialSiteContent(),
	cardStyles: { ...cardStylesDefault },
	regenerateKey: 0,
	configDialogOpen: false,
	setSiteContent: (content: SiteContent) => set({ siteContent: content }),
	setCardStyles: (styles: CardStyles) => set({ cardStyles: styles }),
	resetSiteContent: () => set({ siteContent: { ...siteContentDefault } }),
	resetCardStyles: () => set({ cardStyles: { ...cardStylesDefault } }),
	regenerateBubbles: () => set(state => ({ regenerateKey: state.regenerateKey + 1 })),
	setConfigDialogOpen: (open: boolean) => set({ configDialogOpen: open })
}))

// card-styles still needs a fetch (not injected server-side)
if (typeof window !== 'undefined') {
	fetch('/data/card-styles.json', { cache: 'no-store' })
		.then(r => r.ok ? r.json() : null)
		.then(data => { if (data) useConfigStore.setState({ cardStyles: data }) })
		.catch(() => {})
}
