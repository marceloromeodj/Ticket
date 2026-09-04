const axios = require('axios');

const notificationChannelService = {
  /** Manda `text` a un canal puntual, sin mirar sus `events` (para probarlo). */
  async sendToChannel(channel, text) {
    if (channel.type === 'slack' && channel.config?.webhook_url) {
      await axios.post(channel.config.webhook_url, { text });
    } else if (channel.type === 'telegram' && channel.config?.bot_token && channel.config?.chat_id) {
      await axios.post(
        `https://api.telegram.org/bot${channel.config.bot_token}/sendMessage`,
        { chat_id: channel.config.chat_id, text }
      );
    } else {
      throw new Error('Canal sin configuración completa');
    }
  },

  /**
   * Manda `text` a todos los canales activos de la empresa que estén
   * suscriptos a `event` (ver NotificationChannel.events). Falla en
   * silencio por canal (un webhook roto no debe frenar al resto).
   */
  async broadcast(companyId, event, text) {
    const { NotificationChannel } = require('../models');
    const channels = await NotificationChannel.findAll({ where: { company_id: companyId, active: true } });

    for (const channel of channels) {
      if (!channel.events?.includes(event)) continue;
      try {
        await this.sendToChannel(channel, text);
      } catch (err) {
        console.error(`[NotificationChannel] Error enviando a ${channel.type} (empresa ${companyId}):`, err.message);
      }
    }
  },
};

module.exports = { notificationChannelService };
