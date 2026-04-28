
// ===== ПАТИ УЗУМАТИ — app.js (бэкенд версия) =====
// Все данные хранятся на сервере (Replit), а не в браузере.
// Покупатели видят одинаковые товары. Только ты можешь менять их через админку.

// ── URL твоего бота на Replit ──
// Замени на свой URL из Replit!
const API_URL = "https://e75b3232-32bc-4b97-839f-2abc13af7572-00-d8vjs2f2sc47.sisko.replit.dev";
const API_SECRET = "supersecret123"; // должен совпадать с API_SECRET в Replit Secrets

let adminSession = localStorage.getItem("pu_admin_session") || "";

let SETTINGS = { yoomoney: "", telegram: "", discord: "", saleText: "", saleShow: 1 };
let cart = [];
let products = [];
let orders = [];
let promos = [];
let reviews = [];
let activePromo = null;
let selectedStars = 5;
let activeFilter = "all";

// ── Вспомогательная функция для запросов к серверу ──
async function api(path, options = {}) {
  if (!API_URL) return null;
  try {
    const res = await fetch(API_URL + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Secret": API_SECRET,
        "X-Session": adminSession,
        ...(options.headers || {})
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("API недоступен:", e);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadAll();
  renderProducts();
  renderFilters();
  renderCart();
  renderReviews();
  applyContactLinks();
  applySaleBanner();
  bindEvents();
  startFakeOnline();
  startBuyPopups();
  startSaleTimer();
  checkAdminUrl();
});

// ===== ЗАГРУЗКА ДАННЫХ С СЕРВЕРА =====
async function loadAll() {
  // Загружаем настройки с сервера
  const serverSettings = await api("/settings");
  if (serverSettings) {
    SETTINGS = { ...SETTINGS, ...serverSettings };
  } else {
    // Если сервер недоступен — берём из localStorage как запасной вариант
    const s = localStorage.getItem("pu_settings");
    if (s) SETTINGS = { ...SETTINGS, ...JSON.parse(s) };
  }

  // Загружаем товары с сервера
  const serverProducts = await api("/products");
  if (serverProducts && serverProducts.length > 0) {
    products = serverProducts;
  } else {
    // Запасной вариант — стартовые товары из products.js
    products = [...DEFAULT_PRODUCTS];
  }

  // Отзывы пока в localStorage (можно добавить на сервер позже)
  const rv = localStorage.getItem("pu_reviews");
  reviews = rv ? JSON.parse(rv) : DEFAULT_REVIEWS;
}

function saveReviews() { localStorage.setItem("pu_reviews", JSON.stringify(reviews)); }

function getAdminPass() { return ""; } // Пароль проверяется на сервере

// ===== КОНТАКТЫ / БАННЕР =====
function applyContactLinks() {
  const tg = SETTINGS.telegram, dc = SETTINGS.discord;
  const tgEl = document.getElementById("tgLink"), dcEl = document.getElementById("dcLink");
  if (tgEl && tg) tgEl.href = tg.startsWith("http") ? tg : "https://t.me/" + tg.replace("@","");
  if (dcEl && dc) dcEl.href = dc;
}
function applySaleBanner() {
  const b = document.getElementById("saleBanner");
  if (!b) return;
  if (!SETTINGS.saleShow || SETTINGS.saleShow == 0) { b.style.display = "none"; return; }
  b.style.display = "";
  const txt = b.querySelector(".sale-banner__text");
  if (txt && SETTINGS.saleText) txt.innerHTML = SETTINGS.saleText;
}

// ===== ТАЙМЕР СКИДКИ =====
function startSaleTimer() {
  const key = "pu_sale_end";
  let end = parseInt(localStorage.getItem(key) || "0");
  const now = Date.now();
  if (!end || end < now) {
    end = now + (Math.floor(Math.random() * 6) + 4) * 3600 * 1000;
    localStorage.setItem(key, end);
  }
  function tick() {
    const left = end - Date.now();
    if (left <= 0) { localStorage.removeItem(key); return; }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const pad = n => String(n).padStart(2,"0");
    const hEl = document.getElementById("timerH");
    const mEl = document.getElementById("timerM");
    const sEl = document.getElementById("timerS");
    if (hEl) hEl.textContent = pad(h);
    if (mEl) mEl.textContent = pad(m);
    if (sEl) sEl.textContent = pad(s);
  }
  tick();
  setInterval(tick, 1000);
}

// ===== ФЕЙКОВЫЙ ОНЛАЙН =====
function startFakeOnline() {
  const el = document.getElementById("statOnline");
  if (!el) return;
  function update() { el.textContent = Math.floor(Math.random() * 15) + 5; }
  update();
  setInterval(update, 8000);
}

// ===== ВСПЛЫВАШКА "КТО-ТО КУПИЛ" =====
const FAKE_BUYERS = ["Artem_K","Shadow99","NightWolf","xXDarkXx","Pixel_","Vanya2k","Frost_","Uzumaki_","Kira_","Blaze_"];
function startBuyPopups() {
  if (products.length === 0) return;
  setTimeout(showBuyPopup, 8000);
  setInterval(showBuyPopup, 25000);
}
function showBuyPopup() {
  if (products.length === 0) return;
  const p = products[Math.floor(Math.random() * products.length)];
  const name = FAKE_BUYERS[Math.floor(Math.random() * FAKE_BUYERS.length)];
  const pop = document.getElementById("popupBuy");
  if (!pop) return;
  const nameEl = document.getElementById("popupName");
  const prodEl = document.getElementById("popupProduct");
  const avatarEl = document.getElementById("popupAvatar");
  if (nameEl) nameEl.textContent = name;
  if (prodEl) prodEl.textContent = p.name;
  if (avatarEl) avatarEl.textContent = p.emoji || "👤";
  pop.classList.add("show");
  setTimeout(() => pop.classList.remove("show"), 4000);
}

// ===== ФИЛЬТРЫ =====
function renderFilters() {
  const bar = document.getElementById("shopFilters");
  if (!bar) return;
  const cats = ["all", ...new Set(products.map(p => p.category).filter(Boolean))];
  bar.innerHTML = cats.map(c =>
    `<button class="filter-btn${c === activeFilter ? " active" : ""}" data-cat="${esc(c)}">${c === "all" ? "Все" : esc(c)}</button>`
  ).join("");
  bar.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.cat;
      renderFilters();
      renderProducts();
    });
  });
}

