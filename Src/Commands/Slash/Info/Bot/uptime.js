const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'uptime',
  description: 'Check how long the bot has been running.',
  category: 'Info',
  usage: '/info bot uptime',
  cooldown: 10,
  devOnly: false,
  requiredRole: false,
  voiceOnly: false,
  nsfwOnly: false,
  toggleOffCmd: false,
  maintenanceCmd: false,

  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Check how long the bot has been running.'),

  async execute(client, interaction) {
    await interaction.deferReply();

    const uptimeSeconds = process.uptime();
    const startTime = new Date(Date.now() - uptimeSeconds * 1000);
    
    const formatUptime = (seconds) => {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      
      const parts = [];
      if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
      if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
      if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
      if (s > 0 || parts.length === 0) parts.push(`${s} second${s !== 1 ? 's' : ''}`);
      
      return parts.join(', ');
    };

    const uptimeFormatted = formatUptime(uptimeSeconds);
    
    const embed = new EmbedBuilder()
      .setTitle('⏱️ **Bot Uptime**')
      .setColor(0x00C2FF)
      .setDescription(`I've been running continuously for:\n**${uptimeFormatted}**`)
      .addFields(
        {
          name: '📅 **Started On**',
          value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>\n(<t:${Math.floor(startTime.getTime() / 1000)}:R>)`,
          inline: true
        },
        {
          name: '🔄 **Current Status**',
          value: `✅ **Online & Operational**\n🟢 **Active**`,
          inline: true
        },
        {
          name: '💾 **Memory Usage**',
          value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
          inline: true
        }
      )
      .setFooter({ 
        text: 'Keeping your server awesome 24/7!',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
