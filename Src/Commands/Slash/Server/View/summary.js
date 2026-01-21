const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'summary',
  description: 'Broad-spectrum cluster overview of all instances.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Broad-spectrum cluster overview of all instances.'),

  async execute(client, interaction) {
    const userId = interaction.user.id;
    const userData = await db.getUserData(userId);

    if (!userData.panels || userData.panels.length === 0) {
      return interaction.reply({
        content: "❌ You haven't added any panels yet.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const servers = await ptero.getAllServers(userData.panels);
      if (servers.length === 0) {
        return interaction.editReply('❌ No servers found across your panels.');
      }

      let running = 0, offline = 0, other = 0;
      let totalMem = 0, totalDisk = 0, totalCpu = 0;

      servers.forEach(s => {
        totalMem += s.attributes.limits.memory;
        totalDisk += s.attributes.limits.disk;
        totalCpu += s.attributes.limits.cpu;
      });

      // Sample status for a few servers
      const sampleSize = Math.min(servers.length, 12);
      const serverSamples = await Promise.all(
        servers.slice(0, sampleSize).map(async (s) => {
          try {
            const info = await ptero.getServerInfo(s.panel.url, s.panel.apikey, s.attributes.identifier);
            if (info.resources.current_state === 'running') {
              running++;
            } else if (info.resources.current_state === 'offline') {
              offline++;
            } else {
              other++;
            }
            return { name: info.name, status: info.resources.current_state, id: info.identifier, pName: s.panel.name };
          } catch {
            other++;
            return { name: s.attributes.name, status: 'unknown', id: s.attributes.identifier, pName: s.panel.name };
          }
        })
      );

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Global Infrastructure Dashboard')
        .setDescription(`Showing overview for **${userData.panels.length}** panels.`)
        .addFields(
          {
            name: '📈 Cluster Status',
            value: `\`\`\`yml\nTotal Servers: ${servers.length}\nRunning: ${running} (Sampled)\nOffline: ${offline} (Sampled)\nOther: ${other} (Sampled)\n\`\`\``,
            inline: true
          },
          {
            name: '💾 Global Resource Quotas',
            value: `\`\`\`yml\nRAM Allocation: ${totalMem.toLocaleString()} MB\nDisk Allocation: ${totalDisk.toLocaleString()} MB\nCPU Allocation: ${totalCpu}%\n\`\`\``,
            inline: true
          }
        )
        .setFooter({ text: `Sampled ${sampleSize} active instances across ${userData.panels.length} panels.` })
        .setTimestamp();

      const statusMap = { running: '🟢', offline: '🔴', starting: '🟠', stopping: '🟡', suspended: '🛑' };

      const serverList = serverSamples.map(s => {
        const emoji = statusMap[s.status] || '⚪';
        return `${emoji} \`${s.pName}\` | \`${s.id}\` **${s.name}**`;
      }).join('\n');

      embed.addFields({ name: '🖥️ Strategic Asset List', value: serverList || '*No servers available*', inline: false });

      if (servers.length > sampleSize) {
        embed.addFields({ name: 'ℹ️ Note', value: `*+ ${servers.length - sampleSize} more servers. Use \`/server list\` to see all.*` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Infrastructure Summary', 'generate dashboard');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
