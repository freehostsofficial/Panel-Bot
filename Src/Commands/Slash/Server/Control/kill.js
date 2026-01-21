const { SlashCommandBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'kill',
  description: 'Emergency halt: Immediate termination of all processes.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Emergency halt: Immediate termination of all processes.')
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
      await ptero.sendPowerAction(panel.url, panel.apikey, serverId, 'kill');

      const embed = createSuccessEmbed(
        'Server Force Killed',
        `Successfully sent **kill** signal to server \`${serverId}\` on **${panel.name}**.`,
        [
          { name: '⚠️ Warning', value: 'Force kill terminates the server immediately without graceful shutdown.', inline: false },
          { name: '💡 Note', value: 'This can cause data loss if the server was saving data. Use `/server stop` for normal shutdowns.' }
        ]
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Server Kill', 'kill server', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