// ===== ПРОМОКОДЫ =====
async function applyPromo() {
  const code = document.getElementById("promoInput").value.trim().toUpperCase();
  const statusEl = document.getElementById("promoStatus");

  // Проверяем промокод на сервере
  const result = await api(`/promo?code=${encodeURIComponent(code)}`);
  if (!result) {
    if (statusEl) { statusEl.textContent = "❌ Промокод не найден"; statusEl.className = "promo-status promo-status--err"; }
    activePromo = null;
  } else {
    activePromo = { code, discount: result.discount };
    if (statusEl) { statusEl.textContent = `✅ Скидка ${result.discount}% применена!`; statusEl.className = "promo-status promo-status--ok"; }
    showToast(`🎉 Промокод ${code} — скидка ${result.discount}%!`, "success");
  }
  renderCart();
}

function getDiscountedTotal(raw) {
  if (!activePromo) return raw;
  return Math.round(raw * (1 - activePromo.discount / 100));
}

// ===== РЕНДЕР ТОВАРОВ =====
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  let list = activeFilter === "all" ? products : products.filter(p => p.category === activeFilter);
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📦</div><p class="empty-state__text">Товаров в этой категории нет</p></div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const isFree = p.price === 0;
    const disc = (!isFree && activePromo) ? Math.round(p.price * (1 - activePromo.discount / 100)) : null;
    return `
    <div class="product-card${isFree ? " product-card--free" : ""}" data-id="${p.id}">
      ${p.badge ? `<div class="product-card__badge${isFree ? " product-card__badge--free" : ""}">${esc(p.badge)}</div>` : ""}
      <div class="product-card__img-wrap">
        ${p.img
          ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" class="product-card__img" onerror="this.parentElement.innerHTML='<span class=\\'product-card__emoji\\'>${esc(p.emoji||"📦")}</span>'" />`
          : `<span class="product-card__emoji">${esc(p.emoji || "📦")}</span>`}
      </div>
      <div class="product-card__body">
        ${p.category ? `<div class="product-card__category">${esc(p.category)}</div>` : ""}
        <div class="product-card__name">${esc(p.name)}</div>
        <div class="product-card__desc">${esc(p.desc)}</div>
        <div class="product-card__footer">
          <div class="product-card__price-wrap">
            ${isFree
              ? `<div class="product-card__price product-card__price--free">БЕСПЛАТНО</div>`
              : disc
                ? `<div class="product-card__price product-card__price--old">${p.price} ₽</div>
                   <div class="product-card__price product-card__price--new">${disc} ₽</div>`
                : `<div class="product-card__price">${p.price} ₽</div>`}
          </div>
          <button class="product-card__btn${isFree ? " product-card__btn--free" : ""}" onclick="${p.customRole ? `openCustomRoleModal(${p.id})` : `addToCart(${p.id}, this)`}">${isFree ? "Получить" : p.customRole ? "🎨 Настроить" : "В корзину"}</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ===== КОРЗИНА =====
function addToCart(id, btn) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const ex = cart.find(x => x.id === id);
  if (ex) ex.qty++;
  else cart.push({ ...p, qty: 1 });
  renderCart();
  showToast(`${p.emoji || "✅"} ${p.name} добавлен в корзину`, "success");
  if (btn) {
    btn.textContent = "Добавлено ✓";
    btn.classList.add("added");
    setTimeout(() => { btn.textContent = "В корзину"; btn.classList.remove("added"); }, 1500);
  }
}
function removeFromCart(id) { cart = cart.filter(x => x.id !== id); renderCart(); }
function changeQty(id, d) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty += d;
  if (item.qty <= 0) removeFromCart(id);
  else renderCart();
}
function getRawTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function getFinalTotal() { return getDiscountedTotal(getRawTotal()); }

