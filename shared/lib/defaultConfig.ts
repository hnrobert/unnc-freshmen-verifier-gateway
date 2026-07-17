/**
 * Default per-org SiteConfig — the seed/template used when a new organization is
 * created (see server/db/seed.ts + POST /api/orgs). Org owners then customize
 * their own copy via the dashboard editor. The `messages` block is fed verbatim
 * into vue-i18n; keys (e.g. `verify.nameLabel`) are exactly what templates use.
 *
 * Images use `img:<key>` (stored as base64 in the `org_images` table, served at
 * `/api/orgs/:slug/img-:key`). Set `gateway.mode: 'mock'` to preview the UI
 * without the portal. The portal is always queried server-side (no CORS).
 */
import type { SiteConfig } from '../types'

const config: SiteConfig = {
  locales: ['zh', 'en'],
  defaultLocale: 'zh',

  gateway: {
    // 'live' = query the real portal; 'mock' = admit any well-formed input (UI preview)
    mode: 'live',
    baseUrl: 'https://entry.nottingham.edu.cn',
    maxCaptchaRounds: 6,
    maxOffsetTries: 25,
    requestTimeoutMs: 20000,
  },

  // Every icon on every page. Use any lucide-vue-next name, or
  // { img: '/path.svg' } for a custom image (great for a school crest).
  icons: {
    brand: 'GraduationCap',
    nameField: 'User',
    idField: 'Fingerprint',
    submit: 'ArrowRight',
    verifying: 'LoaderCircle',
    welcome: 'PartyPopper',
    back: 'ArrowLeft',
    toggleLanguage: 'Languages',
    toggleTheme: 'SunMoon',
    error: 'CircleAlert',
    success: 'CircleCheck',
  },

  theme: {
    radius: '0.65rem',
  },

  welcome: {
    // Place an image in `public/` and reference it here, or use any remote URL.
    image: './welcome.svg',
    imageMaxWidth: '12rem',
    imageRadius: '0.5rem',
  },

  // Optional full-page background (upload via the editor → img:background).
  background: {
    overlayOpacity: 0.5,
  },

  // ---------------------------------------------------------------- messages
  messages: {
    zh: {
      brand: {
        title: '宁波诺丁汉大学 · 录取核验',
        subtitle: '输入姓名与身份证号，核验录取状态后查看迎新内容',
      },
      verify: {
        heading: '录取状态核验',
        subheading: '请填写以下信息，系统将通过官方接口实时校验录取状态。',
        nameLabel: '姓名',
        namePlaceholder: '请输入姓名',
        idLabel: '身份证号',
        idPlaceholder: '18 位身份证号（末位可为 X）',
        submit: '立即查询',
        submitting: '正在查询…',
        hint: '查询需要完成官方滑块验证码，可能需要数秒。',
      },
      errors: {
        emptyName: '请输入姓名',
        badIdFormat: '身份证号格式不正确（应为 18 位，末位可为 X）',
        notAdmitted: '未查询到录取信息，可能是未录取或信息不匹配',
        captcha: '验证码校验未通过，请重试',
        network: '网络请求失败，请检查 CORS 代理配置或稍后重试',
        generic: '查询失败，请稍后重试',
      },
      admission: {
        title: '录取信息',
        name: '姓名',
        university: '院校',
        date: '日期',
        detail: '详情',
      },
      welcome: {
        badge: '录取核验通过',
        title: '欢迎加入 UNNC！',
        imageAlt: '迎新插画',
        // Full markdown supported. Bare URLs / emails are auto-linked.
        body: [
          '# 欢迎来到宁波诺丁汉大学',
          '',
          '亲爱的同学，祝贺你成为我们的一员，期待在校园里与你相遇！',
          '',
          '## 下一步',
          '',
          '- 加入官方迎新群：freshmen@unnc.example',
          '- 访问学校官网：https://www.nottingham.edu.cn',
          '- 关注报到时间与材料清单',
          '',
          '> 如有任何疑问，请联系迎新志愿者，我们会第一时间为你解答。',
          '',
          '---',
          '',
          '`温馨提示：` 本页面链接与邮箱均可直接点击跳转。',
        ].join('\n'),
        back: '再次查询',
      },
      theme: { toggle: '切换主题' },
      lang: { label: '语言' },
      footer: '仅供录取状态核验演示使用，请合法合规使用本工具，勿批量请求。',
    },

    en: {
      brand: {
        title: 'UNNC · Admission Verifier',
        subtitle: 'Enter your name and ID number to check admission status',
      },
      verify: {
        heading: 'Admission Status Verification',
        subheading: 'Fill in the form below. We verify your admission status live via the official portal.',
        nameLabel: 'Name',
        namePlaceholder: 'Enter your name',
        idLabel: 'ID Number',
        idPlaceholder: '18-digit ID number (last may be X)',
        submit: 'Check Now',
        submitting: 'Checking…',
        hint: 'The query solves the official slider captcha and may take a few seconds.',
      },
      errors: {
        emptyName: 'Please enter your name',
        badIdFormat: 'Invalid ID format (18 digits, last may be X)',
        notAdmitted: 'No admission record found — not admitted or details do not match',
        captcha: 'Captcha verification failed, please try again',
        network: 'Network request failed — check the CORS proxy or retry',
        generic: 'Query failed, please try again later',
      },
      admission: {
        title: 'Admission Details',
        name: 'Name',
        university: 'University',
        date: 'Date',
        detail: 'Details',
      },
      welcome: {
        badge: 'Admission Verified',
        title: 'Welcome to UNNC!',
        imageAlt: 'Welcome illustration',
        body: [
          '# Welcome to the University of Nottingham Ningbo China',
          '',
          'Congratulations on joining our community — we cannot wait to meet you on campus!',
          '',
          '## Next steps',
          '',
          '- Join the official welcome group: freshmen@unnc.example',
          '- Visit our website: https://www.nottingham.edu.cn',
          '- Check your registration date and document checklist',
          '',
          '> Questions? Reach out to a welcome volunteer and we will help right away.',
          '',
          '---',
          '',
          '`Tip:` every link and email on this page is clickable.',
        ].join('\n'),
        back: 'Check another',
      },
      theme: { toggle: 'Toggle theme' },
      lang: { label: 'Language' },
      footer: 'For admission verification demo only. Please use responsibly — do not bulk-query.',
    },
  },
}

export default config
