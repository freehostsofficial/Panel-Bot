const { SlashCommandBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'start',
  description: 'Initiate the environmental boot sequence.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Initiate the environmental boot sequence.')
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
      await ptero.sendPowerAction(panel.url, panel.apikey, serverId, 'start');

      const embed = createSuccessEmbed(
        'Server Starting',
        `Successfully sent **start** signal to server \`${serverId}\`.`,
        [
          { name: '🟢 Action', value: 'Start', inline: true },
          { name: '⏳ Status', value: 'Initializing...', inline: true },
          { name: '🏢 Panel', value: panel.name, inline: true }
        ]
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Server Start', 'start server', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