function renderCart() {
  const countEl = document.getElementById("cartCount");
  const itemsEl = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");
  const totalEl = document.getElementById("cartTotal");
  const promoApplied = document.getElementById("cartPromoApplied");
  const promoName = document.getElementById("cartPromoName");
  const promoVal = document.getElementById("cartPromoVal");
  const qty = cart.reduce((s, i) => s + i.qty, 0);
  if (countEl) countEl.textContent = qty;
  if (!itemsEl) return;
  if (cart.length === 0) {
    itemsEl.innerHTML = `<p class="cart__empty">Корзина пуста</p>`;
    if (footerEl) footerEl.style.display = "none";
    return;
  }
  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item__img">${item.img ? `<img src="${esc(item.img)}" alt="" />` : esc(item.emoji || "📦")}</div>
      <div class="cart-item__info">
        <div class="cart-item__name">${esc(item.name)}${item.customRoleName ? ` <span class="cart-role-tag" style="color:${esc(item.customRoleColor||"#fff")}">${esc(item.customRoleName)}</span>` : ""}</div>
        <div class="cart-item__price">${getDiscountedTotal(item.price * item.qty)} ₽</div>
      </div>
      <div class="cart-item__qty">
        <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
      </div>
    </div>`).join("");
  if (footerEl) footerEl.style.display = "block";
  if (totalEl) totalEl.textContent = getFinalTotal() + " ₽";
  if (promoApplied) {
    if (activePromo) {
      promoApplied.style.display = "block";
      if (promoName) promoName.textContent = activePromo.code;
      if (promoVal) promoVal.textContent = activePromo.discount;
    } else {
      promoApplied.style.display = "none";
    }
  }
}
function openCart() {
  document.getElementById("cartSidebar").classList.add("open");
  document.getElementById("cartOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  document.getElementById("cartSidebar").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("active");
  document.body.style.overflow = "";
}

// ===== ОФОРМЛЕНИЕ / ОПЛАТА =====
function openCheckout() {
  if (cart.length === 0) { showToast("Корзина пуста!", "error"); return; }
  const summaryEl = document.getElementById("orderSummary");
  const totalEl = document.getElementById("modalTotal");
  if (summaryEl) summaryEl.innerHTML = cart.map(i =>
    `<div class="order-summary-item"><span>${esc(i.emoji||"")} ${esc(i.name)} × ${i.qty}</span><span>${getDiscountedTotal(i.price*i.qty)} ₽</span></div>`
  ).join("") + (activePromo ? `<div class="order-summary-item promo-line"><span>🎉 Промокод ${esc(activePromo.code)}</span><span>−${activePromo.discount}%</span></div>` : "");
  if (totalEl) totalEl.textContent = getFinalTotal() + " ₽";
  const note = document.getElementById("modalNote");
  if (note) {
    const tg = SETTINGS.telegram || "";
    const dc = SETTINGS.discord || "";
    let links = [];
    if (tg) links.push(`<a href="${tg.startsWith("http")?tg:"https://t.me/"+tg.replace("@","")}" target="_blank">Telegram</a>`);
    if (dc) links.push(`<a href="${esc(dc)}" target="_blank">Discord</a>`);
    note.innerHTML = links.length ? `После оплаты напиши нам в ${links.join(" или ")} с никнеймом и скриншотом.` : "После оплаты донат будет выдан администратором.";
  }
  document.getElementById("modalOverlay").classList.add("active");
  closeCart();
}
function closeCheckout() { document.getElementById("modalOverlay").classList.remove("active"); }

async function pay() {
  const nick = document.getElementById("discordNick").value.trim();
  const email = document.getElementById("userEmail").value.trim();
  if (!nick) { showToast("Введи Discord никнейм!", "error"); document.getElementById("discordNick").focus(); return; }
  const total = getFinalTotal();
  const isFree = total === 0;

  // Генерируем криптографически случайный токен
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  const order = {
    id: Date.now(), nick, email, token,
    items: cart.map(i => ({
      name: i.name, qty: i.qty, price: i.price, emoji: i.emoji || "📦",
      customRoleName: i.customRoleName || null,
      customRoleColor: i.customRoleColor || null
    })),
    total, promo: activePromo ? activePromo.code : null,
    date: new Date().toLocaleString("ru-RU"),
    status: "pending", free: isFree
  };

  // Отправляем заказ на сервер
  await api("/order", { method: "POST", body: JSON.stringify(order) });

  if (isFree) {
    clearCheckoutForm();
    showSuccessModal(order, true);
    return;
  }

  const wallet = SETTINGS.yoomoney;
  if (wallet) {
    const desc = cart.map(i => `${i.name} x${i.qty}`).join(", ");
    const form = document.createElement("form");
    form.method = "POST"; form.action = "https://yoomoney.ru/quickpay/confirm.xml"; form.target = "_blank";
    const fields = { receiver: wallet, quickpay_form: "shop", targets: `Заказ: ${desc} | Discord: ${nick}`, paymentType: "AC", sum: total, label: `order_${order.id}`, successURL: window.location.href };
    if (email) fields.email = email;
    Object.entries(fields).forEach(([n,v]) => { const inp = document.createElement("input"); inp.type="hidden"; inp.name=n; inp.value=v; form.appendChild(inp); });
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  }

  clearCheckoutForm();
  showSuccessModal(order, false);
  if (wallet) showToast("Переходим к оплате...", "success");
  else {
    const tg = SETTINGS.telegram || "";
    const tgLink = tg ? (tg.startsWith("http") ? tg : "https://t.me/" + tg.replace("@","")) : "";
    if (tgLink) setTimeout(() => window.open(tgLink, "_blank"), 1200);
  }
}

