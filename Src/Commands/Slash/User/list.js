const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
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
    const userId = interaction.user.id;
    const userData = await db.getUserData(userId);
    const selectedPanelName = userData.selectedPanel;
    const panel = userData.panels.find(p => p.name === selectedPanelName);
    if (!panel) {
      return interaction.respond([]);
    }

    try {
      const servers = await ptero.listServers(panel.url, panel.apikey);
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const filtered = servers
        .filter(s => s.attributes.name.toLowerCase().includes(focusedValue) || s.attributes.identifier.toLowerCase().includes(focusedValue))
        .slice(0, 25);
      await interaction.respond(filtered.map(s => ({
        name: `${s.attributes.name} (${s.attributes.identifier})`,
        value: s.attributes.identifier
      })));
    } catch (err) {
      await interaction.respond([]);
    }
  },

  async execute(client, interaction) {
    const userId = interaction.user.id;
    const userData = await db.getUserData(userId);
    const selectedPanelName = userData.selectedPanel;
    const panel = userData.panels.find(p => p.name === selectedPanelName);
    if (!panel) {
      return interaction.reply({ content: '❌ No active bridge found. Use `/panel select`.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const serverId = interaction.options.getString('id');
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
