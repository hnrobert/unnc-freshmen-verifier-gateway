import { createI18n } from 'vue-i18n'
import type { Locale } from '#shared/types'
import defaultConfig from '#shared/lib/defaultConfig'
import { escapeI18nMessages } from '#shared/lib/escapeMessage'

// Dashboard/editor UI labels (always available, not per-org).
const dashboardMessages: Record<Locale, Record<string, unknown>> = {
  zh: {
    editor: {
      themeColor: '主题色',
      reset: '重置',
      locales: '语言',
      defaultLocale: '默认',
      backgroundImage: '背景图片',
      uploadBackground: '上传背景',
      overlay: '遮罩',
      remove: '移除',
      preview: '预览',
      bgCoverHint: '背景铺满 + 遮罩',
      welcomeImage: '欢迎图片',
      uploadWelcome: '上传欢迎图片',
      maxWidth: '最大宽度',
      radius: '圆角',
      actualSizeHint: '实际尺寸与圆角',
      brand: '品牌',
      brandTitle: '标题',
      brandSubtitle: '副标题',
      welcomePage: '欢迎页',
      welcomeBadge: '徽章',
      welcomeTitle: '标题',
      welcomeBody: '正文',
      welcomeExtra: '欢迎页（额外）',
      welcomeImageAlt: '图片描述',
      welcomeBack: '返回',
      verifyPage: '验证页',
      verifyHeading: '标题',
      verifySubheading: '副标题',
      verifyNameLabel: '姓名标签',
      verifyNamePlaceholder: '姓名占位符',
      verifyIdLabel: '身份证标签',
      verifyIdPlaceholder: '身份证占位符',
      verifySubmit: '提交按钮',
      verifyHint: '提示',
      errorsSection: '错误提示',
      errorEmptyName: '姓名为空',
      errorBadIdFormat: '身份证格式错误',
      errorNotAdmitted: '未录取',
      errorCaptcha: '验证码',
      errorNetwork: '网络',
      errorGeneric: '通用',
      admissionDetails: '录取信息',
      admissionTitle: '标题',
      admissionName: '姓名',
      admissionUniversity: '院校',
      admissionDate: '日期',
      admissionDetail: '详情',
      footerMisc: '页脚与其他',
      footer: '页脚',
      themeToggle: '主题切换',
      languageLabel: '语言标签',
      iconsOther: '图标（其他）',
      gateway: '网关',
      gatewayMode: '模式',
      gatewayBaseUrl: '基础 URL',
      gatewayMaxCaptchaRounds: '最大验证轮次',
      gatewayMaxOffsetTries: '最大偏移尝试',
      gatewayRequestTimeoutMs: '请求超时 (ms)',
      theme: '主题',
      themeRadius: '圆角',
      advancedSettings: '高级设置',
      lucideName: 'Lucide 名称',
      browse: '浏览',
      uploadCustomImage: '上传自定义图片',
      usingImage: '使用图片',
      switchToIcon: '切换为图标',
      iconsOtherSection: '图标',
    },
  },
  en: {
    editor: {
      themeColor: 'Theme Color',
      reset: 'Reset',
      locales: 'Locales',
      defaultLocale: 'Default',
      backgroundImage: 'Background Image',
      uploadBackground: 'Upload Background',
      overlay: 'Overlay',
      remove: 'Remove',
      preview: 'Preview',
      bgCoverHint: 'Background-cover + overlay',
      welcomeImage: 'Welcome Image',
      uploadWelcome: 'Upload Welcome Image',
      maxWidth: 'Max Width',
      radius: 'Radius',
      actualSizeHint: 'Actual size & radius',
      brand: 'Brand',
      brandTitle: 'Title',
      brandSubtitle: 'Subtitle',
      welcomePage: 'Welcome Page',
      welcomeBadge: 'Badge',
      welcomeTitle: 'Title',
      welcomeBody: 'Body',
      welcomeExtra: 'Welcome Page (Extra)',
      welcomeImageAlt: 'Image Alt',
      welcomeBack: 'Back',
      verifyPage: 'Verify Page',
      verifyHeading: 'Heading',
      verifySubheading: 'Subheading',
      verifyNameLabel: 'Name Label',
      verifyNamePlaceholder: 'Name Placeholder',
      verifyIdLabel: 'ID Label',
      verifyIdPlaceholder: 'ID Placeholder',
      verifySubmit: 'Submit',
      verifyHint: 'Hint',
      errorsSection: 'Errors',
      errorEmptyName: 'Empty Name',
      errorBadIdFormat: 'Bad ID Format',
      errorNotAdmitted: 'Not Admitted',
      errorCaptcha: 'Captcha',
      errorNetwork: 'Network',
      errorGeneric: 'Generic',
      admissionDetails: 'Admission Details',
      admissionTitle: 'Title',
      admissionName: 'Name',
      admissionUniversity: 'University',
      admissionDate: 'Date',
      admissionDetail: 'Detail',
      footerMisc: 'Footer & Misc',
      footer: 'Footer',
      themeToggle: 'Theme Toggle',
      languageLabel: 'Language Label',
      iconsOtherSection: 'Icons',
      gateway: 'Gateway',
      gatewayMode: 'Mode',
      gatewayBaseUrl: 'Base URL',
      gatewayMaxCaptchaRounds: 'Max Captcha Rounds',
      gatewayMaxOffsetTries: 'Max Offset Tries',
      gatewayRequestTimeoutMs: 'Request Timeout (ms)',
      theme: 'Theme',
      themeRadius: 'Radius',
      advancedSettings: 'Advanced Settings',
      lucideName: 'Lucide Name',
      browse: 'Browse',
      uploadCustomImage: 'Upload Custom Image',
      usingImage: 'Using Image',
      switchToIcon: 'Switch To Icon',
    },
  },
}

// Deep-merge the default org config's messages (brand.title, welcome.badge,
// etc.) into the base so they're always present — even before an org layout
// calls `applyOrgI18n`. Org-specific messages are merged on top later.
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(override)) {
    const ov = override[key]
    if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
      out[key] = deepMerge(
        (base[key] as Record<string, unknown>) ?? {},
        ov as Record<string, unknown>,
      )
    } else {
      out[key] = ov
    }
  }
  return out
}

const messages = structuredClone(dashboardMessages) as Record<Locale, Record<string, unknown>>
for (const loc of defaultConfig.locales) {
  const orgDefaults = escapeI18nMessages(defaultConfig.messages[loc]) as Record<string, unknown>
  messages[loc] = deepMerge(messages[loc] ?? {}, orgDefaults)
}

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: 'zh',
    fallbackLocale: 'zh',
    availableLocales: ['zh', 'en'],
    messages: messages as unknown as Parameters<typeof createI18n>[0]['messages'],
  })
  nuxtApp.vueApp.use(i18n)
})
