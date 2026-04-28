// ===== БАЗА ТОВАРОВ =====
// Товары хранятся в localStorage.
// Товары с price: 0 — бесплатные (тестовые), выдаются сразу без оплаты.

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Discord Nitro Basic",
    desc: "1 месяц Discord Nitro Basic — кастомный эмодзи, аватар, стикеры и больше.",
    price: 199,
    img: "",
    emoji: "💎",
    category: "Nitro",
    badge: "Хит"
  },
  {
    id: 2,
    name: "Discord Nitro Full",
    desc: "1 месяц полного Discord Nitro — 2 буста, HD видео, большие файлы и всё остальное.",
    price: 499,
    img: "",
    emoji: "🚀",
    category: "Nitro",
    badge: "Популярное"
  },
  {
    id: 3,
    name: "Буст сервера x1",
    desc: "1 буст для твоего Discord сервера. Улучшает качество звука, видео и открывает новые функции.",
    price: 149,
    img: "",
    emoji: "⚡",
    category: "Буст",
    badge: ""
  },
  {
    id: 4,
    name: "Буст сервера x2",
    desc: "2 буста для сервера — достигни уровня 1 и разблокируй дополнительные возможности.",
    price: 279,
    img: "",
    emoji: "🔥",
    category: "Буст",
    badge: "Выгодно"
  },
  {
    id: 5,
    name: "VIP Роль",
    desc: "Эксклюзивная VIP роль на нашем сервере с доступом к закрытым каналам и привилегиями.",
    price: 99,
    img: "",
    emoji: "👑",
    category: "Роль",
    badge: ""
  },
  {
    id: 6,
    name: "Discord Nitro 3 месяца",
    desc: "3 месяца полного Discord Nitro — лучшая цена за длительный период.",
    price: 1299,
    img: "",
    emoji: "🌟",
    category: "Nitro",
    badge: "Скидка"
  },
  {
    id: 7,
    name: "🧪 Тестовая роль (БЕСПЛАТНО)",
    desc: "Бесплатная тестовая роль — проверь как работает выдача. Выдаётся мгновенно ботом.",
    price: 0,
    img: "",
    emoji: "🧪",
    category: "Тест",
    badge: "Бесплатно"
  },
  {
    id: 8,
    name: "🎨 Кастомная роль",
    desc: "Создай свою уникальную роль с любым названием и цветом. Бот создаст её на сервере автоматически!",
    price: 149,
    img: "",
    emoji: "🎨",
    category: "Роль",
    badge: "Новинка",
    customRole: true
  }
];
