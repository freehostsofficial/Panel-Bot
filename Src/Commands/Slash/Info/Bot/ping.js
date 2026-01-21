const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Check the bot\'s latency and connection status.',
  category: 'Info',
  usage: '/info bot ping',
  cooldown: 10,
  devOnly: false,
  requiredRole: false,
  voiceOnly: false,
  nsfwOnly: false,
  toggleOffCmd: false,
  maintenanceCmd: false,

  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and connection status.'),

  async execute(client, interaction) {
    const sent = await interaction.deferReply({ withResponse: true });
    
    const botPing = client.ws.ping;
    const apiPing = sent.createdTimestamp - interaction.createdTimestamp;
    const totalPing = botPing + apiPing;
    
    // Determine status based on ping
    let status = '🟢 Excellent';
    let statusColor = 0x00FF00;
    
    if (totalPing > 200) {
      status = '🟡 Good';
      statusColor = 0xFFFF00;
    }
    if (totalPing > 400) {
      status = '🟠 Moderate';
      statusColor = 0xFFA500;
    }
    if (totalPing > 600) {
      status = '🔴 Poor';
      statusColor = 0xFF0000;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🏓 **Bot Ping & Latency**')
      .setColor(statusColor)
      .setDescription(`**Connection Status:** ${status}`)
      .addFields(
        {
          name: '🤖 **Bot Latency**',
          value: `\`${botPing}ms\``,
          inline: true
        },
        {
          name: '🌐 **API Latency**',
          value: `\`${apiPing}ms\``,
          inline: true
        },
        {
          name: '⚡ **Total Response**',
          value: `\`${totalPing}ms\``,
          inline: true
        }
      )
      .addFields(
        {
          name: '📊 **Performance Guide**',
          value: [
            '```diff',
            '+ 🟢 0-200ms   : Excellent',
            '+ 🟡 200-400ms : Good',
            '- 🟠 400-600ms : Moderate',
            '- 🔴 600ms+    : Poor',
            '```'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ 
        text: 'Lower is better! • Last updated',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
