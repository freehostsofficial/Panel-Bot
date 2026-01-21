const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'allocation-note',
  description: 'Append descriptive metadata to a network route.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('allocation-note')
    .setDescription('Append descriptive metadata to a network route.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt => opt.setName('allocation').setDescription('Allocation Internal ID').setRequired(true))
    .addStringOption(opt => opt.setName('notes').setDescription("Descriptive label (e.g. 'Query Port')").setRequired(true)),

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
      const allocationId = interaction.options.getInteger('allocation');
      const notes = interaction.options.getString('notes');

      await ptero.updateAllocationNote(panel.url, panel.apikey, serverId, allocationId, notes);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('📝 Routing Metadata Updated')
        .setDescription(`The descriptive label for allocation \`${allocationId}\` on **${panel.name}** has been updated.`)
        .addFields(
          { name: '🏷️ New Assignment', value: `\`${notes}\``, inline: true },
          { name: '🆔 Target Server', value: `\`${serverId}\``, inline: true },
          { name: '🌐 Panel', value: panel.name, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const error = handleApiError(err, 'Network Routing', 'update allocation metadata', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [error] });
    }
  }
};
