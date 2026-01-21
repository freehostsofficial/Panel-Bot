const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'resources',
  description: 'Live telemetry: Real-time resource utilization audit.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('resources')
    .setDescription('Live telemetry: Real-time resource utilization audit.')
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
      const res = info.resources.resources;

      const formatBytes = (bytes) => {
        const gb = bytes / 1024 / 1024 / 1024;
        if (gb >= 1) {
          return `${gb.toFixed(2)} GB`;
        }
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      };

      const createBar = (used, limit) => {
        if (limit === 0) {
          return '`[∞/∞]`';
        }
        const percent = Math.min((used / (limit * 1024 * 1024)) * 100, 100);
        const size = 12;
        const filled = Math.round((size * percent) / 100);
        const empty = size - filled;
        return `\`[${'■'.repeat(filled)}${' '.repeat(empty)}]\` **${percent.toFixed(1)}%**`;
      };

      const memUsed = formatBytes(res.memory_bytes);
      const memLimitStr = info.limits.memory === 0 ? 'Unlimited' : `${info.limits.memory} MB`;
      const memBar = createBar(res.memory_bytes, info.limits.memory);

      const diskUsed = formatBytes(res.disk_bytes);
      const diskLimitStr = info.limits.disk === 0 ? 'Unlimited' : `${info.limits.disk} MB`;
      const diskBar = createBar(res.disk_bytes, info.limits.disk);

      const cpuUsed = res.cpu_absolute.toFixed(2);
      const cpuLimitStr = info.limits.cpu === 0 ? 'Unlimited' : `${info.limits.cpu}%`;
      const cpuBar = info.limits.cpu === 0 ? '`[∞/∞]`' : `\`[${'■'.repeat(Math.min(Math.round((12 * res.cpu_absolute) / info.limits.cpu), 12))}${' '.repeat(Math.max(12 - Math.round((12 * res.cpu_absolute) / info.limits.cpu), 0))}]\` **${((res.cpu_absolute / info.limits.cpu) * 100).toFixed(1)}%**`;

      const statusEmoji = info.resources.current_state === 'running' ? '🟢' : '🔴';

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`${statusEmoji} Resource Performance: ${info.name}`)
        .setDescription(`Live monitoring for server \`${info.identifier}\` on **${panel.name}**.`)
        .addFields(
          { name: '💾 Memory (RAM)', value: `${memBar}\nUsage: \`${memUsed} / ${memLimitStr}\``, inline: false },
          { name: '⚡ CPU Load', value: `${cpuBar}\nUsage: \`${cpuUsed}% / ${cpuLimitStr}\``, inline: false },
          { name: '💿 Disk Storage', value: `${diskBar}\nUsage: \`${diskUsed} / ${diskLimitStr}\``, inline: false },
          { name: '🌐 Network Activity', value: `\`\`\`yml\nDownload (RX): ${formatBytes(res.network_rx_bytes)}\nUpload   (TX): ${formatBytes(res.network_tx_bytes)}\n\`\`\``, inline: false },
          { name: '⏱️ Online Time', value: `\`\`\`\n${info.resources.uptime ? Math.floor(info.resources.uptime / 3600) + 'h ' + Math.floor((info.resources.uptime % 3600) / 60) + 'm' : 'Offline'}\n\`\`\``, inline: true },
          { name: '🌍 Node Location', value: `\`\`\`\n${info.node}\n\`\`\``, inline: true }
        )
        .setFooter({ text: `Sync Time: ${new Date().toLocaleTimeString()} • Panel: ${panel.name}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Performance Monitoring', 'fetch live resources');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
