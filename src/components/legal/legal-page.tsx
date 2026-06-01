import Link from 'next/link';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

type Locale = 'ru' | 'en' | 'uz';
type Section = { heading: string; body: string[] };
type Doc = { title: string; updated: string; intro: string; sections: Section[] };

// NOTE: These are structured stubs. Replace the [bracketed placeholders] with
// your real company details and have them reviewed by a lawyer before relying
// on them legally.
const COMPANY = '[Benzeen / ООО «___»]';
const EMAIL = '[legal@benzeen.uz]';
const ADDRESS = '[г. Ташкент, ___]';

const PRIVACY: Record<Locale, Doc> = {
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 01.06.2026',
    intro: `Настоящая Политика описывает, как ${COMPANY} («мы») собирает, использует и защищает персональные данные пользователей сервиса Benzeen.`,
    sections: [
      {
        heading: '1. Какие данные мы собираем',
        body: [
          'Контактные данные: имя, номер телефона, адрес электронной почты.',
          'Данные компании и автопарка: название, адрес, транспортные средства, лимиты и заказы.',
          'Технические данные: IP-адрес, тип устройства и браузера, журналы доступа.',
        ],
      },
      {
        heading: '2. Как мы используем данные',
        body: [
          'Для предоставления и поддержки работы сервиса, обработки заказов и доставки.',
          'Для безопасности, предотвращения мошенничества и соблюдения требований закона.',
          'Для связи с вами по поводу вашей учётной записи и заказов.',
        ],
      },
      {
        heading: '3. Передача третьим лицам',
        body: [
          'Мы не продаём ваши данные. Данные могут передаваться поставщикам инфраструктуры (хостинг, мониторинг) исключительно для работы сервиса.',
        ],
      },
      {
        heading: '4. Хранение и защита',
        body: [
          'Данные хранятся столько, сколько необходимо для целей обработки и соблюдения закона. Мы применяем технические и организационные меры защиты.',
        ],
      },
      {
        heading: '5. Ваши права',
        body: [
          `Вы можете запросить доступ, исправление или удаление своих данных, написав на ${EMAIL}.`,
        ],
      },
      {
        heading: '6. Контакты',
        body: [`${COMPANY}, ${ADDRESS}. Эл. почта: ${EMAIL}.`],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 2026-06-01',
    intro: `This Policy describes how ${COMPANY} ("we") collects, uses and protects the personal data of Benzeen users.`,
    sections: [
      {
        heading: '1. Data we collect',
        body: [
          'Contact data: name, phone number, email address.',
          'Company and fleet data: company name, address, vehicles, limits and orders.',
          'Technical data: IP address, device and browser type, access logs.',
        ],
      },
      {
        heading: '2. How we use data',
        body: [
          'To provide and operate the service, process orders and deliveries.',
          'For security, fraud prevention and legal compliance.',
          'To contact you about your account and orders.',
        ],
      },
      {
        heading: '3. Sharing with third parties',
        body: [
          'We do not sell your data. Data may be shared with infrastructure providers (hosting, monitoring) solely to operate the service.',
        ],
      },
      {
        heading: '4. Retention and security',
        body: [
          'We retain data only as long as necessary for processing purposes and legal compliance, and apply technical and organizational safeguards.',
        ],
      },
      {
        heading: '5. Your rights',
        body: [`You may request access, correction or deletion of your data by emailing ${EMAIL}.`],
      },
      { heading: '6. Contact', body: [`${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`] },
    ],
  },
  uz: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish: 01.06.2026',
    intro: `Ushbu siyosat ${COMPANY} («biz») Benzeen foydalanuvchilarining shaxsiy ma'lumotlarini qanday yig'ishi, ishlatishi va himoya qilishini tavsiflaydi.`,
    sections: [
      {
        heading: '1. Qanday ma’lumotlarni yig‘amiz',
        body: [
          'Aloqa ma’lumotlari: ism, telefon raqami, elektron pochta.',
          'Kompaniya va avtopark ma’lumotlari: nomi, manzili, transport vositalari, limitlar va buyurtmalar.',
          'Texnik ma’lumotlar: IP-manzil, qurilma va brauzer turi, kirish jurnallari.',
        ],
      },
      {
        heading: '2. Ma’lumotlardan qanday foydalanamiz',
        body: [
          'Xizmatni taqdim etish, buyurtmalar va yetkazib berishni qayta ishlash uchun.',
          'Xavfsizlik, firibgarlikning oldini olish va qonunga rioya qilish uchun.',
          'Hisobingiz va buyurtmalaringiz bo‘yicha siz bilan bog‘lanish uchun.',
        ],
      },
      {
        heading: '3. Uchinchi shaxslarga uzatish',
        body: [
          'Biz ma’lumotlaringizni sotmaymiz. Ma’lumotlar faqat xizmatni ishlatish uchun infratuzilma provayderlariga (hosting, monitoring) uzatilishi mumkin.',
        ],
      },
      {
        heading: '4. Saqlash va himoya',
        body: [
          'Ma’lumotlar faqat zarur muddat davomida saqlanadi; texnik va tashkiliy himoya choralari qo‘llaniladi.',
        ],
      },
      {
        heading: '5. Sizning huquqlaringiz',
        body: [`${EMAIL} manziliga yozib, ma’lumotlaringizga kirish, tuzatish yoki o‘chirishni so‘rashingiz mumkin.`],
      },
      { heading: '6. Aloqa', body: [`${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`] },
    ],
  },
};

