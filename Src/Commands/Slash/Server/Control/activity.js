const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');
const { createPaginatedEmbed, chunkArray } = require('../../../../Functions/pagination');

module.exports = {
  name: 'activity',
  description: 'Retrieve a detailed registry of security and console events.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Retrieve a detailed registry of security and console events.')
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
      const logs = await ptero.getActivityLogs(panel.url, panel.apikey, serverId);

      if (logs.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#E67E22')
              .setTitle('📜 Activity Audit: Null')
              .setDescription(`No recent events found in the registry for instance \`${serverId}\` on **${panel.name}**.`)
              .setTimestamp()
          ]
        });
      }

      const chunked = chunkArray(logs, 5);
      const embeds = chunked.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`📜 Activity Audit: ${serverId}`)
          .setDescription(`Recent security and operational events for the targeted node on **${panel.name}**.`)
          .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
          .setTimestamp();

        chunk.forEach(log => {
          const attr = log.attributes;
          const date = new Date(attr.timestamp).toLocaleString();
          const metadata = attr.metadata ? `\n\`\`\`yml\n${Object.entries(attr.metadata).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\`\`\`` : '';

          embed.addFields({
            name: `🔹 ${attr.event.replace(/^server\./, '').toUpperCase()}`,
            value: `**Triggered By:** \`${attr.actor?.username || 'SYSTEM'}\`\n**Timestamp:** \`${date}\`${metadata}`,
            inline: false
          });
        });

        return embed;
      });

      await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Activity Audit', 'fetch event registry', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
