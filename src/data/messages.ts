import { LangCode, MSG } from './i18n';
import { MessageCategory } from '../types/wish';

export const MESSAGE_CATEGORIES: Array<{
  id: MessageCategory;
  label: string;
  icon: string;
}> = [
  { id: 'Best Wishes', label: 'Best Wishes', icon: '✨' },
  { id: 'Family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'Friends', label: 'Friends', icon: '🥂' },
  { id: 'Love', label: 'Love', icon: '❤️' },
  { id: 'Romantic', label: 'Romantic', icon: '🌹' },
  { id: 'Inspirational', label: 'Inspirational', icon: '🚀' },
];

export interface CategorizedTemplate {
  id: string;
  category: MessageCategory;
  lang: LangCode;
  text: string;
}

export const CATEGORIZED_MESSAGES: CategorizedTemplate[] = [
  // ================= HINDI (hi) =================
  {
    id: 'hi-bw-1',
    category: 'Best Wishes',
    lang: 'hi',
    text: 'प्रिय {to}, नया साल {Y} आपके जीवन में ढेर सारी खुशियाँ, उत्तम स्वास्थ्य और असीम सफलता लेकर आए। {from} की ओर से नव वर्ष की हार्दिक शुभकामनाएं!',
  },
  {
    id: 'hi-bw-2',
    category: 'Best Wishes',
    lang: 'hi',
    text: 'नए साल {Y} की हर सुबह आपके लिए नई उम्मीदें और सुनहरे अवसर लाए। आपका हर सपना सच हो!',
  },
  {
    id: 'hi-fam-1',
    category: 'Family',
    lang: 'hi',
    text: 'प्रिय {to} और पूरे परिवार को {from} की तरफ से नया साल {Y} मुबारक हो! ईश्वर आपके घर को हमेशा प्यार, सुख और समृद्धि से भरा रखे।',
  },
  {
    id: 'hi-fam-2',
    category: 'Family',
    lang: 'hi',
    text: 'परिवार का साथ ही सबसे बड़ा उपहार है। नया साल {Y} हमारे रिश्तों में और मिठास और खुशहाली लेकर आए।',
  },
  {
    id: 'hi-fr-1',
    category: 'Friends',
    lang: 'hi',
    text: 'मेरे सबसे खास दोस्त {to} को नया साल {Y} मुबारक! हमारी दोस्ती नए साल में और भी गहरी और यादगार बने — {from}।',
  },
  {
    id: 'hi-fr-2',
    category: 'Friends',
    lang: 'hi',
    text: 'नया साल, नई पार्टी और वही पुराने यार! {Y} में तुम्हारी हर ख्वाहिश पूरी हो मेरे दोस्त!',
  },
  {
    id: 'hi-lv-1',
    category: 'Love',
    lang: 'hi',
    text: 'प्रिय {to}, आप मेरी ज़िंदगी की सबसे खूबसूरत खुशी हैं। नया साल {Y} हमारे जीवन को अनंत प्रेम और मुस्कान से भर दे। स्नेह सहित, {from}।',
  },
  {
    id: 'hi-rom-1',
    category: 'Romantic',
    lang: 'hi',
    text: 'मेरी जान {to}, तुम्हारे साथ हर पल एक जश्न है। साल {Y} का हर दिन हमारे प्यार को और गहरा बनाए। तुम्हारा/तुम्हारी {from} ❤️',
  },
  {
    id: 'hi-ins-1',
    category: 'Inspirational',
    lang: 'hi',
    text: 'प्रिय {to}, बीता कल एक सीख था और नया साल {Y} एक नया सुनहरा पन्ना है। पूरे आत्मविश्वास के साथ आगे बढ़ें, बड़ी जीत आपकी प्रतीक्षा कर रही है!',
  },

  // ================= ENGLISH (en) =================
  {
    id: 'en-bw-1',
    category: 'Best Wishes',
    lang: 'en',
    text: 'Dear {to}, may {Y} bring you radiant health, endless joy, and extraordinary success. Warmest New Year wishes from {from}!',
  },
  {
    id: 'en-bw-2',
    category: 'Best Wishes',
    lang: 'en',
    text: 'Wishing you 365 days of golden opportunities, bright smiles, and unforgettable memories in {Y}!',
  },
  {
    id: 'en-fam-1',
    category: 'Family',
    lang: 'en',
    text: 'Dear {to} & family, may every day of {Y} be filled with warmth, laughter, harmony, and cherished moments together. With love from {from}.',
  },
  {
    id: 'en-fr-1',
    category: 'Friends',
    lang: 'en',
    text: 'Happy New Year {Y} to an amazing friend, {to}! Here is to more adventures, big wins, and timeless memories ahead — {from}.',
  },
  {
    id: 'en-lv-1',
    category: 'Love',
    lang: 'en',
    text: 'Dearest {to}, you make every season brighter. May {Y} surround you with pure love, peace, and happiness. Always yours, {from}.',
  },
  {
    id: 'en-rom-1',
    category: 'Romantic',
    lang: 'en',
    text: 'My love {to}, every midnight countdown feels magical because I get to share it with you. Happy New Year {Y} from {from} ❤️',
  },
  {
    id: 'en-ins-1',
    category: 'Inspirational',
    lang: 'en',
    text: 'Dear {to}, {Y} is a fresh chapter of 365 blank pages. Dream boldly, trust your journey, and make this your most remarkable year yet! — {from}',
  },

  // ================= BENGALI (bn) =================
  {
    id: 'bn-bw-1',
    category: 'Best Wishes',
    lang: 'bn',
    text: 'প্রিয় {to}, নতুন বছর {Y} আপনার জীবনে নিয়ে আসুক অনাবিল সুখ, সুস্বাস্থ্য আর সাফল্য। {from}-এর পক্ষ থেকে শুভ নববর্ষ!',
  },
  {
    id: 'bn-fam-1',
    category: 'Family',
    lang: 'bn',
    text: 'প্রিয় {to} ও আপনার পরিবারের সবাইকে {from}-এর পক্ষ থেকে নতুন বছর {Y}-এর আন্তরিক শুভেচ্ছা ও ভালোবাসা।',
  },
  {
    id: 'bn-fr-1',
    category: 'Friends',
    lang: 'bn',
    text: 'প্রিয় বন্ধু {to}, নতুন বছর {Y}-এ আমাদের বন্ধুত্ব আরও অটুট হোক এবং তোমার সব স্বপ্ন পূরণ হোক! — {from}',
  },
  {
    id: 'bn-lv-1',
    category: 'Love',
    lang: 'bn',
    text: 'প্রিয়তম {to}, তুমি আমার জীবনের সবচেয়ে সুন্দর উপহার। নতুন বছর {Y} আমাদের ভালোবাসায় ভরে উঠুক। ইতি {from}।',
  },
  {
    id: 'bn-rom-1',
    category: 'Romantic',
    lang: 'bn',
    text: 'আমার প্রিয় {to}, তোমার সাথে প্রতিটি মুহূর্তই উৎসবের মতো। {Y} সালের প্রতিটি দিন আমাদের প্রেমকে আরও মধুর করুক ❤️ — {from}',
  },
  {
    id: 'bn-ins-1',
    category: 'Inspirational',
    lang: 'bn',
    text: 'প্রিয় {to}, নতুন বছর {Y} মানে নতুন স্বপ্ন আর নতুন শুরু। সাহসের সাথে এগিয়ে চলো, সাফল্য তোমারই হবে!',
  },

  // ================= MARATHI (mr) =================
  {
    id: 'mr-bw-1',
    category: 'Best Wishes',
    lang: 'mr',
    text: 'प्रिय {to}, नवीन वर्ष {Y} आपल्या आयुष्यात सुख, समृद्धी, उत्तम आरोग्य आणि भरघोस यश घेऊन येवो. {from} कडून हार्दिक शुभेच्छा!',
  },
  {
    id: 'mr-fam-1',
    category: 'Family',
    lang: 'mr',
    text: 'प्रिय {to} आणि संपूर्ण कुटुंबाला {from} कडून नवीन वर्ष {Y} च्या मनःपूर्वक शुभेच्छा! तुमच्या घरात सदैव आनंद नांदो.',
  },
  {
    id: 'mr-fr-1',
    category: 'Friends',
    lang: 'mr',
    text: 'माझ्या प्रिय मित्रा {to}, नवीन वर्ष {Y} मध्ये आपली मैत्री अशीच बहरत राहो आणि तुझी सर्व स्वप्ने पूर्ण होवोत! — {from}',
  },
  {
    id: 'mr-lv-1',
    category: 'Love',
    lang: 'mr',
    text: 'प्रिय {to}, तुझ्यामुळे माझे आयुष्य सुंदर आहे. नवीन वर्ष {Y} आपल्या नात्यात अजून गोडवा आणि प्रेम घेऊन येवो. — {from}',
  },
  {
    id: 'mr-rom-1',
    category: 'Romantic',
    lang: 'mr',
    text: 'माझ्या आयुष्यातील सर्वात खास व्यक्ती {to}, तुझ्यासोबत प्रत्येक क्षण सोन्यासारखा आहे. हॅपी न्यू इयर {Y} ❤️ — {from}',
  },
  {
    id: 'mr-ins-1',
    category: 'Inspirational',
    lang: 'mr',
    text: 'प्रिय {to}, नवीन वर्ष {Y} हे नवीन संधींचे सोनेरी दार आहे. जिद्दीने पुढे चला, मोठे यश तुमची वाट पाहत आहे!',
  },

  // ================= HINGLISH (hinglish) =================
  {
    id: 'hg-bw-1',
    category: 'Best Wishes',
    lang: 'hinglish',
    text: 'Dear {to}, Naya Saal {Y} aapke liye dher saari khushiyan, achi sehat aur badi kamyabi laaye! Warm wishes from {from}.',
  },
  {
    id: 'hg-fam-1',
    category: 'Family',
    lang: 'hinglish',
    text: 'Dear {to} aur poore parivaar ko {from} ki taraf se Happy New Year {Y}! Aapke ghar mein hamesha pyaar aur barkat bani rahe.',
  },
  {
    id: 'hg-fr-1',
    category: 'Friends',
    lang: 'hinglish',
    text: 'Mere best friend {to} ko Naya Saal {Y} Mubarak! Is saal aur bhi zyada masti, safalta aur yaadgar pal hamare naam hon — {from}.',
  },
  {
    id: 'hg-lv-1',
    category: 'Love',
    lang: 'hinglish',
    text: 'Dearest {to}, aap meri zindagi ki sabse pyari khushi ho. May {Y} fill our lives with endless love and smiles. Yours, {from}.',
  },
  {
    id: 'hg-rom-1',
    category: 'Romantic',
    lang: 'hinglish',
    text: 'Meri jaan {to}, tumhare saath har naya saal ek khubsurat khwab jaisa lagta hai. Happy New Year {Y} my love ❤️ — {from}',
  },
  {
    id: 'hg-ins-1',
    category: 'Inspirational',
    lang: 'hinglish',
    text: 'Dear {to}, Naya Saal {Y} ek nayi shuruaat hai. Apne sapno par bharosa rakho aur rukna mat — yeh saal aapka hai!',
  },

  // ================= URDU (ur) =================
  {
    id: 'ur-bw-1',
    category: 'Best Wishes',
    lang: 'ur',
    text: 'عزیز {to}، نیا سال {Y} آپ کے لیے ڈھیر ساری خوشیاں، اچھی صحت اور عظیم کامیابیاں لائے۔ {from} کی طرف سے نیا سال مبارک ہو!',
  },
  {
    id: 'ur-fam-1',
    category: 'Family',
    lang: 'ur',
    text: 'محترم {to} اور آپ کے پورے خاندان کو {from} کی جانب سے نئے سال {Y} کی دلی مبارکباد۔ اللہ آپ کے گھر کو ہمیشہ خوشیوں سے آباد رکھے۔',
  },
  {
    id: 'ur-fr-1',
    category: 'Friends',
    lang: 'ur',
    text: 'میرے پیارے دوست {to}، نیا سال {Y} ہماری دوستی کو مزید مضبوط اور یادگار بنائے۔ آپ کی ہر خواہش پوری ہو — {from}۔',
  },
  {
    id: 'ur-lv-1',
    category: 'Love',
    lang: 'ur',
    text: 'عزیز از جان {to}، آپ کی موجودگی میری زندگی کی سب سے بڑی خوشی ہے۔ نیا سال {Y} ہماری محبت کو ہمیشہ سلامت رکھے۔ آپ کا {from}۔',
  },
  {
    id: 'ur-rom-1',
    category: 'Romantic',
    lang: 'ur',
    text: 'میری جان {to}، تمہارے ساتھ ہر لمحہ جشن کی طرح ہے۔ سال {Y} کا ہر دن ہمارے پیار کو اور گہرا بنائے ❤️ — {from}',
  },
  {
    id: 'ur-ins-1',
    category: 'Inspirational',
    lang: 'ur',
    text: 'عزیز {to}، نیا سال {Y} نئی امیدوں اور بلند حوصلوں کا سال ہے۔ اپنے خوابوں کی تعبیر کے لیے قدم بڑھائیں، کامیابی آپ کے قدم چومے گی!',
  },
];

/**
 * Formats a greeting message by intelligently substituting {Y}, {to}, {from}, and {n}
 * while handling empty optional names gracefully without awkward blank punctuation.
 */
export function formatPersonalizedMessage(
  rawTemplate: string,
  opts: {
    year: number;
    recipientName?: string;
    senderName?: string;
    defaultSender?: string;
  }
): string {
  const to = (opts.recipientName || '').trim();
  const from = (opts.senderName || '').trim();
  const fallbackSender = opts.defaultSender || 'Your Friend';

  let out = rawTemplate.replace(/\{Y\}/g, String(opts.year));

  if (to) {
    out = out.replace(/\{to\}/g, to);
  } else {
    // Clean up leading "Dear {to}, " or "प्रिय {to}, " when recipientName is empty
    out = out
      .replace(/^(Dear|Dearest|My love)\s+\{to\},\s*/i, '')
      .replace(/^(प्रिय|मेरी जान|मेरे सबसे खास दोस्त)\s+\{to\}\s*(को|,)?\s*/u, '')
      .replace(/^(প্রিয়|প্রিয় বন্ধু|প্রিয়তম|আমার প্রিয়)\s+\{to\}\s*(,|ও)?\s*/u, '')
      .replace(/^(प्रिय|माझ्या प्रिय मित्रा)\s+\{to\}\s*(,|आणि)?\s*/u, '')
      .replace(/^(عزیز از جان|عزیز|محترم|میرے پیارے دوست|میری جان)\s+\{to\}\s*(،)?\s*/u, '')
      .replace(/\{to\}/g, '');
  }

  if (from) {
    out = out.replace(/\{from\}/g, from).replace(/\{n\}/g, from);
  } else {
    out = out
      .replace(/\s*—\s*\{from\}\.?$/u, '')
      .replace(/\{from\}/g, fallbackSender)
      .replace(/\{n\}/g, fallbackSender);
  }

  return out.replace(/\s{2,}/g, ' ').trim();
}

export function getTemplatesForLanguageAndCategory(
  lang: LangCode,
  category: MessageCategory
): CategorizedTemplate[] {
  const exact = CATEGORIZED_MESSAGES.filter(
    (m) => m.lang === lang && m.category === category
  );
  if (exact.length > 0) return exact;

  // Fallback to MSG entries for that language + English templates for that category
  const fromLegacy = MSG.filter((m) => m.lang === lang).map((m) => ({
    id: `legacy-${m.id}`,
    category,
    lang,
    text: m.text,
  }));
  const enCat = CATEGORIZED_MESSAGES.filter(
    (m) => m.lang === 'en' && m.category === category
  );
  return [...fromLegacy, ...enCat];
}
