import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'
import footnote from 'markdown-it-footnote'

export default defineConfig({
  lang: 'zh-CN',
  title: '信号量小书',
  description: '《The Little Book of Semaphores》中文全译 · Allen B. Downey',
  base: '/little-semaphores-zh/',
  cleanUrls: true,
  lastUpdated: false,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/little-semaphores-zh/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#2d6a4f' }],
    ['meta', { property: 'og:title', content: '信号量小书（中文全译）' }],
    ['meta', { property: 'og:description', content: '用信号量解决并发同步问题：模式、经典问题与解法' }],
  ],

  sitemap: { hostname: 'https://stx-x.github.io/little-semaphores-zh/' },

  markdown: {
    math: true,
    lineNumbers: false,
    image: { lazyLoading: true },
    theme: { light: 'vitesse-light', dark: 'vitesse-dark' },
    config: (md) => {
      md.use(footnote)
      const make = (name: string) => ({
        render(tokens: any[], idx: number) {
          const token = tokens[idx]
          if (token.nesting === 1) {
            const info = token.info.trim().slice(name.length).trim()
            const title = info
              ? `<p class="custom-block-title">${md.utils.escapeHtml(info)}</p>\n`
              : ''
            return `<div class="custom-block ${name}">${title}`
          }
          return '</div>\n'
        },
      })
      md.use(container, 'crux', make('crux'))
      md.use(container, 'aside', make('aside'))
    },
  },

  themeConfig: {
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一节', next: '下一节' },
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',

    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: {
            tokenize: (text: string) => {
              const out: string[] = []
              const parts = text.split(/[\s\-_/.,;:!?()[\]{}"'“”‘’、，。；：！？（）《》]+/)
              for (const p of parts) {
                if (!p) continue
                if (/[\u4e00-\u9fa5]/.test(p)) {
                  for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i, i + 2))
                  if (p.length === 1) out.push(p)
                } else {
                  out.push(p.toLowerCase())
                }
              }
              return out
            },
          },
          searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 4, text: 2 } },
        },
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索本书' },
          modal: {
            displayDetails: '展开详情',
            resetButtonTitle: '清除条件',
            backButtonTitle: '返回',
            noResultsText: '没有找到结果',
            footer: {
              selectText: '选择', selectKeyAriaLabel: '回车',
              navigateText: '切换', navigateUpKeyAriaLabel: '上箭头',
              navigateDownKeyAriaLabel: '下箭头',
              closeText: '关闭', closeKeyAriaLabel: 'Esc',
            },
          },
        },
      },
    },

    nav: [
      { text: '首页', link: '/' },
      { text: '目录', link: '/contents' },
      { text: '原书', link: 'https://greenteapress.com/wp/semaphores/' },
    ],

    sidebar: [
      {
        text: '基础',
        items: [
          { text: '导论', link: '/intro' },
          { text: '信号量', link: '/semaphores' },
          { text: '基本同步模式', link: '/patterns' },
        ],
      },
      {
        text: '问题集',
        items: [
          { text: '经典同步问题', link: '/classical' },
          { text: '不太经典的问题', link: '/less-classical' },
          { text: '非经典问题', link: '/not-classical' },
          { text: '远非经典的问题', link: '/remotely-classical' },
        ],
      },
      {
        text: '代码实现',
        items: [
          { text: 'Python 中的同步', link: '/python' },
          { text: 'C 语言中的同步', link: '/c' },
          { text: '清理 Python 线程', link: '/cleanup-python' },
          { text: '清理 POSIX 线程', link: '/cleanup-posix' },
        ],
      },
    ],
  },
})