function clearCheckoutForm() {
  cart = []; activePromo = null;
  renderCart(); renderProducts();
  closeCheckout();
  ["discordNick","userEmail","promoInput"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  const ps = document.getElementById("promoStatus"); if(ps) ps.textContent = "";
}

// ===== МОДАЛКА УСПЕШНОГО ЗАКАЗА =====
function showSuccessModal(order, isFree) {
  const idEl    = document.getElementById("successOrderId");
  const idCmdEl = document.getElementById("successOrderIdCmd");
  const noteEl  = document.getElementById("successNote");
  const dcBtn   = document.getElementById("successDcBtn");
  const warnEl  = document.getElementById("successWarn");
  const claimCode = order.token;
  if (idEl)    { idEl.textContent = claimCode; idEl.title = "Нажми чтобы скопировать"; idEl.onclick = () => navigator.clipboard.writeText(claimCode).then(() => showToast("✅ Код скопирован!", "success")); }
  if (idCmdEl) idCmdEl.textContent = claimCode;
  if (warnEl)  warnEl.style.display = "block";
  if (noteEl)  noteEl.textContent = isFree ? "Бесплатный товар — напиши боту /claim и получи роль сразу!" : "После оплаты напиши боту /claim с этим кодом и получи роль автоматически.";
  if (dcBtn) { const dc = SETTINGS.discord || "#"; dcBtn.onclick = () => window.open(dc, "_blank"); dcBtn.style.display = dc === "#" ? "none" : ""; }
  document.getElementById("successOverlay").classList.add("active");
}

// ===== ОТЗЫВЫ =====
const DEFAULT_REVIEWS = [
  { id: 1, nick: "Shadow99",   stars: 5, text: "Всё супер, Nitro выдали за 5 минут! Рекомендую 🔥", date: "12.01.2025", approved: true },
  { id: 2, nick: "NightWolf_", stars: 5, text: "Брал буст сервера, всё чётко и быстро. Буду брать ещё!", date: "18.01.2025", approved: true },
  { id: 3, nick: "Pixel_Art",  stars: 4, text: "Хороший магазин, цены норм. Чуть дольше ждал чем обычно, но всё выдали.", date: "25.01.2025", approved: true },
  { id: 4, nick: "Kira_2025",  stars: 5, text: "Лучший магазин донатов! Уже 3й раз покупаю 💎", date: "02.02.2025", approved: true }
];

function renderReviews() {
  const grid = document.getElementById("reviewsGrid");
  if (!grid) return;
  const approved = reviews.filter(r => r.approved);
  if (approved.length === 0) { grid.innerHTML = `<p style="text-align:center;color:var(--text3)">Отзывов пока нет. Будь первым!</p>`; return; }
  grid.innerHTML = approved.map(r => `
    <div class="review-card">
      <div class="review-card__head">
        <div class="review-card__avatar">${r.nick.charAt(0).toUpperCase()}</div>
        <div><div class="review-card__nick">${esc(r.nick)}</div><div class="review-card__date">${esc(r.date)}</div></div>
        <div class="review-card__stars">${"★".repeat(r.stars)}${"☆".repeat(5-r.stars)}</div>
      </div>
      <p class="review-card__text">${esc(r.text)}</p>
    </div>`).join("");
}

function openReviewModal() {
  selectedStars = 5; renderStarPicker();
  document.getElementById("reviewNick").value = "";
  document.getElementById("reviewText").value = "";
  document.getElementById("reviewOverlay").classList.add("active");
}
function closeReviewModal() { document.getElementById("reviewOverlay").classList.remove("active"); }
function renderStarPicker() { document.querySelectorAll(".star").forEach(s => s.classList.toggle("active", parseInt(s.dataset.v) <= selectedStars)); }
function submitReview() {
  const nick = document.getElementById("reviewNick").value.trim() || "Аноним";
  const text = document.getElementById("reviewText").value.trim();
  if (!text) { showToast("Напиши текст отзыва!", "error"); return; }
  reviews.unshift({ id: Date.now(), nick, stars: selectedStars, text, date: new Date().toLocaleDateString("ru-RU"), approved: true });
  saveReviews(); closeReviewModal(); renderReviews();
  showToast("✅ Отзыв опубликован!", "success");
}

// ===== ВХОД В АДМИНКУ =====
function checkAdminUrl() {
  if (window.location.search.includes("admin")) openLoginModal();
}
function openLoginModal() {
  document.getElementById("loginOverlay").classList.add("active");
  document.getElementById("adminPassInput").value = "";
  document.getElementById("loginError").style.display = "none";
  setTimeout(() => document.getElementById("adminPassInput").focus(), 100);
}
function closeLoginModal() { document.getElementById("loginOverlay").classList.remove("active"); }

async function tryLogin() {
  const val = document.getElementById("adminPassInput").value;
  if (!API_URL) {
    // Если API не настроен — показываем подсказку
    document.getElementById("loginError").textContent = "Сначала настрой URL бота в консоли браузера";
    document.getElementById("loginError").style.display = "block";
    return;
  }
  // Отправляем пароль на сервер — он проверяет и возвращает токен сессии
  try {
    const res = await fetch(API_URL + "/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: val })
    });
    const data = await res.json();
    if (data.ok && data.token) {
      adminSession = data.token;
      localStorage.setItem("pu_admin_session", adminSession);
      closeLoginModal();
      openAdmin();
    } else {
      document.getElementById("loginError").style.display = "block";
      document.getElementById("adminPassInput").value = "";
      document.getElementById("adminPassInput").focus();
    }
  } catch (e) {
    document.getElementById("loginError").textContent = "Сервер недоступен";
    document.getElementById("loginError").style.display = "block";
  }
}

