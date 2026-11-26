export type PageId = 'about' | 'contact' | 'privacy' | 'disclaimer' | 'terms';

export interface StaticPageContent {
  id: PageId;
  title: string;
  titleHi: string;
  sections: Array<{ heading?: string; paragraphs: string[]; bullets?: string[] }>;
}

export const STATIC_PAGES: Record<PageId, StaticPageContent> = {
  about: {
    id: 'about',
    title: 'About Us',
    titleHi: 'हमारे बारे में (About Us)',
    sections: [
      {
        heading: 'Welcome to Indian New Year Wishes 2027',
        paragraphs: [
          'Indian New Year Wishes 2027 is a free digital celebration platform built specifically for Indian families, friends, and communities to create and share personalized 3D Happy New Year 2027 greetings.',
          'Our platform supports 13 major Indian languages—Hindi, English, Hinglish, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, and Assamese—so everyone can send heartfelt New Year blessings in their own mother tongue.',
        ],
      },
      {
        heading: 'What Makes Our Platform Special',
        paragraphs: [
          'Every greeting generated on our website combines real-time HTML5 Canvas particle animations, 3D golden typography, synthesized Web Audio music-box melodies, and an interactive surprise gift-box opening experience.',
        ],
        bullets: [
          '9 interactive festive animations including Sparkler Name, Royal Fireworks, Galaxy Stars, Midnight Countdown, Sky Lanterns, Golden Luxe, Neon City, Magic Gift, and Aurora Snow.',
          '100% free to use with zero registration, zero app downloads, and instant WhatsApp sharing.',
          'Optimized for low-end and high-end Android, iOS, and desktop browsers across India.',
        ],
      },
    ],
  },

  contact: {
    id: 'contact',
    title: 'Contact Us',
    titleHi: 'संपर्क करें (Contact Us)',
    sections: [
      {
        heading: 'Get in Touch With Us',
        paragraphs: [
          'We love hearing from our visitors! Whether you have a suggestion for a new Indian regional greeting message, feedback on our animations, or business/advertising inquiries, feel free to reach out.',
        ],
        bullets: [
          'General Support & Feedback: support@indian-newyear-wishes-2027.com',
          'Language & Content Suggestions: greetings@indian-newyear-wishes-2027.com',
          'Response Time: Within 24–48 business hours (IST / Asia/Kolkata).',
        ],
      },
      {
        heading: 'Report an Issue',
        paragraphs: [
          'If a personalized link or font does not render as expected on your mobile device, please mention your device model, browser version, and selected language so our engineering team can resolve it promptly.',
        ],
      },
    ],
  },

  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    titleHi: 'गोपनीयता नीति (Privacy Policy)',
    sections: [
      {
        heading: '1. Information We Handle',
        paragraphs: [
          'Indian New Year Wishes 2027 is designed with privacy-by-default architecture. We do not require user registration, accounts, or personal contact details to create or view a New Year wish.',
          'When you enter your name to generate a wish, your name is encoded directly into the shareable URL parameters (?n=YourName&a=1&w=1&lang=hi) and optionally saved in your own browser’s localStorage so you do not have to re-type it.',
        ],
      },
      {
        heading: '2. Cookies & Local Storage',
        paragraphs: [
          'We use standard browser localStorage solely to remember your preferred Indian language (wx_lang) and your last entered display name (wx_name) on your own device.',
        ],
      },
      {
        heading: '3. Third-Party Advertising & Google AdSense',
        paragraphs: [
          'We may display third-party advertisements (such as Google AdSense) in designated banner slots. Third-party vendors, including Google, use cookies to serve ads based on a user’s prior visits to this website or other websites.',
          'Users may opt out of personalized advertising by visiting Google Ads Settings (https://adssettings.google.com).',
        ],
      },
    ],
  },

  disclaimer: {
    id: 'disclaimer',
    title: 'Disclaimer',
    titleHi: 'अस्वीकरण (Disclaimer)',
    sections: [
      {
        heading: 'User-Generated Names & Shareable Links',
        paragraphs: [
          'Indian New Year Wishes 2027 allows visitors to type a custom name and select from pre-written festive greeting messages to generate a shareable URL.',
          'Because the sender’s name is stored directly inside the URL query parameter (?n=...), the platform does not pre-screen individual links shared privately via WhatsApp, Telegram, Facebook, or SMS. All user-entered names are automatically sanitized to strip HTML/script tags and prevent cross-site scripting (XSS).',
        ],
      },
      {
        heading: 'No Official Affiliation',
        paragraphs: [
          'This website is an independent festive greeting generator and is not affiliated with WhatsApp Inc., Meta Platforms Inc., Telegram, or X Corp. All trademarks belong to their respective owners.',
        ],
      },
    ],
  },

  terms: {
    id: 'terms',
    title: 'Terms and Conditions',
    titleHi: 'नियम और शर्तें (Terms & Conditions)',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        paragraphs: [
          'By accessing and using Indian New Year Wishes 2027, you agree to use the personalized greeting generator for lawful, friendly, and festive purposes only.',
        ],
      },
      {
        heading: '2. Acceptable Use Policy',
        paragraphs: [
          'You agree not to enter offensive, defamatory, misleading, or unlawful text into the name field when generating shareable wish links. Our system strictly sanitizes input length and strips special code characters.',
        ],
      },
      {
        heading: '3. Intellectual Property',
        paragraphs: [
          'The custom HTML5 Canvas animations, Web Audio synthesized melodies, 3D typography styles, and multilingual greeting collections are provided for personal, non-commercial sharing with friends and family.',
        ],
      },
    ],
  },
};
