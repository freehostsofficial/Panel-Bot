const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'info',
  description: 'Deep-dive diagnostic audit of the server instance.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Deep-dive diagnostic audit of the server instance.')
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
        'running': { emoji: '🟢', text: 'Running', color: '#52ff52' },
        'offline': { emoji: '🔴', text: 'Offline', color: '#ff5252' },
        'starting': { emoji: '🟡', text: 'Starting', color: '#ffff52' },
        'stopping': { emoji: '🟡', text: 'Stopping', color: '#ffff52' },
        'suspended': { emoji: '🛑', text: 'Suspended', color: '#000000' }
      };

      const s = statusMap[stats.current_state] || { emoji: '⚪', text: stats.current_state, color: '#888888' };

      const embed = new EmbedBuilder()
        .setColor(s.color)
        .setTitle(`${s.emoji} Server Metadata: ${info.name}`)
        .setDescription(`Basic configuration and limits for \`${info.identifier}\`.`)
        .addFields(
          {
            name: '📋 Core Details',
            value: `\`\`\`yml\nIdentifier: ${info.identifier}\nUUID: ${info.uuid}\nNode: ${info.node}\nStatus: ${s.text}\nRole: ${info.server_owner ? 'Owner' : 'Subuser'}\n\`\`\``,
            inline: false
          },
          {
            name: '🔧 Feature Quotas',
            value: `\`\`\`yml\nDatabases: ${info.feature_limits?.databases ?? 0}\nAllocations: ${info.feature_limits?.allocations ?? 0}\nBackups: ${info.feature_limits?.backups ?? 0}\n\`\`\``,
            inline: true
          },
          {
            name: '⚙️ Resource Limits',
            value: `\`\`\`yml\nRAM: ${info.limits.memory === 0 ? '∞' : info.limits.memory + ' MB'}\nCPU: ${info.limits.cpu === 0 ? '∞' : info.limits.cpu + '%'}\nDisk: ${info.limits.disk === 0 ? '∞' : info.limits.disk + ' MB'}\n\`\`\``,
            inline: true
          },
          {
            name: '🐳 Container Environment',
            value: `\`\`\`yml\nImage: ${info.container?.image || 'N/A'}\nStartup: ${info.container?.startup_command?.substring(0, 60) || 'N/A'}...\n\`\`\``,
            inline: false
          }
        )
        .setFooter({ text: `Panel: ${panel.name} • Internal ID: ${info.internal_id || info.identifier}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Server Information', 'fetch server metadata');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