// ===== АДМИН ПАНЕЛЬ =====
async function openAdmin() {
  document.getElementById("adminOverlay").style.display = "flex";
  document.body.style.overflow = "hidden";
  switchTab("products");
  await renderAdminProducts();
  await renderAdminOrders();
  await renderAdminPromos();
  renderAdminReviews();
  await loadAdminSettings();
}
function closeAdmin() { document.getElementById("adminOverlay").style.display = "none"; document.body.style.overflow = ""; }

function switchTab(name) {
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.toggle("active", c.id === "tab-" + name));
}

// ---- Товары ----
async function renderAdminProducts() {
  const list = document.getElementById("adminProductList");
  const cnt = document.getElementById("productsCount");
  // Загружаем товары с сервера
  const serverProducts = await api("/admin/products");
  if (serverProducts) products = serverProducts;
  if (cnt) cnt.textContent = products.length;
  if (!list) return;
  if (products.length === 0) { list.innerHTML = `<p class="admin-hint">Товаров пока нет.</p>`; return; }
  list.innerHTML = products.map(p => `
    <div class="admin-product-item">
      <span class="admin-product-item__emoji">${esc(p.emoji||"📦")}</span>
      <div class="admin-product-item__info">
        <span class="admin-product-item__name">${esc(p.name)}</span>
        ${p.category ? `<span class="admin-product-item__cat">${esc(p.category)}</span>` : ""}
      </div>
      <span class="admin-product-item__price">${p.price} ₽</span>
      <div class="admin-product-item__btns">
        <button class="icon-btn icon-btn--edit" onclick="openEditProduct(${p.id})" title="Редактировать">✏️</button>
        <button class="icon-btn icon-btn--del" onclick="deleteProduct(${p.id})" title="Удалить">🗑</button>
      </div>
    </div>`).join("");
}

async function addProduct() {
  const name = document.getElementById("adminName").value.trim();
  const priceVal = parseFloat(document.getElementById("adminPrice").value);
  if (!name) { showToast("Введи название!", "error"); return; }
  if (isNaN(priceVal) || priceVal < 0) { showToast("Введи корректную цену!", "error"); return; }
  products.push({
    id: Date.now(),
    name,
    desc: document.getElementById("adminDesc").value.trim(),
    price: priceVal,
    img: document.getElementById("adminImg").value.trim(),
    category: document.getElementById("adminCategory").value.trim(),
    emoji: document.getElementById("adminEmoji").value.trim() || "📦",
    badge: document.getElementById("adminBadge").value.trim()
  });
  await api("/admin/products", { method: "POST", body: JSON.stringify(products) });
  renderProducts(); renderFilters(); await renderAdminProducts();
  ["adminName","adminDesc","adminPrice","adminImg","adminCategory","adminEmoji","adminBadge"].forEach(id => { document.getElementById(id).value = ""; });
  showToast(`✅ Товар "${name}" добавлен!`, "success");
}

async function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p || !confirm(`Удалить "${p.name}"?`)) return;
  products = products.filter(x => x.id !== id);
  await api("/admin/products", { method: "POST", body: JSON.stringify(products) });
  renderProducts(); renderFilters(); await renderAdminProducts();
  showToast("Товар удалён", "success");
}

function openEditProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById("editId").value = p.id;
  document.getElementById("editName").value = p.name;
  document.getElementById("editDesc").value = p.desc || "";
  document.getElementById("editPrice").value = p.price;
  document.getElementById("editImg").value = p.img || "";
  document.getElementById("editCategory").value = p.category || "";
  document.getElementById("editEmoji").value = p.emoji || "";
  document.getElementById("editBadge").value = p.badge || "";
  document.getElementById("editOverlay").classList.add("active");
}
function closeEditProduct() { document.getElementById("editOverlay").classList.remove("active"); }
async function saveEditProduct() {
  const id = parseInt(document.getElementById("editId").value);
  const name = document.getElementById("editName").value.trim();
  const priceEdit = parseFloat(document.getElementById("editPrice").value);
  if (!name) { showToast("Введи название!", "error"); return; }
  if (isNaN(priceEdit) || priceEdit < 0) { showToast("Введи корректную цену!", "error"); return; }
  const idx = products.findIndex(x => x.id === id);
  if (idx === -1) return;
  products[idx] = { ...products[idx], name, desc: document.getElementById("editDesc").value.trim(), price: priceEdit, img: document.getElementById("editImg").value.trim(), category: document.getElementById("editCategory").value.trim(), emoji: document.getElementById("editEmoji").value.trim() || "📦", badge: document.getElementById("editBadge").value.trim() };
  await api("/admin/products", { method: "POST", body: JSON.stringify(products) });
  renderProducts(); renderFilters(); await renderAdminProducts(); closeEditProduct();
  showToast("✅ Товар обновлён!", "success");
}

