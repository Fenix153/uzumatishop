"""
╔══════════════════════════════════════════════════════╗
║        ПАТИ УЗУМАТИ — Discord Bot                    ║
║  Автоматическая выдача ролей после заказа с сайта    ║
╚══════════════════════════════════════════════════════╝

КАК РАБОТАЕТ:
  1. Покупатель оформляет заказ на сайте
  2. Пишет боту команду: /claim <ID заказа>
  3. Бот проверяет заказ и выдаёт роль автоматически

КОМАНДЫ БОТА:
  /claim <order_id>  — получить роль по ID заказа
  /orders            — (только для админа) список новых заказов
  /done <order_id>   — (только для админа) отметить заказ выданным
  /addproduct        — (только для админа) добавить товар через бота
"""

import discord
from discord.ext import commands
from discord import app_commands
import json
import os
import asyncio
from datetime import datetime

# ══════════════════════════════════════════
#  НАСТРОЙКИ — ЗАПОЛНИ ЭТО!
# ══════════════════════════════════════════

BOT_TOKEN = "MTQ5ODQwMTcxMTM4MTkzODE5Ng.GsQeXN.zQ4xevOAcehtYAD3buxgI6YvZG-hKcd_Z_A_ag"          # Токен бота из Discord Developer Portal
GUILD_ID   = 123456789012345678             # ID твоего Discord сервера (правой кнопкой на сервер → Копировать ID)
ADMIN_ID   = 123456789012345678             # Твой Discord User ID (правой кнопкой на себя → Копировать ID)
LOG_CHANNEL_ID = 123456789012345678         # ID канала куда бот будет слать уведомления о заказах

# Роли которые бот может выдавать
# Формат: "Название товара на сайте": ID_роли_в_Discord
ROLE_MAP = {
    "VIP Роль":              987654321098765432,   # замени на реальный ID роли
    "Discord Nitro Basic":   987654321098765433,
    "Discord Nitro Full":    987654321098765434,
    "Буст сервера x1":       987654321098765435,
    "Буст сервера x2":       987654321098765436,
    "Discord Nitro 3 месяца":987654321098765437,
    "🧪 Тестовая роль (БЕСПЛАТНО)": 987654321098765438,
}

# Файл с заказами (синхронизируется с сайтом вручную или через GitHub)
ORDERS_FILE = "orders.json"

# ══════════════════════════════════════════
#  БОТ
# ══════════════════════════════════════════

intents = discord.Intents.default()
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree


def load_orders():
    """Загружает заказы из файла."""
    if not os.path.exists(ORDERS_FILE):
        return []
    with open(ORDERS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def save_orders(orders):
    """Сохраняет заказы в файл."""
    with open(ORDERS_FILE, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)


def find_order(token: str):
    """Ищет заказ по секретному токену (не по ID — защита от угадывания)."""
    orders = load_orders()
    for o in orders:
        if str(o.get("token", "")) == str(token):
            return o, orders
    return None, orders


def is_admin(user_id: int) -> bool:
    return user_id == ADMIN_ID


# ══════════════════════════════════════════
#  СОБЫТИЯ
# ══════════════════════════════════════════

@bot.event
async def on_ready():
    print(f"✅ Бот запущен: {bot.user}")
    print(f"   Сервер ID: {GUILD_ID}")
    try:
        guild = discord.Object(id=GUILD_ID)
        synced = await tree.sync(guild=guild)
        print(f"   Синхронизировано {len(synced)} команд")
    except Exception as e:
        print(f"   Ошибка синхронизации: {e}")


# ══════════════════════════════════════════
#  КОМАНДЫ
# ══════════════════════════════════════════

@tree.command(
    name="claim",
    description="Получить роль по секретному коду заказа с сайта",
    guild=discord.Object(id=GUILD_ID)
)
@app_commands.describe(code="Секретный код из окна 'Заказ оформлен' на сайте")
async def claim(interaction: discord.Interaction, code: str):
    await interaction.response.defer(ephemeral=True)

    # Убираем пробелы на случай если скопировали с пробелом
    code = code.strip()

    order, orders = find_order(code)

    if not order:
        await interaction.followup.send(
            "❌ Код не найден. Убедись что скопировал код правильно.\n"
            "Код выглядит так: `a3f8c2d1e4b5...` (32 символа)",
            ephemeral=True
        )
        return

    if order.get("status") == "done":
        await interaction.followup.send(
            "⚠️ Этот код уже был использован. Каждый код одноразовый.",
            ephemeral=True
        )
        return

    guild = bot.get_guild(GUILD_ID)
    if not guild:
        await interaction.followup.send("❌ Ошибка: сервер не найден.", ephemeral=True)
        return

    member = interaction.user
    roles_given = []
    roles_not_found = []

    for item in order.get("items", []):
        item_name = item.get("name", "")
        custom_role_name  = item.get("customRoleName")
        custom_role_color = item.get("customRoleColor")

        # Кастомная роль — создаём новую роль на сервере
        if custom_role_name:
            try:
                # Конвертируем HEX цвет в int
                color_int = int(custom_role_color.lstrip("#"), 16) if custom_role_color else 0x5865f2
                new_role = await guild.create_role(
                    name=custom_role_name,
                    color=discord.Color(color_int),
                    reason=f"Кастомная роль для {member} (заказ {code[:8]}...)"
                )
                await member.add_roles(new_role, reason=f"Кастомная роль из заказа")
                roles_given.append(f"{custom_role_name} (создана, цвет {custom_role_color})")
            except discord.Forbidden:
                roles_not_found.append(f"{custom_role_name} (нет прав создавать роли)")
            except Exception as e:
                roles_not_found.append(f"{custom_role_name} (ошибка: {e})")
            continue

        # Обычная роль из ROLE_MAP
        role_id = ROLE_MAP.get(item_name)
        if role_id:
            role = guild.get_role(role_id)
            if role:
                try:
                    await member.add_roles(role, reason=f"Заказ с сайта Пати Узумати")
                    roles_given.append(role.name)
                except discord.Forbidden:
                    roles_not_found.append(f"{item_name} (нет прав)")
                except Exception as e:
                    roles_not_found.append(f"{item_name} (ошибка: {e})")
            else:
                roles_not_found.append(f"{item_name} (роль не найдена на сервере)")
        else:
            roles_not_found.append(f"{item_name} (выдаётся вручную)")

    # Отмечаем заказ как выданный — код становится недействительным
    for o in orders:
        if str(o.get("token", "")) == str(code):
            o["status"] = "done"
            o["claimed_by"] = str(member)
            o["claimed_at"] = datetime.now().strftime("%d.%m.%Y %H:%M")
            break
    save_orders(orders)

    # Формируем ответ
    lines = []
    if roles_given:
        lines.append(f"✅ Выданы роли: **{', '.join(roles_given)}**")
    if roles_not_found:
        lines.append(f"⏳ Будут выданы вручную: {', '.join(roles_not_found)}")

    embed = discord.Embed(
        title="🎉 Заказ получен!",
        description="\n".join(lines) if lines else "Заказ обработан.",
        color=0x57f287
    )
    embed.add_field(name="Код заказа", value=f"`{code[:8]}...`", inline=True)
    embed.add_field(name="Сумма", value=f"{order.get('total', 0)} ₽", inline=True)
    embed.set_footer(text="Пати Узумати • Спасибо за покупку!")

    await interaction.followup.send(embed=embed, ephemeral=True)

    # Уведомление в лог-канал
    log_channel = bot.get_channel(LOG_CHANNEL_ID)
    if log_channel:
        log_embed = discord.Embed(
            title="📦 Заказ выдан",
            color=0x5865f2
        )
        log_embed.add_field(name="Покупатель", value=f"{member.mention} (`{member}`)", inline=False)
        log_embed.add_field(name="Discord ник из заказа", value=order.get("nick", "—"), inline=True)
        log_embed.add_field(name="Заказ #", value=order_id, inline=True)
        log_embed.add_field(name="Сумма", value=f"{order.get('total', 0)} ₽", inline=True)
        items_str = ", ".join(f"{i['emoji']} {i['name']} ×{i['qty']}" for i in order.get("items", []))
        log_embed.add_field(name="Товары", value=items_str or "—", inline=False)
        if roles_given:
            log_embed.add_field(name="Роли выданы", value=", ".join(roles_given), inline=False)
        if roles_not_found:
            log_embed.add_field(name="⚠️ Требуют ручной выдачи", value=", ".join(roles_not_found), inline=False)
        log_embed.timestamp = discord.utils.utcnow()
        await log_channel.send(embed=log_embed)


@tree.command(
    name="orders",
    description="[Админ] Список новых заказов",
    guild=discord.Object(id=GUILD_ID)
)
async def orders_cmd(interaction: discord.Interaction):
    if not is_admin(interaction.user.id):
        await interaction.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    orders = load_orders()
    pending = [o for o in orders if o.get("status") == "pending"]

    if not pending:
        await interaction.response.send_message("✅ Новых заказов нет.", ephemeral=True)
        return

    embed = discord.Embed(title=f"📋 Новые заказы ({len(pending)})", color=0xfee75c)
    for o in pending[:10]:  # показываем первые 10
        items_str = ", ".join(f"{i['name']} ×{i['qty']}" for i in o.get("items", []))
        embed.add_field(
            name=f"#{o['id']} — {o.get('nick', '?')} — {o.get('total', 0)} ₽",
            value=f"{items_str}\n📅 {o.get('date', '?')}",
            inline=False
        )

    if len(pending) > 10:
        embed.set_footer(text=f"...и ещё {len(pending)-10} заказов")

    await interaction.response.send_message(embed=embed, ephemeral=True)


@tree.command(
    name="done",
    description="[Админ] Отметить заказ как выданный вручную",
    guild=discord.Object(id=GUILD_ID)
)
@app_commands.describe(order_id="ID заказа (число, видно в /orders)")
async def done_cmd(interaction: discord.Interaction, order_id: str):
    if not is_admin(interaction.user.id):
        await interaction.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    # Ищем по числовому ID (для удобства админа)
    orders = load_orders()
    found = None
    for o in orders:
        if str(o.get("id")) == str(order_id):
            found = o
            break

    if not found:
        await interaction.response.send_message("❌ Заказ не найден.", ephemeral=True)
        return

    for o in orders:
        if str(o.get("id")) == str(order_id):
            o["status"] = "done"
            o["claimed_at"] = datetime.now().strftime("%d.%m.%Y %H:%M")
            break
    save_orders(orders)

    await interaction.response.send_message(
        f"✅ Заказ **#{order_id}** ({found.get('nick', '?')}) отмечен как выданный.",
        ephemeral=True
    )


@tree.command(
    name="give_role",
    description="[Админ] Выдать роль участнику вручную",
    guild=discord.Object(id=GUILD_ID)
)
@app_commands.describe(member="Участник сервера", role="Роль для выдачи")
async def give_role(interaction: discord.Interaction, member: discord.Member, role: discord.Role):
    if not is_admin(interaction.user.id):
        await interaction.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    try:
        await member.add_roles(role, reason=f"Выдано вручную администратором {interaction.user}")
        await interaction.response.send_message(
            f"✅ Роль **{role.name}** выдана участнику **{member}**.",
            ephemeral=True
        )
    except discord.Forbidden:
        await interaction.response.send_message(
            "❌ Нет прав для выдачи этой роли. Убедись что роль бота выше выдаваемой роли.",
            ephemeral=True
        )


@tree.command(
    name="take_role",
    description="[Админ] Забрать роль у участника",
    guild=discord.Object(id=GUILD_ID)
)
@app_commands.describe(member="Участник сервера", role="Роль для снятия")
async def take_role(interaction: discord.Interaction, member: discord.Member, role: discord.Role):
    if not is_admin(interaction.user.id):
        await interaction.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    try:
        await member.remove_roles(role, reason=f"Снято администратором {interaction.user}")
        await interaction.response.send_message(
            f"✅ Роль **{role.name}** снята с **{member}**.",
            ephemeral=True
        )
    except discord.Forbidden:
        await interaction.response.send_message("❌ Нет прав.", ephemeral=True)


# ══════════════════════════════════════════
#  ЗАПУСК
# ══════════════════════════════════════════

if __name__ == "__main__":
    bot.run(BOT_TOKEN)