const TERMS: Record<Locale, Doc> = {
  ru: {
    title: 'Условия использования',
    updated: 'Последнее обновление: 01.06.2026',
    intro: `Используя сервис Benzeen, вы соглашаетесь с настоящими Условиями. Оператор сервиса — ${COMPANY}.`,
    sections: [
      {
        heading: '1. Сервис',
        body: ['Benzeen — платформа для управления топливом и доставкой для автопарков.'],
      },
      {
        heading: '2. Учётная запись',
        body: [
          'Вы отвечаете за сохранность данных доступа и за все действия, совершённые под вашей учётной записью.',
        ],
      },
      {
        heading: '3. Допустимое использование',
        body: [
          'Запрещено использовать сервис в незаконных целях, нарушать его работу или получать несанкционированный доступ к данным.',
        ],
      },
      {
        heading: '4. Ответственность',
        body: [
          'Сервис предоставляется «как есть». В пределах, допустимых законом, мы не несём ответственности за косвенные убытки.',
        ],
      },
      {
        heading: '5. Изменения',
        body: ['Мы можем обновлять Условия. Продолжение использования означает согласие с изменениями.'],
      },
      { heading: '6. Контакты', body: [`${COMPANY}, ${ADDRESS}. Эл. почта: ${EMAIL}.`] },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: 2026-06-01',
    intro: `By using Benzeen you agree to these Terms. The service operator is ${COMPANY}.`,
    sections: [
      { heading: '1. The service', body: ['Benzeen is a fuel and delivery management platform for fleets.'] },
      {
        heading: '2. Account',
        body: ['You are responsible for keeping your credentials safe and for all activity under your account.'],
      },
      {
        heading: '3. Acceptable use',
        body: ['You must not use the service for unlawful purposes, disrupt it, or access data without authorization.'],
      },
      {
        heading: '4. Liability',
        body: ['The service is provided "as is". To the extent permitted by law, we are not liable for indirect damages.'],
      },
      {
        heading: '5. Changes',
        body: ['We may update these Terms. Continued use means acceptance of the changes.'],
      },
      { heading: '6. Contact', body: [`${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`] },
    ],
  },
  uz: {
    title: 'Foydalanish shartlari',
    updated: 'Oxirgi yangilanish: 01.06.2026',
    intro: `Benzeen xizmatidan foydalanib, ushbu shartlarga rozilik bildirasiz. Xizmat operatori — ${COMPANY}.`,
    sections: [
      { heading: '1. Xizmat', body: ['Benzeen — avtoparklar uchun yoqilg‘i va yetkazib berishni boshqarish platformasi.'] },
      {
        heading: '2. Hisob',
        body: ['Kirish ma’lumotlaringiz xavfsizligi va hisobingiz ostidagi barcha amallar uchun siz javobgarsiz.'],
      },
      {
        heading: '3. Maqbul foydalanish',
        body: ['Xizmatdan noqonuniy maqsadlarda foydalanish, uning ishini buzish yoki ruxsatsiz kirish taqiqlanadi.'],
      },
      {
        heading: '4. Javobgarlik',
        body: ['Xizmat «boricha» taqdim etiladi. Qonun ruxsat bergan doirada bilvosita zararlar uchun javobgar emasmiz.'],
      },
      {
        heading: '5. O‘zgarishlar',
        body: ['Shartlarni yangilashimiz mumkin. Foydalanishni davom ettirish o‘zgarishlarga rozilik bildiradi.'],
      },
      { heading: '6. Aloqa', body: [`${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`] },
    ],
  },
};

export function LegalPage({
  type,
  locale,
}: {
  type: 'privacy' | 'terms';
  locale: string;
}) {
  const loc: Locale = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru';
  const doc = (type === 'privacy' ? PRIVACY : TERMS)[loc];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href={`/${loc}`}
          className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          ← Benzeen
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {doc.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{doc.updated}</p>
        <p className="mt-6 text-gray-700 dark:text-gray-300">{doc.intro}</p>

        <div className="mt-8 space-y-8">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {s.heading}
              </h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-gray-700 dark:text-gray-300">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