// ---- Заказы ----
async function renderAdminOrders() {
  const list = document.getElementById("ordersList");
  const cnt = document.getElementById("ordersCount");
  const serverOrders = await api("/admin/orders");
  if (serverOrders) orders = serverOrders;
  const pending = orders.filter(o => o.status === "pending").length;
  if (cnt) cnt.textContent = pending + " новых";
  if (!list) return;
  if (orders.length === 0) { list.innerHTML = `<p class="admin-hint">Заказов пока нет.</p>`; return; }
  list.innerHTML = orders.map(o => `
    <div class="order-card ${o.status==="done"?"order-card--done":""}">
      <div class="order-card__head">
        <div class="order-card__user">
          <span class="order-card__nick">🎮 ${esc(o.nick)}</span>
          ${o.email ? `<span class="order-card__email">${esc(o.email)}</span>` : ""}
          ${o.promo ? `<span class="order-card__promo">🎁 ${esc(o.promo)}</span>` : ""}
        </div>
        <div class="order-card__meta">
          <span class="order-card__date">${esc(o.date)}</span>
          <span class="order-card__total">${o.total} ₽</span>
        </div>
      </div>
      <div class="order-card__items">${o.items.map(i => `<span class="order-card__item">${esc(i.emoji)} ${esc(i.name)} × ${i.qty}</span>`).join("")}</div>
      <div class="order-card__actions">
        ${o.status==="pending"
          ? `<button class="btn btn--green btn--sm" onclick="markOrderDone(${o.id})">✅ Выдать</button>`
          : `<span class="order-card__done-label">✅ Выдано</span>`}
        <button class="icon-btn icon-btn--del" onclick="deleteOrder(${o.id})" title="Удалить">🗑</button>
      </div>
    </div>`).join("");
}

async function markOrderDone(id) {
  await api("/admin/orders/update", { method: "POST", body: JSON.stringify({ id, status: "done" }) });
  await renderAdminOrders();
  showToast("✅ Заказ выдан!", "success");
}
async function deleteOrder(id) {
  if (!confirm("Удалить заказ?")) return;
  await api(`/admin/orders/${id}`, { method: "DELETE" });
  await renderAdminOrders();
}
async function clearDoneOrders() {
  const done = orders.filter(o => o.status === "done");
  if (done.length === 0) { showToast("Нет выданных заказов", ""); return; }
  if (!confirm(`Удалить ${done.length} выданных заказов?`)) return;
  for (const o of done) await api(`/admin/orders/${o.id}`, { method: "DELETE" });
  await renderAdminOrders();
  showToast(`Удалено ${done.length} заказов`, "success");
}

// ---- Промокоды ----
async function renderAdminPromos() {
  const list = document.getElementById("promoList");
  const serverPromos = await api("/admin/promos");
  if (serverPromos) promos = serverPromos;
  if (!list) return;
  if (promos.length === 0) { list.innerHTML = `<p class="admin-hint">Промокодов нет.</p>`; return; }
  list.innerHTML = promos.map(p => `
    <div class="admin-product-item">
      <span class="admin-product-item__emoji">🎁</span>
      <div class="admin-product-item__info">
        <span class="admin-product-item__name">${esc(p.code)}</span>
        <span class="admin-product-item__cat">Скидка ${p.discount}%</span>
      </div>
      <button class="icon-btn icon-btn--del" onclick="deletePromo('${esc(p.code)}')" title="Удалить">🗑</button>
    </div>`).join("");
}
async function addPromo() {
  const code = document.getElementById("promoCode").value.trim().toUpperCase();
  const discount = parseInt(document.getElementById("promoDiscount").value);
  if (!code) { showToast("Введи код!", "error"); return; }
  if (!discount || discount < 1 || discount > 99) { showToast("Скидка от 1 до 99%!", "error"); return; }
  if (promos.find(p => p.code === code)) { showToast("Такой код уже есть!", "error"); return; }
  promos.push({ code, discount });
  await api("/admin/promos", { method: "POST", body: JSON.stringify(promos) });
  await renderAdminPromos();
  document.getElementById("promoCode").value = ""; document.getElementById("promoDiscount").value = "";
  showToast(`✅ Промокод ${code} создан!`, "success");
}
async function deletePromo(code) {
  if (!confirm(`Удалить промокод ${code}?`)) return;
  promos = promos.filter(p => p.code !== code);
  await api("/admin/promos", { method: "POST", body: JSON.stringify(promos) });
  await renderAdminPromos();
  showToast("Промокод удалён", "success");
}

