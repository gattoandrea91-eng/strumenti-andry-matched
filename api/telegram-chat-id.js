module.exports = async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return res.status(500).json({
        success: false,
        error: "TELEGRAM_BOT_TOKEN non configurato"
      });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await response.json();

    if (!data.ok) {
      return res.status(500).json({
        success: false,
        error: "Telegram getUpdates fallito",
        details: data
      });
    }

    const chats = [];

    for (const update of data.result || []) {
      const source =
        update.channel_post ||
        update.edited_channel_post ||
        update.message ||
        update.edited_message;

      const chat = source?.chat;

      if (!chat?.id) continue;

      if (!chats.some(item => String(item.id) === String(chat.id))) {
        chats.push({
          id: chat.id,
          type: chat.type || "",
          title: chat.title || "",
          username: chat.username || ""
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: chats.length,
      chats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: String(error?.message || error)
    });
  }
};
