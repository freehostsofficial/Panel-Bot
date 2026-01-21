const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { createPaginatedEmbed, chunkArray } = require('../../../../Functions/pagination');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'variables',
  description: 'Audit the environmental variable configuration.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('variables')
    .setDescription('Audit the environmental variable configuration.')
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
      const variables = await ptero.getStartupVariables(panel.url, panel.apikey, serverId);

      if (!variables || variables.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('⚙️ Environment Audit: Empty')
          .setDescription(`No startup variables were identified for instance \`${serverId}\` on **${panel.name}**.`)
          .setTimestamp();
        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      const chunked = chunkArray(variables, 5);
      const embeds = chunked.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor('#9966ff')
          .setTitle(`⚙️ Environment Audit: ${serverId}`)
          .setDescription(`Identified **${variables.length}** environment variables governing the server startup process on **${panel.name}**.`)
          .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
          .setTimestamp();

        chunk.forEach(v => {
          const attr = v.attributes;
          const security = attr.is_editable ? '✏️ Modifiable' : '🔒 Read-Only';
          const value = attr.server_value || attr.default_value || '*Unset*';

          embed.addFields({
            name: `${attr.name}`,
            value: `\`\`\`yml\nKey: ${attr.env_variable}\nValue: ${value}\nPermission: ${security}\n\`\`\`*${attr.description || 'No documentation available.'}*`,
            inline: false
          });
        });

        return embed;
      });

      await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Environment Security', 'audit variables', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
