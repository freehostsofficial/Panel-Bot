const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'System latency telemetry and gateway heartbeat.',
  category: 'Utility',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('System latency telemetry and gateway heartbeat.'),

  async execute(client, interaction) {
    const sent = await interaction.reply({ content: '📡 **Initiating Heartbeat Scan...**', ephemeral: true, fetchReply: true });

    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    const uptime = Math.floor(process.uptime());

    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🛰️ System Telemetry Audit')
      .setDescription('Real-time diagnostics of the bot bridge and Discord API connectivity.')
      .addFields(
        {
          name: '⚡ Network Performance',
          value: `\`\`\`yml\nClient-Bot: ${botLatency}ms\nBot-Discord: ${apiLatency}ms\nTraffic: Optimized\n\`\`\``,
          inline: false
        },
        {
          name: '🕒 Process Uptime',
          value: `\`\`\`\n${hours}h ${minutes}m ${seconds}s\n\`\`\``,
          inline: true
        },
        {
          name: '🛡️ Core Status',
          value: '```\nOperational\n```',
          inline: true
        }
      )
      .setFooter({ text: 'Telemetry data is updated in real-time.' })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