// ---- Отзывы ----
function renderAdminReviews() {
  const list = document.getElementById("adminReviewsList");
  const cnt = document.getElementById("reviewsCount");
  if (cnt) cnt.textContent = reviews.length;
  if (!list) return;
  if (reviews.length === 0) { list.innerHTML = `<p class="admin-hint">Отзывов нет.</p>`; return; }
  list.innerHTML = reviews.map(r => `
    <div class="admin-product-item">
      <div class="admin-product-item__info">
        <span class="admin-product-item__name">${esc(r.nick)} ${"★".repeat(r.stars)}</span>
        <span class="admin-product-item__cat">${esc(r.text.substring(0,60))}...</span>
      </div>
      <div class="admin-product-item__btns">
        ${!r.approved ? `<button class="icon-btn icon-btn--edit" onclick="approveReview(${r.id})" title="Одобрить">✅</button>` : `<span style="color:var(--green);font-size:12px">✅</span>`}
        <button class="icon-btn icon-btn--del" onclick="deleteReview(${r.id})" title="Удалить">🗑</button>
      </div>
    </div>`).join("");
}
function approveReview(id) {
  const r = reviews.find(x => x.id === id);
  if (r) { r.approved = true; saveReviews(); renderAdminReviews(); renderReviews(); showToast("Отзыв одобрен!", "success"); }
}
function deleteReview(id) {
  if (!confirm("Удалить отзыв?")) return;
  reviews = reviews.filter(x => x.id !== id);
  saveReviews(); renderAdminReviews(); renderReviews();
  showToast("Отзыв удалён", "success");
}

// ---- Настройки ----
async function loadAdminSettings() {
  const s = await api("/admin/settings");
  if (s) SETTINGS = { ...SETTINGS, ...s };
  document.getElementById("adminYoomoney").value = SETTINGS.yoomoney || "";
  document.getElementById("adminTelegram").value = SETTINGS.telegram || "";
  document.getElementById("adminDiscord").value = SETTINGS.discord || "";
  document.getElementById("adminSaleText").value = SETTINGS.saleText || "";
  document.getElementById("adminSaleDiscount").value = SETTINGS.saleDiscount || 15;
  document.getElementById("adminSaleShow").value = SETTINGS.saleShow !== undefined ? SETTINGS.saleShow : 1;
  document.getElementById("adminNewPass").value = "";
  const botUrlEl = document.getElementById("adminBotApiUrl");
  const botSecretEl = document.getElementById("adminBotApiSecret");
  if (botUrlEl) botUrlEl.value = localStorage.getItem("pu_api_url") || "";
  if (botSecretEl) botSecretEl.value = localStorage.getItem("pu_api_secret") || "";
}

async function saveAdminSettings() {
  SETTINGS.yoomoney = document.getElementById("adminYoomoney").value.trim();
  SETTINGS.telegram = document.getElementById("adminTelegram").value.trim();
  SETTINGS.discord = document.getElementById("adminDiscord").value.trim();
  SETTINGS.saleText = document.getElementById("adminSaleText").value.trim();
  SETTINGS.saleDiscount = parseInt(document.getElementById("adminSaleDiscount").value) || 15;
  SETTINGS.saleShow = parseInt(document.getElementById("adminSaleShow").value);

  // URL и секрет бота сохраняем в localStorage (только у тебя)
  const botUrlEl = document.getElementById("adminBotApiUrl");
  const botSecretEl = document.getElementById("adminBotApiSecret");
  if (botUrlEl) { localStorage.setItem("pu_api_url", botUrlEl.value.trim()); }
  if (botSecretEl) { localStorage.setItem("pu_api_secret", botSecretEl.value.trim()); }

  // Новый пароль — отправляем на сервер
  const np = document.getElementById("adminNewPass").value;
  if (np) {
    await api("/admin/settings", { method: "POST", body: JSON.stringify({ ...SETTINGS, newPassword: np }) });
    showToast("Пароль изменён на сервере!", "success");
  } else {
    await api("/admin/settings", { method: "POST", body: JSON.stringify(SETTINGS) });
  }

  applyContactLinks(); applySaleBanner();
  showToast("✅ Настройки сохранены!", "success");
}

// ===== КАСТОМНАЯ РОЛЬ =====
let selectedRoleColor = "#5865f2";
function openCustomRoleModal(productId) {
  document.getElementById("customRoleProductId").value = productId;
  document.getElementById("customRoleName").value = "";
  selectedRoleColor = "#5865f2";
  updateRolePreview();
  document.getElementById("customRoleOverlay").classList.add("active");
}
function closeCustomRoleModal() { document.getElementById("customRoleOverlay").classList.remove("active"); }
function updateRolePreview() {
  const name = document.getElementById("customRoleName").value || "Моя роль";
  const preview = document.getElementById("rolePreview");
  if (preview) { preview.textContent = name; preview.style.color = selectedRoleColor; preview.style.borderColor = selectedRoleColor; }
  const hexInput = document.getElementById("roleColorHex");
  if (hexInput) hexInput.value = selectedRoleColor;
}
function selectRoleColor(color) {
  selectedRoleColor = color;
  document.querySelectorAll(".color-swatch").forEach(s => s.classList.toggle("active", s.dataset.color === color));
  updateRolePreview();
}
function confirmCustomRole() {
  const productId = parseInt(document.getElementById("customRoleProductId").value);
  const roleName = document.getElementById("customRoleName").value.trim();
  if (!roleName) { showToast("Введи название роли!", "error"); return; }
  if (roleName.length > 32) { showToast("Название не более 32 символов!", "error"); return; }
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(x => x.id === productId);
  if (existing) { existing.customRoleName = roleName; existing.customRoleColor = selectedRoleColor; existing.qty = 1; }
  else cart.push({ ...p, qty: 1, customRoleName: roleName, customRoleColor: selectedRoleColor });
  renderCart();
  closeCustomRoleModal();
  showToast(`🎨 Роль "${roleName}" добавлена в корзину!`, "success");
}

