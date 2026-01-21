const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'allocation-primary',
  description: 'Designate the primary ingress route for the instance.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('allocation-primary')
    .setDescription('Designate the primary ingress route for the instance.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt => opt.setName('allocation').setDescription('Allocation Internal ID').setRequired(true)),

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

      await ptero.setPrimaryAllocation(panel.url, panel.apikey, serverId, allocationId);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🌐 Primary Route Updated')
        .setDescription(`Network allocation \`${allocationId}\` has been promoted to the **Primary** ingress point for \`${serverId}\` on **${panel.name}**.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const error = handleApiError(err, 'Network Routing', 'reassign primary allocation', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [error] });
    }
  }
};
