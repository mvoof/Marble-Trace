// Marble Trace landing — translations.
// To add a language: add a top-level key (e.g. "de") mirroring the "en"
// structure, then add a button in the .langSwitch group in index.html.
export const I18N = {
  en: {
    skip: 'Skip to content',
    'nav.features': 'Features',
    'nav.widgets': 'Widgets',
    'nav.faq': 'FAQ',
    'nav.download': 'Download',
    'hero.kicker': 'Open-source iRacing overlay',
    'hero.title': 'Telemetry that looks as good as your driving',
    'hero.sub':
      'Marble Trace is a free, lightweight overlay for iRacing. A tiny Rust core reads telemetry straight from the sim — beautiful widgets float above it, costing you almost no FPS.',
    'hero.download': 'Download for Windows',
    'hero.note': 'Free forever · MIT licensed · Windows · iRacing',
    'stats.widgets': 'customizable widgets',
    'stats.rate': 'live telemetry rate',
    'stats.price': 'now and forever',
    'stats.license': 'open-source license',
    'features.title': 'Built to disappear into your sim',
    'features.sub':
      'Everything a paid overlay does — without the subscription, the bloat, or the FPS tax.',
    'features.light.title': 'Featherweight by design',
    'features.light.text':
      'A native Rust backend and Tauri shell instead of a bundled browser app. Marble Trace sips CPU and RAM, so every frame stays with the sim.',
    'features.free.title': 'Free. Actually free.',
    'features.free.text':
      'No subscription, no locked widgets, no trial. MIT licensed and developed in the open — extend it, theme it, submit a PR.',
    'features.modular.title': 'Fully modular',
    'features.modular.text':
      'Enable only what you need. Every widget can be dragged anywhere, scaled, restyled and tuned — from data columns to opacity.',
    'features.live.title': 'Real-time telemetry',
    'features.live.text':
      'Up to 60 Hz data straight from the iRacing SDK: inputs, deltas, fuel math, proximity, standings — with zero perceptible lag.',
    'features.updates.title': 'Always improving',
    'features.updates.text':
      'Auto-updates deliver new widgets and fixes regularly. The roadmap is public and the community votes with issues and PRs.',
    'features.privacy.title': 'Private by default',
    'features.privacy.text':
      'No accounts, no personal data collection. Only anonymous usage events through an open-source, privacy-first analytics platform.',
    'howto.title': 'On track in under a minute',
    'howto.s1.title': 'Download & install',
    'howto.s1.text':
      "Grab the installer from GitHub Releases. No account, no sign-up — run it and you're done.",
    'howto.s2.title': 'Pick your widgets',
    'howto.s2.text':
      'Toggle the widgets you want, drag them anywhere on screen, scale and style them to match your setup.',
    'howto.s3.title': 'Launch iRacing & drive',
    'howto.s3.text':
      'Marble Trace detects the sim automatically and your telemetry appears instantly. Focus on the racing.',
    'gallery.title': 'The widget grid',
    'gallery.sub':
      'Seventeen-plus widgets, each on its own pad. Click any of them to take a closer look.',
    'faq.title': 'Questions, answered',
    'faq.q1': 'Is Marble Trace really free?',
    'faq.a1':
      "Yes. It's MIT-licensed open source. Every widget and every feature is free — no subscription, no trial, no locked content. If it helps your racing, a GitHub star is all we ask.",
    'faq.q2': 'Will it affect my FPS?',
    'faq.a2':
      'Barely. The backend is native Rust reading iRacing shared memory directly, and the UI is a single lightweight transparent window. Saving your resources is the whole point of the architecture.',
    'faq.q3': 'Which sims are supported?',
    'faq.a3':
      'iRacing today. The telemetry layer is multi-sim by design, so more simulators can be added in the future.',
    'faq.q4': 'Is it allowed by iRacing?',
    'faq.a4':
      'Yes. Marble Trace only reads the official telemetry iRacing publishes for third-party apps — the same data every overlay and pit tool uses.',
    'download.title': 'Ready for the grid?',
    'download.text':
      'Grab the latest release, launch iRacing, and your telemetry is on screen in under a minute. Auto-updates keep you current.',
    'download.discord': 'Join the Discord',
    'footer.license': 'MIT License',
    'footer.releases': 'Releases',
    widgets: {
      standings: [
        'Standings',
        'Race table with deltas, gaps and multi-class support',
      ],
      relative: ['Relative', 'F3-style timing with closing-speed trends'],
      trackmap: ['Track Map', 'Live SVG map with car positions and sectors'],
      speed: ['Speed & RPM', 'Gear, RPM ring, shift flash and tire temps'],
      inputs: ['Input Trace', 'Rolling throttle, brake and clutch history'],
      fuel: ['Fuel', 'Consumption graph and pit-stop math'],
      delta: ['Delta HUD', 'Live delta against any reference lap'],
      radar: ['Proximity Radar', '360° awareness with bumper gaps'],
      radarbar: ['Radar Bar', 'Edge indicators for side-by-side racing'],
      chassis: ['Chassis', 'Brake temps and suspension data'],
      sectors: ['Sector Matrix', 'Per-sector times and predicted finish'],
      laplog: ['Lap Log', 'Rolling lap history with delta column'],
      timer: ['Timer', 'Session clock and laps to go'],
      weather: ['Weather', 'Live conditions and dynamic forecast'],
      flags: ['Flags LED', 'Matrix-style flag indicator'],
      flatflags: ['Flags Flat', 'Pill-style flag indicator'],
      linearmap: ['Relative Map', 'One-dimensional relative track position'],
      gmeter: ['G-Meter', 'Lateral and longitudinal friction circle'],
      standingsgroup: [
        'Standings — multi-class',
        'Grouped view for multi-class races',
      ],
      fuelsmall: ['Fuel — compact', 'Minimal fuel readout'],
    },
  },
  ru: {
    skip: 'Перейти к содержимому',
    'nav.features': 'Возможности',
    'nav.widgets': 'Виджеты',
    'nav.faq': 'FAQ',
    'nav.download': 'Скачать',
    'hero.kicker': 'Open-source оверлей для iRacing',
    'hero.title': 'Телеметрия, которая выглядит так же хорошо, как ваш пилотаж',
    'hero.sub':
      'Marble Trace — бесплатный лёгкий оверлей для iRacing. Компактное ядро на Rust читает телеметрию напрямую из симулятора, а красивые виджеты почти не отнимают FPS.',
    'hero.download': 'Скачать для Windows',
    'hero.note': 'Бесплатно навсегда · Лицензия MIT · Windows · iRacing',
    'stats.widgets': 'настраиваемых виджетов',
    'stats.rate': 'частота телеметрии',
    'stats.price': 'сейчас и навсегда',
    'stats.license': 'открытая лицензия',
    'features.title': 'Создан, чтобы раствориться в симуляторе',
    'features.sub':
      'Всё, что умеют платные оверлеи, — без подписки, лишнего веса и налога на FPS.',
    'features.light.title': 'Лёгкий по определению',
    'features.light.text':
      'Нативный бэкенд на Rust и оболочка Tauri вместо встроенного браузера. Marble Trace почти не тратит CPU и память — каждый кадр остаётся симулятору.',
    'features.free.title': 'Бесплатный. По-настоящему.',
    'features.free.text':
      'Без подписок, платных виджетов и триалов. Лицензия MIT, открытая разработка — расширяйте, меняйте темы, присылайте PR.',
    'features.modular.title': 'Полностью модульный',
    'features.modular.text':
      'Включайте только нужное. Любой виджет можно перетащить, масштабировать и настроить — от колонок данных до прозрачности.',
    'features.live.title': 'Телеметрия в реальном времени',
    'features.live.text':
      'Данные до 60 Гц напрямую из iRacing SDK: педали, дельты, расчёт топлива, радар, положение в гонке — без заметной задержки.',
    'features.updates.title': 'Постоянно развивается',
    'features.updates.text':
      'Автообновления регулярно приносят новые виджеты и исправления. Роадмап открыт, а сообщество голосует ишью и пул-реквестами.',
    'features.privacy.title': 'Приватность по умолчанию',
    'features.privacy.text':
      'Без аккаунтов и сбора личных данных. Только анонимные события через открытую privacy-first аналитику.',
    'howto.title': 'На трассе меньше чем за минуту',
    'howto.s1.title': 'Скачайте и установите',
    'howto.s1.text':
      'Возьмите установщик из GitHub Releases. Без аккаунта и регистрации — запустили и готово.',
    'howto.s2.title': 'Выберите виджеты',
    'howto.s2.text':
      'Включите нужные виджеты, перетащите их в любое место экрана, настройте масштаб и стиль под свой сетап.',
    'howto.s3.title': 'Запустите iRacing и поезжайте',
    'howto.s3.text':
      'Marble Trace сам обнаружит симулятор, и телеметрия появится мгновенно. Сосредоточьтесь на гонке.',
    'gallery.title': 'Сетка виджетов',
    'gallery.sub':
      'Больше семнадцати виджетов, каждый на своей подложке. Нажмите на любой, чтобы рассмотреть ближе.',
    'faq.title': 'Ответы на вопросы',
    'faq.q1': 'Marble Trace действительно бесплатный?',
    'faq.a1':
      'Да. Это open source под лицензией MIT. Все виджеты и функции бесплатны — без подписки, триала и закрытого контента. Если оверлей помогает в гонках, звезда на GitHub — всё, о чём мы просим.',
    'faq.q2': 'Повлияет ли он на FPS?',
    'faq.a2':
      'Едва заметно. Бэкенд — нативный Rust, читающий разделяемую память iRacing напрямую, а интерфейс — одно лёгкое прозрачное окно. Экономия ресурсов — суть всей архитектуры.',
    'faq.q3': 'Какие симуляторы поддерживаются?',
    'faq.a3':
      'Сегодня — iRacing. Слой телеметрии изначально мультисимный, так что в будущем возможна поддержка других симуляторов.',
    'faq.q4': 'Разрешено ли это правилами iRacing?',
    'faq.a4':
      'Да. Marble Trace читает только официальную телеметрию, которую iRacing публикует для сторонних приложений, — те же данные, что использует любой оверлей.',
    'download.title': 'Готовы к старту?',
    'download.text':
      'Скачайте последний релиз, запустите iRacing — и телеметрия на экране меньше чем за минуту. Автообновления держат вас в актуальной версии.',
    'download.discord': 'Присоединиться к Discord',
    'footer.license': 'Лицензия MIT',
    'footer.releases': 'Релизы',
    widgets: {
      standings: [
        'Положение в гонке',
        'Таблица гонки с дельтами и мультиклассом',
      ],
      relative: ['Relative', 'Тайминг в стиле F3 с трендами сближения'],
      trackmap: [
        'Карта трассы',
        'Живая SVG-карта с позициями машин и секторами',
      ],
      speed: [
        'Скорость и обороты',
        'Передача, кольцо оборотов, шифт-фляш и температура шин',
      ],
      inputs: ['График педалей', 'История газа, тормоза и сцепления'],
      fuel: ['Топливо', 'График расхода и расчёт пит-стопа'],
      delta: ['Дельта', 'Живая дельта к любому эталонному кругу'],
      radar: ['Радар', 'Обзор 360° и дистанции до соперников'],
      radarbar: [
        'Радар-бар',
        'Индикаторы по краям экрана для борьбы борт к борту',
      ],
      chassis: ['Шасси', 'Температура тормозов и данные подвески'],
      sectors: ['Матрица секторов', 'Время по секторам и прогноз круга'],
      laplog: ['Журнал кругов', 'История кругов с колонкой дельты'],
      timer: ['Таймер', 'Часы сессии и круги до финиша'],
      weather: ['Погода', 'Текущие условия и динамический прогноз'],
      flags: ['Флаги LED', 'Индикатор флагов в стиле матрицы'],
      flatflags: ['Флаги Flat', 'Плоский индикатор флагов'],
      linearmap: [
        'Линейная карта',
        'Одномерная относительная позиция на трассе',
      ],
      gmeter: ['G-метр', 'Круг сцепления: боковые и продольные перегрузки'],
      standingsgroup: [
        'Мультикласс',
        'Сгруппированный вид для мультиклассовых гонок',
      ],
      fuelsmall: ['Топливо — компакт', 'Минимальный вид расхода топлива'],
    },
  },
};
