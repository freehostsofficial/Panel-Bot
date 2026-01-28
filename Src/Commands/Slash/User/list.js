const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');
const { createPaginatedEmbed, chunkArray } = require('../../../Functions/pagination');

module.exports = {
  name: 'list',
  description: 'Audit the subuser access control registry.',
  category: 'User',
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('Audit the subuser access control registry.')
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
      const subusers = await ptero.listSubusers(panel.url, panel.apikey, serverId);

      if (subusers.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#3498DB')
              .setTitle('👥 Subuser Registry: Null')
              .setDescription(`No secondary identities authorized for instance \`${serverId}\`.`)
              .setTimestamp()
          ]
        });
      }

      const chunked = chunkArray(subusers, 5);
      const embeds = chunked.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`👥 Subuser Registry: ${serverId}`)
          .setDescription('Audit of all secondary identities authorized for environmental interaction.')
          .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Access Control List` })
          .setTimestamp();

        chunk.forEach(user => {
          const attr = user.attributes;
          const perms = attr.permissions.length > 5 ? `${attr.permissions.slice(0, 5).join(', ')}... (+${attr.permissions.length - 5})` : attr.permissions.join(', ');

          embed.addFields({
            name: `👤 ${attr.username}`,
            value: `\`\`\`yml\nEmail: ${attr.email}\nPermissions: ${perms}\n2FA: ${attr['2fa_enabled'] ? 'Active' : 'Missing'}\nID: ${attr.uuid}\n\`\`\``,
            inline: false
          });
        });

        return embed;
      });

      await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
    } catch (err) {
      const error = handleApiError(err, 'Identity Audit', 'retrieve subuser registry', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [error] });
    }
  }
};