// ===== ЭКСПОРТ/ИМПОРТ =====
async function exportProducts() {
  const prods = await api("/admin/products") || products;
  const blob = new Blob([JSON.stringify(prods, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "products.json"; a.click();
  URL.revokeObjectURL(url);
  showToast("📤 Экспортировано!", "success");
}
function importProducts(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) { showToast("Неверный формат!", "error"); return; }
      products = imported;
      await api("/admin/products", { method: "POST", body: JSON.stringify(products) });
      renderProducts(); renderFilters(); await renderAdminProducts();
      showToast(`✅ Импортировано ${products.length} товаров!`, "success");
    } catch { showToast("Ошибка импорта!", "error"); }
  };
  reader.readAsText(file);
}
async function exportOrders() {
  const ords = await api("/admin/orders") || orders;
  const blob = new Blob([JSON.stringify(ords, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "orders.json"; a.click();
  URL.revokeObjectURL(url);
  showToast("📤 Заказы экспортированы!", "success");
}

// ===== СОБЫТИЯ =====
function bindEvents() {
  // Двойной клик на название — открыть админку
  document.querySelector(".header__logo")?.addEventListener("dblclick", openLoginModal);

  // Корзина
  document.getElementById("cartBtn")?.addEventListener("click", openCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("checkoutBtn")?.addEventListener("click", openCheckout);

  // Оформление заказа
  document.getElementById("modalOverlay")?.addEventListener("click", e => { if (e.target === document.getElementById("modalOverlay")) closeCheckout(); });
  document.getElementById("modalClose")?.addEventListener("click", closeCheckout);
  document.getElementById("payBtn")?.addEventListener("click", pay);

  // Промокод
  document.getElementById("promoApplyBtn")?.addEventListener("click", applyPromo);
  document.getElementById("promoInput")?.addEventListener("keydown", e => { if (e.key === "Enter") applyPromo(); });

  // Успешный заказ
  document.getElementById("successClose")?.addEventListener("click", () => document.getElementById("successOverlay").classList.remove("active"));
  document.getElementById("successOverlay")?.addEventListener("click", e => { if (e.target === document.getElementById("successOverlay")) document.getElementById("successOverlay").classList.remove("active"); });

  // Отзывы
  document.getElementById("reviewBtn")?.addEventListener("click", openReviewModal);
  document.getElementById("reviewClose")?.addEventListener("click", closeReviewModal);
  document.getElementById("reviewOverlay")?.addEventListener("click", e => { if (e.target === document.getElementById("reviewOverlay")) closeReviewModal(); });
  document.getElementById("reviewSubmitBtn")?.addEventListener("click", submitReview);
  document.querySelectorAll(".star").forEach(s => {
    s.addEventListener("click", () => { selectedStars = parseInt(s.dataset.v); renderStarPicker(); });
  });

  // Вход в админку
  document.getElementById("loginClose")?.addEventListener("click", closeLoginModal);
  document.getElementById("loginOverlay")?.addEventListener("click", e => { if (e.target === document.getElementById("loginOverlay")) closeLoginModal(); });
  document.getElementById("loginBtn")?.addEventListener("click", tryLogin);
  document.getElementById("adminPassInput")?.addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });

  // Админ панель
  document.getElementById("adminClose")?.addEventListener("click", closeAdmin);
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
  document.getElementById("adminAddBtn")?.addEventListener("click", addProduct);
  document.getElementById("adminSaveSettings")?.addEventListener("click", saveAdminSettings);
  document.getElementById("exportBtn")?.addEventListener("click", exportProducts);
  document.getElementById("importFile")?.addEventListener("change", e => { importProducts(e.target.files[0]); e.target.value = ""; });
  document.getElementById("exportOrdersBtn")?.addEventListener("click", exportOrders);
  document.getElementById("clearDoneBtn")?.addEventListener("click", clearDoneOrders);
  document.getElementById("addPromoBtn")?.addEventListener("click", addPromo);
  document.getElementById("editClose")?.addEventListener("click", closeEditProduct);
  document.getElementById("editSaveBtn")?.addEventListener("click", saveEditProduct);

  // Кастомная роль
  document.getElementById("customRoleClose")?.addEventListener("click", closeCustomRoleModal);
  document.getElementById("customRoleConfirm")?.addEventListener("click", confirmCustomRole);
  document.getElementById("customRoleName")?.addEventListener("input", updateRolePreview);
  document.getElementById("roleColorHex")?.addEventListener("input", e => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) { selectedRoleColor = val; updateRolePreview(); }
  });
  document.getElementById("roleColorPicker")?.addEventListener("input", e => {
    selectedRoleColor = e.target.value; updateRolePreview();
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
  });
  document.querySelectorAll(".color-swatch").forEach(s => {
    s.addEventListener("click", () => selectRoleColor(s.dataset.color));
  });
}

// ===== ТОСТЫ =====
function showToast(msg, type = "") {
  const container = document.getElementById("toastContainer") || (() => {
    const el = document.createElement("div"); el.id = "toastContainer";
    el.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(el); return el;
  })();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== УТИЛИТЫ =====
function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
