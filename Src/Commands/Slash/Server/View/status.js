const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'status',
  description: 'Quick heartbeat: Retrieve the current power state.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Quick heartbeat: Retrieve the current power state.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    await pteroUtils.serverAutocomplete(interaction);
  },

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const resolved = await pteroUtils.resolveServer(interaction);
      if (!resolved) {
        return interaction.editReply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
      }

      const { panel, serverId } = resolved;
      const info = await ptero.getServerInfo(panel.url, panel.apikey, serverId);
      const stats = info.resources;

      const statusMap = {
        'running': { emoji: '🟢', text: 'Operational', color: '#52ff52', bar: '🟩' },
        'offline': { emoji: '🔴', text: 'Offline', color: '#ff5252', bar: '🟥' },
        'starting': { emoji: '🟡', text: 'Warming Up', color: '#ffff52', bar: '🟨' },
        'stopping': { emoji: '🟡', text: 'Shutting Down', color: '#ffff52', bar: '🟨' },
        'suspended': { emoji: '🛑', text: 'Suspended', color: '#000000', bar: '⬛' }
      };

      const s = statusMap[stats.current_state] || { emoji: '⚪', text: stats.current_state, color: '#888888', bar: '⬜' };
      const uptime = stats.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : 'N/A';

      const embed = new EmbedBuilder()
        .setColor(s.color)
        .setTitle(`${s.emoji} Health Check: ${info.name}`)
        .setDescription(`${s.bar} **Current State:** \`${s.text.toUpperCase()}\``)
        .addFields(
          { name: '⏱️ Uptime', value: `\`${uptime}\``, inline: true },
          { name: '🌐 Location', value: `\`${info.node}\``, inline: true },
          { name: '🆔 Core ID', value: `\`${info.identifier}\``, inline: true }
        )
        .setFooter({ text: `Heartbeat: ${new Date().toLocaleTimeString()} • ${panel.name}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Status Check', 'ping server status', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
