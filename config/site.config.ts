/**
 * ============================================================================
 *  SITE CONFIGURATION — edit this file to rebrand the entire gateway.
 * ============================================================================
 *
 *  Every label, icon, the welcome image, theme radius and the verification
 *  salt live here. The `messages` block is fed directly into vue-i18n, so the
 *  message keys below (e.g. `verify.nameLabel`, `welcome.body`) are exactly the
 *  keys used in the Vue templates via `t('...')`.
 *
 *  To customize:
 *    1. Edit labels/icons below (supports zh + en).
 *    2. Put your students in `config/students.csv` (see students.example.csv).
 *    3. Run `pnpm gen` to regenerate the bundled verifier hashes.
 *    4. Run `pnpm build` for a static site in `dist/`.
 *
 *  NOTE: this module is intentionally runtime-pure (only a type-only import) so
 *  the CLI can load it dynamically under both tsx and Node 24 native TS.
 * ============================================================================
 */
import type { SiteConfig } from '../src/shared/types'

const config: SiteConfig = {
  locales: ['zh', 'en'],
  defaultLocale: 'zh',

  // Mix this into every name|id hash. Change it for your deployment.
  salt: 'unnc-freshmen-verifier-2026-change-me',

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
    imageRounded: true,
  },

  // ---------------------------------------------------------------- messages
  messages: {
    zh: {
      brand: {
        title: '宁波诺定汉大学 · 新生核验',
        subtitle: '输入姓名与身份证号，核验通过后查看专属迎新内容',
      },
      verify: {
        heading: '身份核验',
        subheading: '请填写以下信息，核验通过后即可查看迎新详情。',
        nameLabel: '姓名',
        namePlaceholder: '请输入姓名',
        idLabel: '身份证号',
        idPlaceholder: '18 位身份证号（末位可为 X）',
        submit: '立即核验',
        submitting: '核验中…',
      },
      errors: {
        emptyName: '请输入姓名',
        badIdFormat: '身份证号格式不正确（应为 18 位，末位可为 X）',
        notFound: '未找到匹配的核验信息，请确认输入或联系迎新负责人',
        generic: '核验失败，请稍后重试',
      },
      welcome: {
        badge: '核验通过',
        title: '欢迎加入 UNNC！',
        imageAlt: '迎新插画',
        // Full markdown supported. Bare URLs / emails are auto-linked.
        body: [
          '# 欢迎来到宁波诺定汉大学',
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
        back: '重新核验',
      },
      theme: { toggle: '切换主题' },
      lang: { label: '语言' },
      footer: '仅供迎新核验演示使用，请合法合规使用本工具。',
    },

    en: {
      brand: {
        title: 'UNNC · Freshmen Verifier',
        subtitle: 'Enter your name and ID number to unlock your welcome content',
      },
      verify: {
        heading: 'Identity Verification',
        subheading: 'Fill in the form below. Once verified, your welcome details will appear.',
        nameLabel: 'Name',
        namePlaceholder: 'Enter your name',
        idLabel: 'ID Number',
        idPlaceholder: '18-digit ID number (last may be X)',
        submit: 'Verify Now',
        submitting: 'Verifying…',
      },
      errors: {
        emptyName: 'Please enter your name',
        badIdFormat: 'Invalid ID format (18 digits, last may be X)',
        notFound: 'No matching record. Please check your input or contact the freshmen team',
        generic: 'Verification failed, please try again later',
      },
      welcome: {
        badge: 'Verified',
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
        back: 'Verify another',
      },
      theme: { toggle: 'Toggle theme' },
      lang: { label: 'Language' },
      footer: 'For freshmen verification demo only. Please use responsibly.',
    },
  },
}

export default config
